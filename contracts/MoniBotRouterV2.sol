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
     * The bot must track and pass the current nonce for a user to execute a transaction.
     * Once a transaction succeeds, the user's nonce is incremented.
     * This prevents a hacker or rogue bot from taking a signed API payload and executing it twice.
     */
    mapping(address => uint256) public nonces;
    
    mapping(string => bool) public usedTweetIds;

    // ============ Events ============
    event P2PExecuted(address indexed from, address indexed to, address indexed token, uint256 amount, uint256 fee, uint256 nonce, string tweetId);
    event TokenSupportUpdated(address indexed token, bool isSupported, uint256 minFee, uint256 maxAmountPerTx);
    event ExecutorAdded(address indexed executor);
    event ExecutorRemoved(address indexed executor);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeExemptionUpdated(address indexed user, bool isExempt);
    event GlobalFeeExemptionUpdated(bool isExempt);

    // ============ Errors ============
    error NotExecutor();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidNonce();
    error InsufficientAllowance();
    error InsufficientBalance();
    error TweetIdAlreadyUsed();
    error FeeTooHigh();
    error UnsupportedToken();
    error AmountExceedsLimit();

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotExecutor();
        _;
    }

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

    /**
     * @dev Centralized fee calculation logic.
     * Precedence: globalFeeExempt > isFeeExempt[user] > standard fee calculation.
     */
    function _calculateFee(address user, address token, uint256 amount) internal view returns (uint256) {
        if (globalFeeExempt || isFeeExempt[user]) {
            return 0;
        }
        uint256 calculatedFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 minFee = minFeeByToken[token];
        return calculatedFee > minFee ? calculatedFee : minFee;
    }

    // ============ Core Functions ============

    function executeP2P(
        address from,
        address to,
        address token,
        uint256 amount,
        uint256 nonce,
        string calldata tweetId
    ) external onlyExecutor nonReentrant whenNotPaused returns (bool) {