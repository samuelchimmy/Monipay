// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// MoniPay / MiniPay — Gated Access Manager (DRAFT)
// -------------------------------------------------
// Lets a community owner (Discord/Telegram) monetize access to their
// server, channel, or group via recurring stablecoin subscriptions.
// MoniBot reads the on-chain state to grant / revoke access in real time.
//
// NOTE: This contract is a draft adapted from the StormDeskSubscriptions
// reference implementation. Not audited. Subject to change before launch.

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract GatedAccessManager is Ownable, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  IERC20 public paymentToken;
  address public treasury;
  uint256 public platformFeeBps;
  uint256 public minFee;
  uint256 public maxFee;

  struct CommunityTier {
    uint256 fee;
    uint256 duration;
    bool active;
    address commander;
    string discordGuildId;
    string telegramGroupId;
    uint256 gracePeriod;
    uint256 maxMembers;
  }

  struct Subscription {
    uint256 startTime;
    uint256 expiry;
    uint256 graceExpiry;
    uint256 amountPaid;
    bool active;
  }

  struct DiscountCode {
    uint256 discountBps;
    uint256 durationMultiplier;
    uint256 maxUses;
    uint256 usedCount;
    uint256 expiresAt;
    bool active;
  }

  struct NftDiscount {
    address nftContract;
    uint256 discountBps;
    bool active;
    bool stacksWithCode;
  }

  mapping(bytes32 => CommunityTier) public communities;
  mapping(bytes32 => mapping(address => Subscription)) public subscriptions;
  mapping(bytes32 => uint256) public subscriberCount;
  mapping(bytes32 => uint256) public communityRevenue;
  mapping(bytes32 => mapping(string => DiscountCode)) public discounts;
  mapping(bytes32 => NftDiscount) public nftDiscounts;
  mapping(address => bool) public approvedNftCollections;
  mapping(address => bytes32[]) public commanderCommunities;

  event CommunityRegistered(bytes32 indexed communityId, address indexed commander, uint256 fee, uint256 duration);
  event CommunityUpdated(bytes32 indexed communityId);
  event Subscribed(bytes32 indexed communityId, address indexed subscriber, uint256 expiry, uint256 amountPaid, uint256 platformFee, string discountCode);
  event Renewed(bytes32 indexed communityId, address indexed subscriber, uint256 newExpiry, uint256 amountPaid);
  event Refunded(bytes32 indexed communityId, address indexed subscriber, uint256 amount);
  event TreasuryUpdated(address newTreasury);
  event PlatformFeeUpdated(uint256 newFeeBps);
  event PaymentTokenUpdated(address newToken);
  event DiscountCreated(bytes32 indexed communityId, string code);
  event DiscountRevoked(bytes32 indexed communityId, string code);
  event CommunityPaused(bytes32 indexed communityId);
  event CommunityUnpaused(bytes32 indexed communityId);
  event NftCollectionApproved(address indexed nftContract);
  event NftCollectionRevoked(address indexed nftContract);
  event NftDiscountSet(bytes32 indexed communityId, address indexed nftContract, uint256 discountBps);
  event NftDiscountToggled(bytes32 indexed communityId, bool active);

  constructor(address _paymentToken, address _treasury, uint256 _platformFeeBps) Ownable(msg.sender) {
    paymentToken = IERC20(_paymentToken);
    treasury = _treasury;
    platformFeeBps = _platformFeeBps;
    minFee = 1e6;
    maxFee = 10000e6;
  }

  // ── Admin ──
  function setTreasury(address _treasury) external onlyOwner { require(_treasury != address(0), "Zero address"); treasury = _treasury; emit TreasuryUpdated(_treasury); }
  function setPlatformFee(uint256 _feeBps) external onlyOwner { require(_feeBps <= 2000, "Max 20%"); platformFeeBps = _feeBps; emit PlatformFeeUpdated(_feeBps); }
  function setPaymentToken(address _token) external onlyOwner { require(_token != address(0), "Zero address"); paymentToken = IERC20(_token); emit PaymentTokenUpdated(_token); }
  function setFeeLimits(uint256 _min, uint256 _max) external onlyOwner { require(_min < _max, "Invalid range"); minFee = _min; maxFee = _max; }
  function approveNftCollection(address nftContract) external onlyOwner { require(nftContract != address(0), "Zero address"); approvedNftCollections[nftContract] = true; emit NftCollectionApproved(nftContract); }
  function revokeNftCollection(address nftContract) external onlyOwner { approvedNftCollections[nftContract] = false; emit NftCollectionRevoked(nftContract); }
  function pauseCommunity(bytes32 communityId) external onlyOwner { communities[communityId].active = false; emit CommunityPaused(communityId); }
  function unpauseCommunity(bytes32 communityId) external onlyOwner { communities[communityId].active = true; emit CommunityUnpaused(communityId); }
  function pause() external onlyOwner { _pause(); }
  function unpause() external onlyOwner { _unpause(); }
  function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner { IERC20(token).safeTransfer(to, amount); }

  // ── Commander ──
  function registerCommunity(bytes32 communityId, uint256 fee, uint256 durationDays, string calldata discordGuildId, string calldata telegramGroupId, uint256 gracePeriodDays, uint256 maxMembers) external {
    require(fee >= minFee && fee <= maxFee, "Fee out of range");
    require(durationDays > 0 && durationDays <= 365, "Invalid duration");
    require(communities[communityId].commander == address(0), "Community already registered");
    communities[communityId] = CommunityTier({
      fee: fee, duration: durationDays * 1 days, active: true, commander: msg.sender,
      discordGuildId: discordGuildId, telegramGroupId: telegramGroupId,
      gracePeriod: gracePeriodDays * 1 days, maxMembers: maxMembers
    });
    commanderCommunities[msg.sender].push(communityId);
    emit CommunityRegistered(communityId, msg.sender, fee, durationDays);
  }

  function updateCommunity(bytes32 communityId, uint256 fee, uint256 gracePeriodDays, uint256 maxMembers) external {
    require(communities[communityId].commander == msg.sender, "Not commander");
    require(fee >= minFee && fee <= maxFee, "Fee out of range");
    communities[communityId].fee = fee;
    communities[communityId].gracePeriod = gracePeriodDays * 1 days;
    communities[communityId].maxMembers = maxMembers;
    emit CommunityUpdated(communityId);
  }

  function createDiscount(bytes32 communityId, string calldata code, uint256 discountBps, uint256 durationMultiplier, uint256 maxUses, uint256 validForDays) external {
    require(communities[communityId].commander == msg.sender, "Not commander");
    require(discountBps <= 9000, "Max 90% discount");
    require(durationMultiplier >= 1, "Multiplier must be >= 1");
    discounts[communityId][code] = DiscountCode({
      discountBps: discountBps, durationMultiplier: durationMultiplier,
      maxUses: maxUses, usedCount: 0,
      expiresAt: block.timestamp + validForDays * 1 days, active: true
    });
    emit DiscountCreated(communityId, code);
  }

  function revokeDiscount(bytes32 communityId, string calldata code) external {
    require(communities[communityId].commander == msg.sender, "Not commander");
    discounts[communityId][code].active = false;
    emit DiscountRevoked(communityId, code);
  }

  function setNftDiscount(bytes32 communityId, address nftContract, uint256 discountBps, bool stacksWithCode, bool active) external {
    require(communities[communityId].commander == msg.sender, "Not commander");
    require(approvedNftCollections[nftContract], "NFT not approved");
    require(discountBps > 0 && discountBps <= 9000, "Invalid discount");
    nftDiscounts[communityId] = NftDiscount({ nftContract: nftContract, discountBps: discountBps, stacksWithCode: stacksWithCode, active: active });
    emit NftDiscountSet(communityId, nftContract, discountBps);
  }

  function toggleNftDiscount(bytes32 communityId, bool active) external {
    require(communities[communityId].commander == msg.sender, "Not commander");
    nftDiscounts[communityId].active = active;
    emit NftDiscountToggled(communityId, active);
  }

  // ── Subscriptions ──
  function _applyDiscounts(bytes32 communityId, uint256 baseAmount, uint256 periods, string calldata discountCode) private returns (uint256 finalAmount) {
    finalAmount = baseAmount;
    if (bytes(discountCode).length > 0) {
      DiscountCode storage dc = discounts[communityId][discountCode];
      require(dc.active, "Invalid discount code");
      require(block.timestamp < dc.expiresAt, "Discount expired");
      require(dc.maxUses == 0 || dc.usedCount < dc.maxUses, "Discount exhausted");
      require(periods >= dc.durationMultiplier, "Discount requires more periods");
      finalAmount = baseAmount - (baseAmount * dc.discountBps / 10000);
      dc.usedCount++;
    }
    NftDiscount storage nd = nftDiscounts[communityId];
    if (nd.active && nd.nftContract != address(0)) {
      if (IERC721(nd.nftContract).balanceOf(msg.sender) > 0) {
        if (bytes(discountCode).length == 0 || nd.stacksWithCode) {
          finalAmount = finalAmount - (finalAmount * nd.discountBps / 10000);
        }
      }
    }
  }

  function _writeSubscription(bytes32 communityId, uint256 finalDuration, uint256 commanderAmount, uint256 platformFee, string calldata discountCode) private {
    CommunityTier storage tier = communities[communityId];
    Subscription storage sub = subscriptions[communityId][msg.sender];
    bool isNew = !sub.active || block.timestamp > sub.graceExpiry;
    uint256 newExpiry = isNew ? block.timestamp + finalDuration : sub.expiry + finalDuration;
    subscriptions[communityId][msg.sender] = Subscription({
      startTime: isNew ? block.timestamp : sub.startTime,
      expiry: newExpiry, graceExpiry: newExpiry + tier.gracePeriod,
      amountPaid: commanderAmount, active: true
    });
    if (isNew) {
      subscriberCount[communityId]++;
      communityRevenue[communityId] += (commanderAmount + platformFee);
      emit Subscribed(communityId, msg.sender, newExpiry, commanderAmount, platformFee, discountCode);
    } else {
      communityRevenue[communityId] += (commanderAmount + platformFee);
      emit Renewed(communityId, msg.sender, newExpiry, commanderAmount);
    }
  }

  function subscribe(bytes32 communityId, uint256 periods, string calldata discountCode) external nonReentrant whenNotPaused {
    CommunityTier storage tier = communities[communityId];
    require(tier.active, "Community not active");
    require(periods >= 1 && periods <= 12, "Invalid periods");
    Subscription storage sub = subscriptions[communityId][msg.sender];
    bool isNew = !sub.active || block.timestamp > sub.graceExpiry;
    if (tier.maxMembers > 0 && isNew) {
      require(subscriberCount[communityId] < tier.maxMembers, "Community full");
    }
    uint256 baseAmount = tier.fee * periods;
    uint256 finalDuration = tier.duration * periods;
    uint256 finalAmount = _applyDiscounts(communityId, baseAmount, periods, discountCode);
    uint256 platformFee = finalAmount * platformFeeBps / 10000;
    uint256 commanderAmount = finalAmount - platformFee;
    paymentToken.safeTransferFrom(msg.sender, address(this), finalAmount);
    if (platformFee > 0) paymentToken.safeTransfer(treasury, platformFee);
    if (commanderAmount > 0) paymentToken.safeTransfer(tier.commander, commanderAmount);
    _writeSubscription(communityId, finalDuration, commanderAmount, platformFee, discountCode);
  }

  function refund(bytes32 communityId, address subscriber, uint256 amount) external nonReentrant {
    require(communities[communityId].commander == msg.sender, "Not commander");
    require(amount > 0, "Amount zero");
    paymentToken.safeTransferFrom(msg.sender, subscriber, amount);
    Subscription storage sub = subscriptions[communityId][subscriber];
    if (sub.active) {
      sub.active = false;
      if (subscriberCount[communityId] > 0) subscriberCount[communityId]--;
    }
    if (communityRevenue[communityId] >= amount) communityRevenue[communityId] -= amount;
    else communityRevenue[communityId] = 0;
    emit Refunded(communityId, subscriber, amount);
  }

  function removeLapsedSubscriber(bytes32 communityId, address subscriber) external {
    Subscription storage sub = subscriptions[communityId][subscriber];
    require(sub.active, "Not active");
    require(block.timestamp > sub.graceExpiry, "Grace period not expired");
    sub.active = false;
    if (subscriberCount[communityId] > 0) subscriberCount[communityId]--;
  }

  // ── Views ──
  function isSubscribed(bytes32 communityId, address subscriber) external view returns (bool) {
    Subscription storage sub = subscriptions[communityId][subscriber];
    return sub.active && block.timestamp <= sub.expiry;
  }

  function isInGrace(bytes32 communityId, address subscriber) external view returns (bool) {
    Subscription storage sub = subscriptions[communityId][subscriber];
    return sub.active && block.timestamp > sub.expiry && block.timestamp <= sub.graceExpiry;
  }

  function getSubscription(bytes32 communityId, address subscriber) external view returns (Subscription memory) { return subscriptions[communityId][subscriber]; }
  function getCommunity(bytes32 communityId) external view returns (CommunityTier memory) { return communities[communityId]; }
  function getCommanderCommunities(address commander) external view returns (bytes32[] memory) { return commanderCommunities[commander]; }

  function previewSubscriptionCost(bytes32 communityId, uint256 periods, string calldata discountCode, address holderAddress)
    external view returns (uint256 grossAmount, uint256 discountAmount, uint256 nftDiscountAmount, uint256 platformFee, uint256 commanderReceives, uint256 finalCharged)
  {
    CommunityTier storage tier = communities[communityId];
    grossAmount = tier.fee * periods;
    finalCharged = grossAmount;
    if (bytes(discountCode).length > 0) {
      DiscountCode storage dc = discounts[communityId][discountCode];
      if (dc.active && block.timestamp < dc.expiresAt && periods >= dc.durationMultiplier && (dc.maxUses == 0 || dc.usedCount < dc.maxUses)) {
        discountAmount = grossAmount * dc.discountBps / 10000;
        finalCharged = grossAmount - discountAmount;
      }
    }
    if (holderAddress != address(0)) {
      NftDiscount storage nd = nftDiscounts[communityId];
      if (nd.active && nd.nftContract != address(0)) {
        bool holdsNft = IERC721(nd.nftContract).balanceOf(holderAddress) > 0;
        if (holdsNft && (bytes(discountCode).length == 0 || nd.stacksWithCode)) {
          nftDiscountAmount = finalCharged * nd.discountBps / 10000;
          finalCharged = finalCharged - nftDiscountAmount;
        }
      }
    }
    platformFee = finalCharged * platformFeeBps / 10000;
    commanderReceives = finalCharged - platformFee;
  }
}