// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MoniPayRouterV2 (V2.3)
 * @notice Gasless payment router supporting multiple tokens, dynamic fees, fee exemptions, and pause safety.
 * @dev Platform fee is calculated purely on the `amount` (not amount + fee). Sender pays `amount + fee`. Recipient receives `amount`.
 * 
 * IMPORTANT: Fee-on-transfer tokens must NEVER be whitelisted. The contract assumes 
 * balanceAfter - balanceBefore == amount. Whitelisting a fee-on-transfer token will cause accounting failures.
 */
contract MoniPayRouterV2 is EIP712, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    uint256 public platformFeeBps = 100; // Default 1%
    uint256 public constant MAX_FEE_BPS = 500; // Max 5% safety cap
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public platformTreasury;
    
    // Fee-less promotion states
    bool public globalFeeExempt = false;
    mapping(address => bool) public isFeeExempt;

    /**
     * @notice Allowed variance in the user-signed fee vs contract-calculated fee.
     * Required for tokens with unusual decimal precision to avoid revert on tiny rounding errors.
     */
    uint256 public feeTolerance = 1;
    uint256 public constant MAX_FEE_TOLERANCE = 100; // Hard cap on admin tolerance
