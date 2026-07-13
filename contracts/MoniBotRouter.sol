// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MoniBotRouter
 * @notice Gasless social payment router for MoniPay's Twitter/X integration
 * @dev Enables the MoniBot Worker to execute USDC transfers on behalf of users
 *      who have pre-approved this contract. This bypasses the need for EIP-712
 *      signatures in social commerce scenarios.
 *
 * Architecture:
 * - Users approve this contract once via USDC.approve(MoniBotRouter, amount)
 * - Authorized executors (Worker Bots) call executeP2P or executeGrant
 * - Contract handles fee splitting (1% to platform treasury)
 * - Events enable off-chain indexing for UI and analytics
 *
 * Security Model:
 * - Role-based: Only EXECUTOR addresses can trigger transfers
 * - Nonce-based: Per-user sequential nonces prevent replay attacks
 * - Non-custodial: Owner cannot move user funds arbitrarily
 * - Revocable: Users can always revoke by setting allowance to 0
 */
contract MoniBotRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice USDC contract on Base Mainnet
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    /// @notice Basis points denominator (100 bps = 1%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Maximum fee allowed (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Minimum fee in USDC units (6 decimals) - prevents gas losses on micro-transactions
    /// @dev 50000 = $0.05 USDC (ensures profitability even when gas spikes)
    uint256 public constant MIN_FEE = 50000;

    // ============ State Variables ============

    /// @notice Platform treasury address for fee collection
    address public platformTreasury;

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps;

    /// @notice Mapping of executor addresses authorized to call transfer functions
    mapping(address => bool) public executors;

    /// @notice Per-user nonce for replay protection on P2P commands
    mapping(address => uint256) public nonces;

    /// @notice Mapping to track used tweet IDs (prevents duplicate execution)
    mapping(string => bool) public usedTweetIds;

    /// @notice Mapping to track used campaign grant combinations
    mapping(bytes32 => bool) public usedGrants;

    // ============ Events ============

    /// @notice Emitted when a P2P transfer is executed via social command
    event P2PExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        string tweetId
    );

    /// @notice Emitted when a campaign grant is distributed
    event GrantExecuted(
        address indexed to,
        uint256 amount,
        uint256 fee,
        string campaignId
    );

    /// @notice Emitted when an executor is added
    event ExecutorAdded(address indexed executor);

    /// @notice Emitted when an executor is removed
    event ExecutorRemoved(address indexed executor);

    /// @notice Emitted when platform fee is updated
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /// @notice Emitted when platform treasury is updated
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ Errors ============

    error NotExecutor();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidNonce();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TweetIdAlreadyUsed();
    error GrantAlreadyIssued();
    error FeeTooHigh();
    error InsufficientContractBalance();

    // ============ Modifiers ============

    /// @notice Restricts function to authorized executors only
    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotExecutor();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initializes the MoniBotRouter with treasury and fee settings
     * @param _treasury Platform treasury address for fee collection
     * @param _feeBps Initial platform fee in basis points (100 = 1%)
     * @param _initialExecutor Initial executor address (Worker Bot)
     */
    constructor(
        address _treasury,
        uint256 _feeBps,
        address _initialExecutor
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        platformTreasury = _treasury;
        platformFeeBps = _feeBps;

        if (_initialExecutor != address(0)) {
            executors[_initialExecutor] = true;
            emit ExecutorAdded(_initialExecutor);
        }
    }

    // ============ Core Functions ============

    /**
     * @notice Execute a P2P transfer from a social command (e.g., Twitter)
     * @dev Uses the sender's pre-approved USDC allowance
     * @param from Sender address (the user who tweeted the command)
     * @param to Recipient address (resolved from @paytag)
     * @param amount Gross amount in USDC (6 decimals) - fee will be deducted
     * @param nonce Sequential nonce for the sender (replay protection)
     * @param tweetId Twitter tweet ID that triggered this transfer
     * @return success Boolean indicating successful execution
     *
     * Flow:
     * 1. Validate nonce matches expected value
     * 2. Check tweet hasn't been processed before
     * 3. Calculate net amount and fee
     * 4. Verify sender's allowance covers total
     * 5. Execute both transfers atomically
     * 6. Increment nonce and mark tweet as used
     */
    function executeP2P(
        address from,
        address to,
        uint256 amount,
        uint256 nonce,
        string calldata tweetId
    ) external onlyExecutor nonReentrant returns (bool) {
        // Validations
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (nonce != nonces[from]) revert InvalidNonce();
        if (bytes(tweetId).length > 0 && usedTweetIds[tweetId]) revert TweetIdAlreadyUsed();

        // Calculate fee with minimum floor to prevent gas losses on micro-transactions
        // fee = max(amount * 1%, MIN_FEE)
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 fee = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        uint256 netAmount = amount - fee;
        uint256 totalRequired = amount; // User pays gross amount

        // Check allowance and balance
        if (USDC.allowance(from, address(this)) < totalRequired) revert InsufficientAllowance();
        if (USDC.balanceOf(from) < totalRequired) revert InsufficientBalance();

        // Increment nonce first (CEI pattern)
        nonces[from] = nonce + 1;

        // Mark tweet as used if provided
        if (bytes(tweetId).length > 0) {
            usedTweetIds[tweetId] = true;
        }

        // Execute transfers
        USDC.safeTransferFrom(from, to, netAmount);
        if (fee > 0) {
            USDC.safeTransferFrom(from, platformTreasury, fee);
        }

        emit P2PExecuted(from, to, amount, fee, nonce, tweetId);

        return true;
    }

    /**
     * @notice Execute a campaign grant distribution from contract balance
     * @dev Uses the contract's own USDC balance (funded for campaigns)
     * @param to Recipient address
     * @param amount Gross amount in USDC (6 decimals)
     * @param campaignId Campaign identifier for tracking
     * @return success Boolean indicating successful execution
     *
     * Note: For grants, the fee comes out of the campaign budget,
     * not from the recipient. The recipient receives (amount - fee).
     */
    function executeGrant(
        address to,
        uint256 amount,
        string calldata campaignId
    ) external onlyExecutor nonReentrant returns (bool) {
        // Validations
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        // Create unique grant key (campaign + recipient)
        bytes32 grantKey = keccak256(abi.encodePacked(campaignId, to));
        if (usedGrants[grantKey]) revert GrantAlreadyIssued();

        // Calculate fee with minimum floor to prevent gas losses
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 fee = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        uint256 netAmount = amount - fee;

        // Check contract balance
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientContractBalance();

        // Mark grant as used
        usedGrants[grantKey] = true;

        // Execute transfers from contract balance
        USDC.safeTransfer(to, netAmount);
        if (fee > 0) {
            USDC.safeTransfer(platformTreasury, fee);
        }

        emit GrantExecuted(to, amount, fee, campaignId);

        return true;
    }

    // ============ View Functions ============

    /**
     * @notice Get the current nonce for a user
     * @param user Address to check
     * @return Current nonce value
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    /**
     * @notice Check if an address is an authorized executor
     * @param account Address to check
     * @return Boolean indicating executor status
     */
    function isExecutor(address account) external view returns (bool) {
        return executors[account];
    }

    /**
     * @notice Check if a tweet ID has already been processed
     * @param tweetId Tweet ID to check
     * @return Boolean indicating if already used
     */
    function isTweetUsed(string calldata tweetId) external view returns (bool) {
        return usedTweetIds[tweetId];
    }

    /**
     * @notice Check if a grant has been issued for a campaign + recipient combo
     * @param campaignId Campaign identifier
     * @param recipient Recipient address
     * @return Boolean indicating if grant was already issued
     */
    function isGrantIssued(string calldata campaignId, address recipient) external view returns (bool) {
        bytes32 grantKey = keccak256(abi.encodePacked(campaignId, recipient));
        return usedGrants[grantKey];
    }

    /**
     * @notice Get contract's USDC balance (available for grants)
     * @return Balance in USDC (6 decimals)
     */
    function getGrantBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /**
     * @notice Calculate fee for a given amount (includes MIN_FEE floor)
     * @param amount Gross amount
     * @return fee Fee amount (max of calculated fee or MIN_FEE)
     * @return netAmount Amount after fee deduction
     */
    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 netAmount) {
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        fee = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
        netAmount = amount - fee;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a new executor address
     * @param executor Address to authorize as executor
     */
    function addExecutor(address executor) external onlyOwner {
        if (executor == address(0)) revert InvalidAddress();
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }

    /**
     * @notice Remove an executor address
     * @param executor Address to revoke executor rights from
     */
    function removeExecutor(address executor) external onlyOwner {
        executors[executor] = false;
        emit ExecutorRemoved(executor);
    }

    /**
     * @notice Update the platform fee
     * @param newFeeBps New fee in basis points (max 500 = 5%)
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Update the platform treasury address
     * @param newTreasury New treasury address
     */
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Withdraw campaign funds (for budget management)
     * @dev Only owner can withdraw to treasury
     * @param amount Amount to withdraw
     */
    function withdrawCampaignFunds(uint256 amount) external onlyOwner {
        if (USDC.balanceOf(address(this)) < amount) revert InsufficientContractBalance();
        USDC.safeTransfer(platformTreasury, amount);
    }

    /**
     * @notice Emergency withdrawal of any ERC20 token
     * @dev For recovering accidentally sent tokens
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
