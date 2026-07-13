// SPDX-License-Identifier: MIT
/**
 * Submitted for verification at basescan.org on 2026-01-19
 * Flattened source of MoniPayRouter deployed at 0x4048d18F71E723647f83B61202362425C5a7D2c0
 */

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MoniPayRouter
 * @notice Gasless payment router for USDC on Base
 */
contract MoniPayRouter is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Base Mainnet USDC Address
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public platformTreasury;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    uint256 public totalVolume;
    uint256 public totalFeesCollected;

    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline)"
    );

    event PaymentRelayed(address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 nonce, bytes32 indexed txHash);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    error InvalidSignature();
    error ExpiredDeadline();
    error NonceAlreadyUsed();
    error InvalidAmount();
    error InvalidFee();
    error InsufficientAllowance();
    error InsufficientBalance();
    error ZeroAddress();

    constructor(address _platformTreasury) 
        EIP712("MoniPay Router", "1") 
        Ownable(msg.sender) 
    {
        if (_platformTreasury == address(0)) revert ZeroAddress();
        platformTreasury = _platformTreasury;
    }

    function relayPayment(
        address from,
        address to,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (usedNonces[from][nonce]) revert NonceAlreadyUsed();
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert ZeroAddress();
        
        uint256 totalAmount = amount + fee;
        uint256 expectedFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        
        // 1 unit tolerance for rounding
        if (fee > expectedFee + 1 || fee < expectedFee - 1) revert InvalidFee();

        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH,
            from,
            to,
            amount,
            fee,
            nonce,
            deadline
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        
        if (signer != from) revert InvalidSignature();

        usedNonces[from][nonce] = true;

        if (USDC.allowance(from, address(this)) < totalAmount) revert InsufficientAllowance();
        if (USDC.balanceOf(from) < totalAmount) revert InsufficientBalance();

        USDC.safeTransferFrom(from, to, amount);
        USDC.safeTransferFrom(from, platformTreasury, fee);

        totalVolume += totalAmount;
        totalFeesCollected += fee;

        bytes32 txHash = keccak256(abi.encodePacked(from, to, amount, nonce, block.timestamp));
        emit PaymentRelayed(from, to, amount, fee, nonce, txHash);
    }

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function calculateFee(uint256 totalAmount) external pure returns (uint256) {
        return (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        platformTreasury = newTreasury;
    }
}
