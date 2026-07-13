// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIOURegistry {
    struct IOU {
        address sender;
        address token;
        uint256 grossAmount;
        uint256 netAmount;
        bytes32 recipientId;
        uint64  expiry;
        bool    claimed;
        bool    refunded;
    }

    function create(address token, uint256 amount, bytes32 recipientId, uint64 expiry) external returns (uint256);
    function claim(uint256 iouId, address claimant) external;
    function refund(uint256 iouId) external;
    function ious(uint256 iouId) external view returns (
        address sender, address token, uint256 grossAmount, uint256 netAmount,
        bytes32 recipientId, uint64 expiry, bool claimed, bool refunded
    );
    function getRecipientIOUIDs(bytes32 recipientId) external view returns (uint256[] memory);
    function getPendingIOUs(bytes32 recipientId) external view returns (uint256[] memory ids, uint256 count);

    event IOUCreated(uint256 indexed iouId, address indexed sender, bytes32 indexed recipientId, address token, uint256 grossAmount, uint256 netAmount, uint256 fee, uint64 expiry);
    event IOUClaimed(uint256 indexed iouId, bytes32 indexed recipientId, address indexed claimant, uint256 amount);
    event IOURefunded(uint256 indexed iouId, address indexed sender, uint256 amount);
}
