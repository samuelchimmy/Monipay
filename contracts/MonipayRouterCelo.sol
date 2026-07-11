// SPDX-License-Identifier: MIT
/**
 * MoniPayRouter — Celo Mainnet (Chain ID: 42220)
 *
 * ─── DEPLOY CONSTRUCTOR ARGS ─────────────────────────────────────────────────
 *   _token:            0xcebA9300f2b948710d2653dD7B07f33A8B32118C  (USDC on Celo, 6 decimals)
 *   _platformTreasury: 0xfa2B8eD012f756E22E780B772d604af4575d5fcf  (MoniPay treasury)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── FIXES FROM BSC VERSION ──────────────────────────────────────────────────
 *   [FIX 1] Token no longer hardcoded as a constant.
 *           BSC had: IERC20 public constant USDT = IERC20(0x55d...);
 *           Now: passed as _token constructor argument → immutable TOKEN.
 *           This makes the contract reusable for any ERC-20 on any chain.
 *
 *   [FIX 2] Critical fee validation logic bug corrected.
 *           BSC had: if (fee > expectedFee + 1 && fee < expectedFee - 1)
 *           This used && (AND) — a value can NEVER be simultaneously greater
 *           than X+1 AND less than X-1, so this check never reverted on bad fees.
 *           Fixed to: if (fee > expectedFee + 1 || fee < expectedFee - 1)
 *
 *   [FIX 3] Internal variable renamed from USDT → TOKEN. No chain-specific naming.
 *
 *   [ADDED] tokenAddress() view — frontend can verify which token is configured.
 *   [ADDED] getStats() view — off-chain monitoring without separate calls.
 * ─────────────────────────────────────────────────────────────────────────────
 */

pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MoniPayRouter (Celo)
 * @notice Gasless EIP-712 payment router. Token-agnostic and chain-agnostic.
 * @dev Flow:
 *        1. User signs a PaymentAuthorization struct off-chain (EIP-712).
 *        2. MoniPay relayer (Supabase edge function) submits the signature here.
 *        3. This contract verifies the signature and atomically transfers:
 *             `amount`  → recipient
 *             `fee`     → platformTreasury
 *           Both pulled from the sender's pre-approved token allowance.
 */
contract MoniPayRouter is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // =========================================================================
    // Immutables & constants
    // =========================================================================

    /// @notice Payment token — set once at deploy time, never changes.
    /// @dev Celo deployment: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C (USDC, 6 dec)
    IERC20 public immutable TOKEN; // [FIX 1] was: constant USDT hardcoded to BSC address

    uint256 public constant PLATFORM_FEE_BPS = 100;   // 1%
    uint256 public constant BPS_DENOMINATOR  = 10000;

    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline)"
    );

    // =========================================================================
    // State
    // =========================================================================

    address public platformTreasury;

    mapping(address => mapping(uint256 => bool)) public usedNonces;

    uint256 public totalVolume;
    uint256 public totalFeesCollected;

    // =========================================================================
    // Events
    // =========================================================================

    event PaymentRelayed(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        bytes32 indexed txHash
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // =========================================================================
    // Errors
    // =========================================================================

    error InvalidSignature();
    error ExpiredDeadline();
    error NonceAlreadyUsed();
    error InvalidAmount();
    error InvalidFee();
    error InsufficientAllowance();
    error InsufficientBalance();
    error ZeroAddress();
    error InvalidToken();

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param _token            ERC-20 token used for payments.
     *                          Celo: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C (USDC)
     * @param _platformTreasury Wallet that receives the 1% platform fee.
     *                          MoniPay: 0xfa2B8eD012f756E22E780B772d604af4575d5fcf
     */
    constructor(address _token, address _platformTreasury)
        EIP712("MoniPay Router", "1")
        Ownable(msg.sender)
    {
        if (_token == address(0))            revert InvalidToken();
        if (_platformTreasury == address(0)) revert ZeroAddress();

        TOKEN            = IERC20(_token);
        platformTreasury = _platformTreasury;
    }

    // =========================================================================
    // Core
    // =========================================================================

    /**
     * @notice Execute a gasless signed payment on behalf of a user.
     * @dev Called exclusively by the MoniPay Supabase relay-payment edge function.
     *
     * @param from      Sender address (must have pre-approved TOKEN to this contract)
     * @param to        Recipient address
     * @param amount    Net token amount the recipient receives (in token decimals)
     * @param fee       Platform fee (in token decimals) — must be ≈1% of (amount+fee)
     * @param nonce     One-time value for this sender (prevents replay)
     * @param deadline  Signature expires after this Unix timestamp
     * @param signature EIP-712 signature produced by `from`
     */
    function relayPayment(
        address from,
        address to,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        // ── Guards ───────────────────────────────────────────────────────────
        if (block.timestamp > deadline)  revert ExpiredDeadline();
        if (usedNonces[from][nonce])     revert NonceAlreadyUsed();
        if (amount == 0)                 revert InvalidAmount();
        if (to == address(0))            revert ZeroAddress();

        // ── Fee validation ───────────────────────────────────────────────────
        // The gross total the sender pays is (amount + fee).
        // The expected 1% fee on that gross total must match what was signed,
        // within ±1 token unit to absorb rounding errors.
        uint256 totalAmount = amount + fee;
        uint256 expectedFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;

        // [FIX 2] BSC had &&  →  impossible to trigger (no number is simultaneously
        //         > X+1 AND < X-1). Corrected to || so bad fees actually revert.
        if (fee > expectedFee + 1 || fee < expectedFee - 1) revert InvalidFee();

        // ── Signature verification ───────────────────────────────────────────
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            from,
            to,
            amount,
            fee,
            nonce,
            deadline
        ));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != from) revert InvalidSignature();

        // ── Balance / allowance ──────────────────────────────────────────────
        if (TOKEN.allowance(from, address(this)) < totalAmount) revert InsufficientAllowance();
        if (TOKEN.balanceOf(from)                 < totalAmount) revert InsufficientBalance();

        // ── State updates (Checks-Effects-Interactions) ──────────────────────
        usedNonces[from][nonce]  = true;
        totalVolume             += totalAmount;
        totalFeesCollected      += fee;

        // ── Transfers ────────────────────────────────────────────────────────
        TOKEN.safeTransferFrom(from, to,               amount);
        TOKEN.safeTransferFrom(from, platformTreasury, fee);

        // ── Event ────────────────────────────────────────────────────────────
        bytes32 txHash = keccak256(
            abi.encodePacked(from, to, amount, nonce, block.timestamp)
        );
        emit PaymentRelayed(from, to, amount, fee, nonce, txHash);
    }

    // =========================================================================
    // Views
    // =========================================================================

    /// @notice Returns true if `nonce` has already been used by `user`
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    /// @notice EIP-712 domain separator for this deployment
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Calculate the platform fee on a gross payment total.
     * @param grossAmount Total the sender will pay (amount + fee combined)
     * @return fee 1% of grossAmount
     */
    function calculateFee(uint256 grossAmount) external pure returns (uint256 fee) {
        return (grossAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Address of the configured payment token.
    ///         Frontend calls this to confirm correct deployment. [ADDED]
    function tokenAddress() external view returns (address) {
        return address(TOKEN);
    }

    /// @notice Aggregate stats — single call for dashboards/monitoring. [ADDED]
    function getStats() external view returns (
        uint256 volume,
        uint256 feesCollected,
        address treasury,
        address token
    ) {
        return (totalVolume, totalFeesCollected, platformTreasury, address(TOKEN));
    }

    // =========================================================================
    // Admin
    // =========================================================================

    /**
     * @notice Update the treasury address that receives platform fees.
     * @param newTreasury Must be non-zero
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = platformTreasury;
        platformTreasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }
}
