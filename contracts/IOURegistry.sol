// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOURegistry
 * @notice Stores mapping of social identities (Telegram, Discord, X) to Celo addresses.
 * Used for walletless social payments in the Monipay ecosystem.
 */
contract IOURegistry {
    struct SocialIdentity {
        string platform;
        string userId;
        address walletAddress;
        uint256 createdAt;
    }

    // platform => userId => walletAddress
    mapping(string => mapping(string => address)) private _registry;
    mapping(address => string[]) private _userIdentities;

    event IdentityLinked(address indexed wallet, string platform, string userId);
    event IdentityUnlinked(address indexed wallet, string platform, string userId);
