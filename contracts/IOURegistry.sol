// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MoniPay IOURegistry (Enterprise Multi-Chain)
 * @notice Gasless escrow for social users. Ultra-optimized, DoS-resistant, 
 *         and mathematically strictly accounted.
 */
contract IOURegistry is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct IOU {
        address sender;        
        uint256 grossAmount;   
        uint256 netAmount;     
        bytes32 recipientId;   
        uint64  expiry;
        bool    claimed;
        bool    refunded;
    }

    IERC20 public immutable TOKEN;       
    address public vault;                
    address public treasury;             
    
    uint256 public feeBps;               
    uint256 public minFee;               
    
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_BATCH_SIZE = 100; // Protection against Out-of-Gas DoS

    uint256 public nextId;
    mapping(uint256 => IOU) public ious;
    mapping(bytes32 => uint256[]) public recipientIOUs;
    mapping(address => bool) public executors; 

    // ============ Events ============
    event IOUCreated(uint256 indexed iouId, address indexed sender, bytes32 indexed recipientId, uint256 grossAmount, uint256 netAmount, uint256 fee, uint64 expiry);
    event IOUClaimed(uint256 indexed iouId, bytes32 indexed recipientId, address indexed claimant, uint256 netAmount);
    event IOURefunded(uint256 indexed iouId, address indexed sender, uint256 amount);
    
    event BatchClaimed(bytes32 indexed recipientId, address indexed claimant, uint256 totalAmount, uint256 iouCount);
    event BatchRefunded(address indexed sender, uint256 totalAmount, uint256 iouCount);
    
    // ============ Errors ============
    error NotVault();
    error NotExecutor();
    error AmountTooSmall();
    error InvalidAddress();
    error MismatchedRecipient();
    error InvalidBatchSize();
    error MixedSendersNotAllowed();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotExecutor();
        _;
    }

    constructor(
        address _token,
        address _vault, 
        address _treasury,
        uint256 _feeBps,
        uint256 _minFee,
        address _initialExecutor
    ) Ownable(msg.sender) {
        if (_token == address(0) || _vault == address(0) || _treasury == address(0)) revert InvalidAddress();
        
        TOKEN = IERC20(_token);
        vault = _vault;
        treasury = _treasury;
        feeBps = _feeBps;
        minFee = _minFee;
        
        if (_initialExecutor != address(0)) {
            executors[_initialExecutor] = true;
        }
        executors[msg.sender] = true;
    }

    // ============ Core Functions ============

    function executeCreate(
        address from,
        uint256 amount,
        bytes32 recipientId
    ) external onlyExecutor nonReentrant returns (uint256 iouId) {
        if (from == address(0)) revert InvalidAddress();
        
        uint256 calculatedFee = (amount * feeBps) / BPS;
        uint256 fee = calculatedFee > minFee ? calculatedFee : minFee;
        
        if (amount <= fee) revert AmountTooSmall();
        uint256 net = amount - fee;
        uint64 expiry = uint64(block.timestamp + 180 days);

        // GAS OPTIMIZATION: Pull once, push fee
        TOKEN.safeTransferFrom(from, address(this), amount);
        if (fee > 0) {
            TOKEN.safeTransfer(treasury, fee);
        }

        iouId = nextId++;
        ious[iouId] = IOU({
            sender: from,  
            grossAmount: amount,
            netAmount: net,
            recipientId: recipientId,
            expiry: expiry,
            claimed: false,
            refunded: false
        });

        recipientIOUs[recipientId].push(iouId);

        emit IOUCreated(iouId, from, recipientId, amount, net, fee, expiry);
    }

    function batchClaim(
        uint256[] calldata iouIds, 
        address claimant, 
        bytes32 recipientId
    ) external onlyVault nonReentrant {
        if (claimant == address(0)) revert InvalidAddress();
        if (iouIds.length == 0 || iouIds.length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        
        uint256 totalNet = 0;
        uint256 processedCount = 0;

        for (uint256 i = 0; i < iouIds.length; i++) {
            uint256 id = iouIds[i];
            IOU storage iou = ious[id];

            // Safety guard against empty/invalid IOUs
            if (iou.sender == address(0)) continue;

            if (iou.recipientId != recipientId) revert MismatchedRecipient();

            if (!iou.claimed && !iou.refunded) {
                iou.claimed = true;
                totalNet += iou.netAmount;
                processedCount++;
                emit IOUClaimed(id, recipientId, claimant, iou.netAmount);
            }
        }

        if (totalNet > 0) {
            TOKEN.safeTransfer(claimant, totalNet);
            emit BatchClaimed(recipientId, claimant, totalNet, processedCount);
        }
    }

    function batchRefund(uint256[] calldata iouIds) external nonReentrant {
        if (iouIds.length == 0 || iouIds.length > MAX_BATCH_SIZE) revert InvalidBatchSize();

        uint256 totalRefund = 0;
        uint256 processedCount = 0;
        address targetSender = address(0);

        for (uint256 i = 0; i < iouIds.length; i++) {
            uint256 id = iouIds[i];
            IOU storage iou = ious[id];

            // Safety guard
            if (iou.sender == address(0)) continue;

            // Enforce single-sender batches to maintain clean accounting and gas efficiency
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
            TOKEN.safeTransfer(targetSender, totalRefund);
            emit BatchRefunded(targetSender, totalRefund, processedCount);
        }
    }

    // ============ View Functions ============
    
    function getPendingIOUs(bytes32 recipientId) external view returns (uint256[] memory ids, uint256 count) {
        uint256[] memory all = recipientIOUs[recipientId];
        uint256[] memory temp = new uint256[](all.length);
        uint256 c = 0;
        for (uint256 i = 0; i < all.length; i++) {
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

    // ============ Admin Functions ============
    
    function setExecutor(address executor, bool status) external onlyOwner { executors[executor] = status; }
    function setFees(uint256 _feeBps, uint256 _minFee) external onlyOwner { feeBps = _feeBps; minFee = _minFee; }
    function setVault(address _vault) external onlyOwner { 
        if (_vault == address(0)) revert InvalidAddress();
        vault = _vault; 
    }
    function setTreasury(address _treasury) external onlyOwner { 
        if (_treasury == address(0)) revert InvalidAddress();
        treasury = _treasury; 
    }
}