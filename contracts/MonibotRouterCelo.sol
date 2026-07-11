// SPDX-License-Identifier: MIT
/**
 * MoniBotRouter — Celo Mainnet (Chain ID: 42220)
 *
 * ─── DEPLOY CONSTRUCTOR ARGS ─────────────────────────────────────────────────
 *   _token:            0xcebA9300f2b948710d2653dD7B07f33A8B32118C  (USDC on Celo, 6 decimals)
 *   _treasury:         0xfa2B8eD012f756E22E780B772d604af4575d5fcf  (MoniPay treasury)
 *   _feeBps:           100                                          (1%)
 *   _minFee:           50000                                        ($0.05 in 6-decimal USDC)
 *   _initialExecutor:  <your MoniBot worker bot wallet address>
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── FIXES FROM BSC VERSION ──────────────────────────────────────────────────
 *   [FIX 1] Token no longer hardcoded as a constant.
 *           BSC had: IERC20 public constant USDT = IERC20(0x55d...);
 *           Now: passed as _token constructor argument → immutable TOKEN.
 *
 *   [FIX 2] MIN_FEE no longer hardcoded as a constant.
 *           BSC had: uint256 public constant MIN_FEE = 50000000000000000;
 *           That value is $0.05 in 18-decimal USDT — completely wrong for
 *           6-decimal USDC (would have been $50,000 minimum fee on USDC).
 *           Now: passed as _minFee constructor argument → immutable MIN_FEE.
 *           For Celo USDC (6 decimals): pass 50000 = $0.05.
 *
 *   [FIX 3] Internal variable renamed from USDT → TOKEN. No chain-specific naming.
 *
 *   [ADDED] tokenAddress() view — frontend/bot can confirm which token is live.
 *   [ADDED] getConfig() view — returns all key config in a single call.
 * ─────────────────────────────────────────────────────────────────────────────
 */

pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MoniBotRouter (Celo)
 * @notice Gasless social payment router for MoniPay's Twitter/X integration on Celo.
 * @dev Architecture:
 *        - Users approve this contract once via TOKEN.approve(MoniBotRouter, amount)
 *        - Authorized executors (Worker Bots) call executeP2P or executeGrant
 *        - Contract splits each payment: net → recipient, fee → treasury
 *
 *      Security model:
 *        - Role-based:   only EXECUTOR addresses can trigger transfers
 *        - Nonce-based:  sequential per-user nonces prevent replay
 *        - Non-custodial: owner cannot move user funds arbitrarily
 *        - Revocable:    users revoke by calling TOKEN.approve(MoniBotRouter, 0)
 */
contract MoniBotRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Immutables & constants
    // =========================================================================

    /// @notice Payment token — set once at deploy time, never changes.
    /// @dev Celo: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C (USDC, 6 decimals)
    IERC20 public immutable TOKEN; // [FIX 1] was: constant USDT hardcoded to BSC address

    /// @notice Minimum fee floor — set at deploy time to match token decimals.
    /// @dev [FIX 2] BSC hardcoded 50000000000000000 (18-dec value).
    ///      For 6-decimal USDC pass 50000 at deploy = $0.05.
    ///      For 18-decimal tokens pass 50000000000000000 = $0.05.
    uint256 public immutable MIN_FEE;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_FEE_BPS     = 500;  // 5% hard cap

    // =========================================================================
    // State
    // =========================================================================

    address public platformTreasury;
    uint256 public platformFeeBps;

    mapping(address => bool)    public executors;
    mapping(address => uint256) public nonces;
    mapping(string  => bool)    public usedTweetIds;
    mapping(bytes32 => bool)    public usedGrants;

    // =========================================================================
    // Events
    // =========================================================================

    event P2PExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        string  tweetId
    );

    event GrantExecuted(
        address indexed to,
        uint256 amount,
        uint256 fee,
        string  campaignId
    );

    event ExecutorAdded(address indexed executor);
    event ExecutorRemoved(address indexed executor);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // =========================================================================
    // Errors
    // =========================================================================

    error NotExecutor();
    error InvalidAddress();
    error InvalidToken();
    error InvalidAmount();
    error InvalidNonce();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TweetIdAlreadyUsed();
    error GrantAlreadyIssued();
    error FeeTooHigh();
    error InsufficientContractBalance();
    error MinFeeTooHigh();

    // =========================================================================
    // Modifier
    // =========================================================================

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotExecutor();
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _token            ERC-20 token used for payments.
     *                          Celo USDC: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
     * @param _treasury         Platform treasury (receives all fees).
     *                          MoniPay: 0xfa2B8eD012f756E22E780B772d604af4575d5fcf
     * @param _feeBps           Platform fee in basis points. Pass 100 for 1%.
     * @param _minFee           Minimum fee floor in token's smallest unit.
     *                          For 6-decimal USDC: pass 50000 (= $0.05).
     *                          For 18-decimal tokens: pass 50000000000000000 (= $0.05).
     * @param _initialExecutor  First Worker Bot wallet address to authorise as executor.
     */
    constructor(
        address _token,
        address _treasury,
        uint256 _feeBps,
        uint256 _minFee,
        address _initialExecutor
    ) Ownable(msg.sender) {
        if (_token    == address(0)) revert InvalidToken();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS)   revert FeeTooHigh();

        TOKEN            = IERC20(_token);
        platformTreasury = _treasury;
        platformFeeBps   = _feeBps;
        MIN_FEE          = _minFee; // [FIX 2] no longer a hardcoded constant

        if (_initialExecutor != address(0)) {
            executors[_initialExecutor] = true;
            emit ExecutorAdded(_initialExecutor);
        }
    }

    // =========================================================================
    // Core — P2P social payment
    // =========================================================================

    /**
     * @notice Execute a P2P transfer triggered by a Twitter/X command.
     * @dev Only callable by an authorised executor (Worker Bot).
     *      The sender must have pre-approved this contract for at least `amount` tokens.
     *
     * @param from     Sender address (user who sent the tweet)
     * @param to       Recipient address (resolved from @paytag)
     * @param amount   Gross amount in token units — fee is deducted from this
     * @param nonce    Expected sequential nonce for `from` (replay protection)
     * @param tweetId  Twitter tweet ID that triggered this call (deduplication)
     * @return success Always true; reverts on any failure
     *
     * Transfer breakdown:
     *   fee       = max(amount * platformFeeBps / 10000, MIN_FEE)
     *   netAmount = amount - fee
     *   from → to:            netAmount
     *   from → treasury:      fee
     */
    function executeP2P(
        address from,
        address to,
        uint256 amount,
        uint256 nonce,
        string calldata tweetId
    ) external onlyExecutor nonReentrant returns (bool) {
        // ── Guards ───────────────────────────────────────────────────────────
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0)                            revert InvalidAmount();
        if (nonce != nonces[from])                  revert InvalidNonce();
        if (bytes(tweetId).length > 0 && usedTweetIds[tweetId]) revert TweetIdAlreadyUsed();

        // ── Fee ──────────────────────────────────────────────────────────────
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 fee           = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        uint256 netAmount     = amount - fee;

        // ── Balance / allowance ──────────────────────────────────────────────
        if (TOKEN.allowance(from, address(this)) < amount) revert InsufficientAllowance();
        if (TOKEN.balanceOf(from)                 < amount) revert InsufficientBalance();

        // ── State updates (CEI) ──────────────────────────────────────────────
        nonces[from] = nonce + 1;
        if (bytes(tweetId).length > 0) usedTweetIds[tweetId] = true;

        // ── Transfers ────────────────────────────────────────────────────────
        TOKEN.safeTransferFrom(from, to,               netAmount);
        if (fee > 0) TOKEN.safeTransferFrom(from, platformTreasury, fee);

        emit P2PExecuted(from, to, amount, fee, nonce, tweetId);
        return true;
    }

    // =========================================================================
    // Core — campaign grant distribution
    // =========================================================================

    /**
     * @notice Distribute a campaign grant from the contract's own token balance.
     * @dev Only callable by an authorised executor.
     *      The contract must be pre-funded with tokens for campaign grants.
     *
     * @param to         Recipient address
     * @param amount     Gross grant amount in token units — fee deducted from budget
     * @param campaignId Unique campaign identifier (prevents double-grant per recipient)
     * @return success Always true; reverts on any failure
     *
     * Transfer breakdown:
     *   fee       = max(amount * platformFeeBps / 10000, MIN_FEE)
     *   netAmount = amount - fee
     *   contract → to:        netAmount
     *   contract → treasury:  fee
     */
    function executeGrant(
        address to,
        uint256 amount,
        string calldata campaignId
    ) external onlyExecutor nonReentrant returns (bool) {
        // ── Guards ───────────────────────────────────────────────────────────
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0)      revert InvalidAmount();

        bytes32 grantKey = keccak256(abi.encodePacked(campaignId, to));
        if (usedGrants[grantKey]) revert GrantAlreadyIssued();

        // ── Fee ──────────────────────────────────────────────────────────────
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 fee           = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        uint256 netAmount     = amount - fee;

        // ── Balance ──────────────────────────────────────────────────────────
        if (TOKEN.balanceOf(address(this)) < amount) revert InsufficientContractBalance();

        // ── State update (CEI) ───────────────────────────────────────────────
        usedGrants[grantKey] = true;

        // ── Transfers ────────────────────────────────────────────────────────
        TOKEN.safeTransfer(to,               netAmount);
        if (fee > 0) TOKEN.safeTransfer(platformTreasury, fee);

        emit GrantExecuted(to, amount, fee, campaignId);
        return true;
    }

    // =========================================================================
    // Views
    // =========================================================================

    /// @notice Current sequential nonce for a user
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /// @notice Whether an address is an authorised executor
    function isExecutor(address account) external view returns (bool) {
        return executors[account];
    }

    /// @notice Whether a tweet has already been processed
    function isTweetUsed(string calldata tweetId) external view returns (bool) {
        return usedTweetIds[tweetId];
    }

    /// @notice Whether a grant has already been issued for campaignId + recipient
    function isGrantIssued(string calldata campaignId, address recipient) external view returns (bool) {
        return usedGrants[keccak256(abi.encodePacked(campaignId, recipient))];
    }

    /// @notice Contract's token balance available for grants
    function getGrantBalance() external view returns (uint256) {
        return TOKEN.balanceOf(address(this));
    }

    /**
     * @notice Calculate fee for a given gross amount (includes MIN_FEE floor).
     * @param amount Gross amount
     * @return fee       Fee charged (deducted from amount)
     * @return netAmount Amount the recipient receives
     */
    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 netAmount) {
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        fee       = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        netAmount = amount - fee;
    }

    /// @notice Address of the configured payment token. [ADDED]
    function tokenAddress() external view returns (address) {
        return address(TOKEN);
    }

    /// @notice All key config in one call — useful for Worker Bot startup checks. [ADDED]
    function getConfig() external view returns (
        address token,
        address treasury,
        uint256 feeBps,
        uint256 minFee
    ) {
        return (address(TOKEN), platformTreasury, platformFeeBps, MIN_FEE);
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /// @notice Authorise a new executor (Worker Bot wallet)
    function addExecutor(address executor) external onlyOwner {
        if (executor == address(0)) revert InvalidAddress();
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }

    /// @notice Revoke executor rights
    function removeExecutor(address executor) external onlyOwner {
        executors[executor] = false;
        emit ExecutorRemoved(executor);
    }

    /// @notice Update the platform fee rate
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 old = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(old, newFeeBps);
    }

    /// @notice Update the platform treasury address
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        address old = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(old, newTreasury);
    }

    /// @notice Withdraw campaign grant funds back to treasury (budget management)
    function withdrawCampaignFunds(uint256 amount) external onlyOwner {
        if (TOKEN.balanceOf(address(this)) < amount) revert InsufficientContractBalance();
        TOKEN.safeTransfer(platformTreasury, amount);
    }

    /// @notice Emergency recovery of any ERC-20 accidentally sent to this contract
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
