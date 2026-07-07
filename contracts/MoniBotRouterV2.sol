// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MoniBotRouterV2 (V2.3)
 * @notice Gasless social payment router. Supports multi-token, fee-exemptions, and pause safety.
 * @dev Platform fee is calculated purely on the `amount` (not amount + fee). Sender pays `amount + fee`. Recipient receives `amount`.
 * 
 * IMPORTANT: The legacy executeGrant/campaign feature was explicitly omitted in V2 by design to keep this contract 
 * lean and solely focused on P2P routing. Campaign logic is handled entirely off-chain by the AI agent.
 */
contract MoniBotRouterV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_FEE_BPS = 500; // 5% max cap

    // ============ State Variables ============
    address public platformTreasury;
    uint256 public platformFeeBps;

    bool public globalFeeExempt = false;
    mapping(address => bool) public isFeeExempt;

    mapping(address => uint256) public minFeeByToken;
    mapping(address => uint256) public maxAmountPerTxByToken; // Bot compromise damage control limit
    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public executors;
    
    /**
     * @notice Sequential nonces for replay protection. 