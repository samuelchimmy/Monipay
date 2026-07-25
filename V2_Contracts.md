# MoniPay Smart Contracts V2.3

This document contains the consolidated V2.3 smart contracts for audit review.

## 1. MoniPayRouterV2.sol
```solidity
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

    mapping(address => bool) public supportedTokens;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // Analytics
    mapping(address => uint256) public totalVolumeByToken;
    mapping(address => uint256) public totalFeesCollectedByToken;

    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(address from,address to,address token,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline)"
    );

    event PaymentRelayed(address indexed from, address indexed to, address indexed token, uint256 amount, uint256 fee, uint256 nonce, bytes32 txHash);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeToleranceUpdated(uint256 oldTolerance, uint256 newTolerance);
    event TokenSupportUpdated(address indexed token, bool isSupported);
    event FeeExemptionUpdated(address indexed user, bool isExempt);
    event GlobalFeeExemptionUpdated(bool isExempt);

    error InvalidSignature();
    error ExpiredDeadline();
    error NonceAlreadyUsed();
    error InvalidAmount();
    error InvalidFee();
    error InsufficientAllowance();
    error InsufficientBalance();
    error ZeroAddress();
    error UnsupportedToken();
    error FeeExceedsMaximum();
    error ToleranceExceedsMaximum();

    constructor(address _platformTreasury) 
        EIP712("MoniPay Router", "2") 
        Ownable(msg.sender) 
    {
        if (_platformTreasury == address(0)) revert ZeroAddress();
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev Centralized fee calculation logic.
     * Precedence: globalFeeExempt > isFeeExempt[user] > standard fee calculation.
     * If either exemption is true, fee is 0.
     */
    function _calculateFee(address user, uint256 amount) internal view returns (uint256) {
        if (globalFeeExempt || isFeeExempt[user]) {
            return 0;
        }
        return (amount * platformFeeBps) / BPS_DENOMINATOR;
    }

    function relayPayment(
        address from,
        address to,
        address token,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (usedNonces[from][nonce]) revert NonceAlreadyUsed();
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert ZeroAddress();
        
        { // Scope signature and fee verification to avoid stack too deep
            uint256 expectedFee = _calculateFee(from, amount);
            
            // Fee tolerance check allows for minor precision rounding discrepancies
            if (fee > expectedFee + feeTolerance || fee < (expectedFee > feeTolerance ? expectedFee - feeTolerance : 0)) {
                revert InvalidFee();
            }

            address signer = ECDSA.recover(
                _hashTypedDataV4(
                    keccak256(
                        abi.encode(
                            PAYMENT_TYPEHASH,
                            from,
                            to,
                            token,
                            amount,
                            fee,
                            nonce,
                            deadline
                        )
                    )
                ),
                signature
            );
            
            if (signer != from) revert InvalidSignature();
        }

        usedNonces[from][nonce] = true;

        { // Scope token transfers to avoid stack too deep
            IERC20 tokenContract = IERC20(token);
            uint256 totalAmount = amount + fee;

            if (tokenContract.allowance(from, address(this)) < totalAmount) revert InsufficientAllowance();
            if (tokenContract.balanceOf(from) < totalAmount) revert InsufficientBalance();

            tokenContract.safeTransferFrom(from, to, amount);
            if (fee > 0) {
                tokenContract.safeTransferFrom(from, platformTreasury, fee);
            }
        }

        totalVolumeByToken[token] += amount;
        totalFeesCollectedByToken[token] += fee;

        emit PaymentRelayed(from, to, token, amount, fee, nonce, keccak256(abi.encodePacked(from, to, token, amount, nonce, block.timestamp)));
    }

    // ============ View Functions ============

    /**
     * @notice Aggregated view function for frontend/bot integration
     */
    function getConfig() external view returns (
        address treasury,
        uint256 feeBps,
        uint256 maxFeeBps,
        bool isGlobalFeeExempt,
        bool isPaused
    ) {
        return (
            platformTreasury,
            platformFeeBps,
            MAX_FEE_BPS,
            globalFeeExempt,
            paused()
        );
    }

    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function calculateFee(address user, uint256 amount) external view returns (uint256) {
        return _calculateFee(user, amount);
    }

    // ============ Admin Functions ============

    function setSupportedToken(address token, bool isSupported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = isSupported;
        emit TokenSupportUpdated(token, isSupported);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }

    function setPlatformFee(uint256 _newFeeBps) external onlyOwner {
        if (_newFeeBps > MAX_FEE_BPS) revert FeeExceedsMaximum();
        emit FeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }
    
    function setFeeTolerance(uint256 _newTolerance) external onlyOwner {
        if (_newTolerance > MAX_FEE_TOLERANCE) revert ToleranceExceedsMaximum();
        emit FeeToleranceUpdated(feeTolerance, _newTolerance);
        feeTolerance = _newTolerance;
    }

    function setFeeExempt(address user, bool exempt) external onlyOwner {
        isFeeExempt[user] = exempt;
        emit FeeExemptionUpdated(user, exempt);
    }

    function setGlobalFeeExempt(bool exempt) external onlyOwner {
        globalFeeExempt = exempt;
        emit GlobalFeeExemptionUpdated(exempt);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
```

## 2. IOURegistryV2.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MoniPay IOURegistryV2 (V2.3)
 * @notice Gasless escrow for social users. Supports multi-token, fee-exemptions, configurable holds, and surplus-only withdrawals.
 * @dev Sender pays `netAmount + fee`. Recipient receives strictly `netAmount`.
 */
contract IOURegistryV2 is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    struct IOU {
        address sender;
        address token;         
        uint256 netAmount;        
        bytes32 recipientId;   
        uint64  expiry;
        bool    claimed;
        bool    refunded;
    }
           
    address public vault;                
    address public treasury;             
    
    uint256 public feeBps;               
    uint256 public minFee;
    uint256 public constant MAX_FEE_BPS = 500; // Max 5% safety cap               
    
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    /**
     * @notice Configurable hold duration before a sender can be refunded.
     */
    uint256 public holdDuration = 3 days;

    uint256 public nextId;
    
    bool public globalFeeExempt = false;
    mapping(address => bool) public isFeeExempt;

    mapping(address => bool) public supportedTokens;
    
    /**
     * @notice Tracks the exact amount of tokens currently locked in pending IOUs.
     * Guarantees that emergency withdrawals can only remove surplus tokens (e.g. fees or accidents).
     */
    mapping(address => uint256) public totalEscrowedByToken;
    
    mapping(uint256 => IOU) public ious;
    mapping(bytes32 => uint256[]) public recipientIOUs;
    mapping(address => bool) public executors; 

    // ============ Events ============
    event IOUCreated(uint256 indexed iouId, address indexed sender, address indexed token, bytes32 recipientId, uint256 netAmount, uint256 fee, uint64 expiry);
    event IOUClaimed(uint256 indexed iouId, bytes32 indexed recipientId, address indexed claimant, uint256 netAmount);
    event IOURefunded(uint256 indexed iouId, address indexed sender, uint256 netAmount);
    
    event BatchClaimed(bytes32 indexed recipientId, address indexed claimant, address indexed token, uint256 totalAmount, uint256 iouCount);
    event BatchRefunded(address indexed sender, address indexed token, uint256 totalAmount, uint256 iouCount);
    
    event TokenSupportUpdated(address indexed token, bool isSupported);
    event FeeExemptionUpdated(address indexed user, bool isExempt);
    event GlobalFeeExemptionUpdated(bool isExempt);
    event HoldDurationUpdated(uint256 oldDuration, uint256 newDuration);
    
    // ============ Errors ============
    error NotVault();
    error NotExecutor();
    error AmountTooSmall();
    error InvalidAddress();
    error MismatchedRecipient();
    error MismatchedToken();
    error InvalidBatchSize();
    error MixedSendersNotAllowed();
    error UnsupportedToken();
    error FeeExceedsMaximum();
    error InvalidDuration();
    error AmountExceedsSurplus();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotExecutor();
        _;
    }

    constructor(
        address _vault, 
        address _treasury,
        uint256 _feeBps,
        uint256 _minFee,
        address _initialExecutor
    ) Ownable(msg.sender) {
        if (_vault == address(0) || _treasury == address(0)) revert InvalidAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeExceedsMaximum();
        
        vault = _vault;
        treasury = _treasury;
        feeBps = _feeBps;
        minFee = _minFee;
        
        if (_initialExecutor != address(0)) {
            executors[_initialExecutor] = true;
        }
        executors[msg.sender] = true;
    }

    /**
     * @dev Centralized fee calculation logic.
     * Precedence: globalFeeExempt > isFeeExempt[user] > standard fee calculation.
     */
    function _calculateFee(address user, uint256 baseAmount) internal view returns (uint256) {
        if (globalFeeExempt || isFeeExempt[user]) {
            return 0;
        }
        uint256 calculatedFee = (baseAmount * feeBps) / BPS;
        return calculatedFee > minFee ? calculatedFee : minFee;
    }

    // ============ Core Functions ============

    function executeCreate(
        address from,
        address token,
        uint256 netAmount,
        bytes32 recipientId
    ) external onlyExecutor nonReentrant whenNotPaused returns (uint256 iouId) {
        if (from == address(0)) revert InvalidAddress();
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (netAmount == 0) revert AmountTooSmall();
        
        uint256 fee = _calculateFee(from, netAmount);
        uint256 totalRequired = netAmount + fee;
        uint64 expiry = uint64(block.timestamp + holdDuration);

        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransferFrom(from, address(this), totalRequired);
        
        if (fee > 0) {
            tokenContract.safeTransfer(treasury, fee);
        }

        iouId = nextId++;
        ious[iouId] = IOU({
            sender: from,
            token: token,
            netAmount: netAmount,
            recipientId: recipientId,
            expiry: expiry,
            claimed: false,
            refunded: false
        });

        recipientIOUs[recipientId].push(iouId);
        
        // Track strictly escrowed user funds
        totalEscrowedByToken[token] += netAmount;

        emit IOUCreated(iouId, from, token, recipientId, netAmount, fee, expiry);
    }

    function batchClaim(
        uint256[] calldata iouIds, 
        address claimant, 
        bytes32 recipientId,
        address token
    ) external onlyVault nonReentrant whenNotPaused {
        if (claimant == address(0)) revert InvalidAddress();
        if (iouIds.length == 0 || iouIds.length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        
        uint256 totalAmount = 0;
        uint256 processedCount = 0;

        for (uint256 i = 0; i < iouIds.length; i++) {
            uint256 id = iouIds[i];
            IOU storage iou = ious[id];

            if (iou.sender == address(0)) continue;
            if (iou.recipientId != recipientId) revert MismatchedRecipient();
            if (iou.token != token) revert MismatchedToken();

            if (!iou.claimed && !iou.refunded) {
                iou.claimed = true;
                totalAmount += iou.netAmount;
                processedCount++;
                emit IOUClaimed(id, recipientId, claimant, iou.netAmount);
            }
        }

        if (totalAmount > 0) {
            totalEscrowedByToken[token] -= totalAmount;
            IERC20(token).safeTransfer(claimant, totalAmount);
            emit BatchClaimed(recipientId, claimant, token, totalAmount, processedCount);
        }
    }

    function batchRefund(uint256[] calldata iouIds, address token) external nonReentrant whenNotPaused {
        if (iouIds.length == 0 || iouIds.length > MAX_BATCH_SIZE) revert InvalidBatchSize();

        uint256 totalRefund = 0;
        uint256 processedCount = 0;
        address targetSender = address(0);

        for (uint256 i = 0; i < iouIds.length; i++) {
            uint256 id = iouIds[i];
            IOU storage iou = ious[id];

            if (iou.sender == address(0)) continue;
            if (iou.token != token) revert MismatchedToken();

            if (targetSender == address(0)) {
                targetSender = iou.sender;
            } else if (iou.sender != targetSender) {
                revert MixedSendersNotAllowed();
            }

            bool isAuthorized = (msg.sender == iou.sender || executors[msg.sender]);
            
            if (isAuthorized && !iou.claimed && !iou.refunded && block.timestamp >= iou.expiry) {
                iou.refunded = true;
                totalRefund += iou.netAmount;
                processedCount++;
                emit IOURefunded(id, iou.sender, iou.netAmount);
            }
        }

        if (totalRefund > 0) {
            totalEscrowedByToken[token] -= totalRefund;
            IERC20(token).safeTransfer(targetSender, totalRefund);
            emit BatchRefunded(targetSender, token, totalRefund, processedCount);
        }
    }

    // ============ View Functions ============
    
    function getConfig() external view returns (
        address vaultAddress,
        address treasuryAddress,
        uint256 platformFeeBps,
        uint256 minimumFee,
        uint256 maxFeeBps,
        uint256 holdTime,
        bool isGlobalFeeExempt,
        bool isPaused
    ) {
        return (
            vault,
            treasury,
            feeBps,
            minFee,
            MAX_FEE_BPS,
            holdDuration,
            globalFeeExempt,
            paused()
        );
    }

    /**
     * @notice Gas-bound pagination view to fetch pending IOUs.
     */
    function getPendingIOUs(bytes32 recipientId, uint256 offset, uint256 limit) external view returns (uint256[] memory ids, uint256 count) {
        uint256[] memory all = recipientIOUs[recipientId];
        
        if (offset >= all.length || limit == 0) {
            return (new uint256[](0), 0);
        }
        
        uint256 end = offset + limit;
        if (end > all.length) {
            end = all.length;
        }

        uint256[] memory temp = new uint256[](end - offset);
        uint256 c = 0;
        
        for (uint256 i = offset; i < end; i++) {
            IOU storage iou = ious[all[i]];
            if (!iou.claimed && !iou.refunded) {
                temp[c++] = all[i];
            }
        }
        
        ids = new uint256[](c);
        for (uint256 i = 0; i < c; i++) ids[i] = temp[i];
        count = c;
    }

    function getRecipientIOUIDs(bytes32 recipientId) external view returns (uint256[] memory) {
        return recipientIOUs[recipientId];
    }

    function calculateFee(address user, uint256 amount) external view returns (uint256) {
        return _calculateFee(user, amount);
    }

    // ============ Admin Functions ============
    
    function setHoldDuration(uint256 newDuration) external onlyOwner {
        if (newDuration < 1 days || newDuration > 30 days) revert InvalidDuration();
        emit HoldDurationUpdated(holdDuration, newDuration);
        holdDuration = newDuration;
    }

    function setSupportedToken(address token, bool isSupported) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = isSupported;
        emit TokenSupportUpdated(token, isSupported);
    }

    function setExecutor(address executor, bool status) external onlyOwner { executors[executor] = status; }
    
    function setFees(uint256 _feeBps, uint256 _minFee) external onlyOwner { 
        if (_feeBps > MAX_FEE_BPS) revert FeeExceedsMaximum();
        feeBps = _feeBps; 
        minFee = _minFee; 
    }
    
    function setFeeExempt(address user, bool exempt) external onlyOwner {
        isFeeExempt[user] = exempt;
        emit FeeExemptionUpdated(user, exempt);
    }

    function setGlobalFeeExempt(bool exempt) external onlyOwner {
        globalFeeExempt = exempt;
        emit GlobalFeeExemptionUpdated(exempt);
    }

    function setVault(address _vault) external onlyOwner { 
        if (_vault == address(0)) revert InvalidAddress();
        vault = _vault; 
    }
    
    function setTreasury(address _treasury) external onlyOwner { 
        if (_treasury == address(0)) revert InvalidAddress();
        treasury = _treasury; 
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Safely withdraws mistakenly sent tokens or accumulated protocol surplus.
     * @dev It is mathematically impossible to withdraw tokens actively escrowed in an IOU.
     */
    function emergencyWithdrawToken(address token, uint256 amount) external onlyOwner {
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        uint256 escrowed = totalEscrowedByToken[token];
        
        if (currentBalance < escrowed) revert AmountExceedsSurplus();
        uint256 surplus = currentBalance - escrowed;
        if (amount > surplus) revert AmountExceedsSurplus();
        
        IERC20(token).safeTransfer(owner(), amount);
    }
}
```

## 3. MoniBotRouterV2.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (amount == 0) revert InvalidAmount();
        if (amount > maxAmountPerTxByToken[token]) revert AmountExceedsLimit();
        if (nonce != nonces[from]) revert InvalidNonce();
        if (bytes(tweetId).length > 0 && usedTweetIds[tweetId]) revert TweetIdAlreadyUsed();

        uint256 fee = _calculateFee(from, token, amount);
        uint256 totalRequired = amount + fee;

        IERC20 tokenContract = IERC20(token);
        if (tokenContract.allowance(from, address(this)) < totalRequired) revert InsufficientAllowance();
        if (tokenContract.balanceOf(from) < totalRequired) revert InsufficientBalance();

        nonces[from] = nonce + 1;

        if (bytes(tweetId).length > 0) {
            usedTweetIds[tweetId] = true;
        }

        tokenContract.safeTransferFrom(from, to, amount);
        if (fee > 0) {
            tokenContract.safeTransferFrom(from, platformTreasury, fee);
        }

        emit P2PExecuted(from, to, token, amount, fee, nonce, tweetId);
        return true;
    }

    // ============ View Functions ============

    /**
     * @notice Aggregated view function for frontend/bot integration
     */
    function getConfig() external view returns (
        address treasury,
        uint256 feeBps,
        uint256 maxFeeBps,
        bool isGlobalFeeExempt,
        bool isPaused
    ) {
        return (
            platformTreasury,
            platformFeeBps,
            MAX_FEE_BPS,
            globalFeeExempt,
            paused()
        );
    }

    function calculateFee(address user, address token, uint256 amount) external view returns (uint256) {
        return _calculateFee(user, token, amount);
    }

    // ============ Admin Functions ============

    function setSupportedToken(address token, bool isSupported, uint256 minFee, uint256 maxAmountPerTx) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = isSupported;
        minFeeByToken[token] = minFee;
        maxAmountPerTxByToken[token] = maxAmountPerTx;
        emit TokenSupportUpdated(token, isSupported, minFee, maxAmountPerTx);
    }

    function addExecutor(address executor) external onlyOwner {
        if (executor == address(0)) revert InvalidAddress();
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }

    function removeExecutor(address executor) external onlyOwner {
        executors[executor] = false;
        emit ExecutorRemoved(executor);
    }

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFeeBps = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFeeBps, newFeeBps);
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(oldTreasury, newTreasury);
    }

    function setFeeExempt(address user, bool exempt) external onlyOwner {
        isFeeExempt[user] = exempt;
        emit FeeExemptionUpdated(user, exempt);
    }

    function setGlobalFeeExempt(bool exempt) external onlyOwner {
        globalFeeExempt = exempt;
        emit GlobalFeeExemptionUpdated(exempt);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
```
