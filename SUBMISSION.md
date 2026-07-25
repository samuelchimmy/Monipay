# Celo Builders Hackathon Project Submission: Monipay

## Project Metadata
- **Project Name:** Monipay
- **Tagline:** The social payments layer for stablecoins, powered by autonomous AI agents.
- **Celo Network:** celo-mainnet
- **GitHub Repository:** [https://github.com/samuelchimmy/paytag-duo-flow](https://github.com/samuelchimmy/paytag-duo-flow)
- **Demo URL:** [https://monipay.xyz/minipay](https://monipay.xyz/minipay)
- **Video URL:** [https://youtu.be/bI4qPHx0AwE?si=QISklc0UZj1twfqE](https://youtu.be/bI4qPHx0AwE?si=QISklc0UZj1twfqE)
- **Social Link:** [https://x.com/i/status/2062968794683941028](https://x.com/i/status/2062968794683941028)

## Selected Tracks
- best-agent
- 8004scan-rank
- most-activity

## Selected Bounties
- best-agent-1st
- best-agent-2nd
- best-agent-3rd
- 8004scan-rank-1st

## Contract Addresses
### V1 (Currently Active)
- MoniPayRouter: `0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0`
- MoniBotRouter: `0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e`
- MagicPayIOURegistry: `0x6bB3C64C382fcF8fB65b24234C455bB62b155742`

### V2 (Deployed & Verified)
- MoniPayRouterV2: `0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE`
- MoniBotRouterV2: `0x8768aCE3FCd925e9BD61808b90905a935697e227`
- IOURegistryV2: `0x89218866374DF22c74a0F44ae648bfA9de8BD31e`

## Project Description

Monipay is an AI-powered social payments layer that enables financial intents to be executed directly inside social conversations on X, Telegram, and Discord. By bridging social identities and onchain actions, Monipay enables users and autonomous agents to process stablecoin transfers using rails they are already familiar with-such as usernames, social timelines, and natural language commands.

Ecosystem Impact & Onboarding:
  * MiniPay Integration: Our demo is designed specifically to run inside Celo's flagship mobile app to enable millions of mobile users to act on financial intents where those conversations are happening.
  * Onboarding Flywheel: By routing payments directly to social usernames (even if the recipient does not have a wallet yet via MagicPay), we remove web3 onboarding friction and create an active user acquisition flywheel.

Key Features:
  * MoniTag setup and social identity onboarding
  * Social account linking (X, Discord, Telegram)
  * Agent spending permissions
  * CasualPay: Peer-to-peer payments between Monipay users
  * MagicPay: Walletless/claimable payments to social usernames (no pre-existing wallet required)
  * Natural language payment commands
  * Scheduled & recurring payments
  * Cross-platform agent interactions
  * Gated Access Manager for Telegram & Discord (Roadmap feature)

Conditional Sports P2P (New Feature):
Inspired by the excitement of the World Cup 2026, where timelines are filled with match predictions and friendly banter, this feature is NOT a bet. It is specifically designed to allow users to reward their community/followers for correct match outcomes automatically, without locking up funds in escrow or managing spreadsheets.
  * How it works: Senders post a natural language tweet tagging @monibot (e.g., "Hey @monibot send $10 to @jade if Germany wins Curacao").
  * Zero Escrow: Funds remain in the sender's wallet. MoniBot registers the job and executes the payment only if the condition is met.
  * 3-Source Consensus Sports Oracle: For a feature that moves money based on results, no single free source is good enough. You want a primary + fallback + sanity check, and only settle when ≥2 agree. This is why we designed a custom 3-Source Consensus Sports Oracle. MoniBot queries three independent data layers: football-data.org (as our primary source), API-Football (api-sports.io, as our independent fallback), and the openfootball repository on GitHub (as our sanity check). By requiring a majority consensus of at least 2 out of 3 feeds agreeing on the final scores and completion status, we protect the protocol against single-point API failures, server downtime, and malicious data tampering. In the event of a dispute where the sources disagree, the MoniBot AI Agent triggers a Dispute Safety Lock, halting automatic execution and marking the transaction for manual review.
  * Supported Conditions:
    - Win/Loss: "if Germany wins Curacao" or "if Germany beats Curacao" (resolves to home_win or away_win)
    - Draw: "if Germany draws Curacao", "if they tie", "if they end level" (resolves to draw)
    - Correct Score: "if Germany beats Spain 2-1" or "if Germany Spain 2:1" (requires exact score line)
    - BTTS and Over/Under conditions are NOT supported.
  * MagicPay Integration: Recipients do not need a pre-existing crypto wallet. Payments are routed directly to their Twitter username, sending a notification so they can claim funds at any time.

ERC-8004 Metadata, Registries & Agent Endpoints:
  * ERC-8004 Agent Registry (Base): https://8004scan.io/agents/base/51818
  * ERC-8004 Agent Registry (BSC): https://8004scan.io/agents/bsc/96451
  * ERC-8004 Agent Registry (Celo): https://8004scan.io/agents/celo/9103
  * KarmaHQ Project Profile: https://karmahq.xyz/project/monipay
  * ERC-8004 Metadata URL: https://monipay.xyz/agent.json (Describes agent capabilities, registries, supported chains, and trust signals)
  * Model Context Protocol (MCP) Tools: https://monipay.xyz/.well-known/mcp.json (Allows peer-to-peer agent integrations)
  * Agent-to-Agent (A2A) Card: https://monipay.xyz/.well-known/agent-card.json (Exposes communication protocols)
  * Public Reputation Service: https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-reputation (Aggregates trust scores, active campaigns, volume, and transaction statistics)
  * Premium Reputation Feed (x402 Paywall): https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-x402/reputation-premium (Priced at 0.001 USDC on Celo, provides detailed per-user trust history)

Contracts (V1 - Active):
- MoniPayRouter: 0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0
- MoniBotRouter: 0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e
- MagicPayIOURegistry: 0x6bB3C64C382fcF8fB65b24234C455bB62b155742

Contracts (V2 - Deployed & Verified):
- MoniPayRouterV2: 0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE
- MoniBotRouterV2: 0x8768aCE3FCd925e9BD61808b90905a935697e227
- IOURegistryV2: 0x89218866374DF22c74a0F44ae648bfA9de8BD31e

Note on Identity Verification (Self.xyz):
We intended to integrate self.xyz identity verification; however, the self.xyz verification service is currently not working/accessible in Nigeria, preventing us from completing that verification flow.

The Demo URL should be opened inside MiniPay dev mode.

## AI Agent Contribution Notes

I helped the builder gather project details, verify the codebase state by running tests, and prepare this submission draft using the Celo Builders skill, including updating the draft with detailed specifications on Conditional Sports P2P, Agent Endpoints (ERC-8004, MCP, A2A, x402), and Self.xyz verification limitations. Note: The Demo URL should be opened inside MiniPay dev mode.
