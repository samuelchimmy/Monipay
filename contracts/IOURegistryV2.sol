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