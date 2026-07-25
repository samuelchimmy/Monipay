# MoniBot ERC-8004 Boost Strategy Guide

This guide outlines the strategic steps to optimize MoniBot's rank and visibility on the **ERC-8004 (Trustless Agents)** standard, specifically targeting high performance on the **Celo** registration.

---

## 1. Identity Optimization (The Passport)

Your agent’s identity is its "Resume." To rank high, it must be verifiable and rich in metadata.

### 1.1 Update the Agent URI
- **Action:** Ensure the `agentURI` on the Identity Registry (ERC-721) points to a decentralized, persistent JSON file.
- **Identity Registry Address:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **MoniBot Agent IDs:**
    - **Celo:** `9103`
    - **Base:** `51818`
    - **BSC:** `96451`
- **How to do it:**
    1. Host `agent.json` (see section 1.2) on IPFS or the MoniPay public directory.
    2. Call `setAgentURI(uint256 agentId, string calldata newURI)` on the ERC-8004 Identity Registry contract.
- **What to write:** Use a permanent URI scheme like `ipfs://<CID>` or a stable production URL `https://monipay.xyz/agent.json`.

### 1.2 The `agent.json` Specification
Include these fields in your registration file:
```json
{
  "name": "MoniBot",
  "description": "Autonomous AI financial agent for social commerce. Interprets natural language intents to execute gasless on-chain payments, escrow (MagicPay), and campaign grants.",
  "image": "https://monipay.xyz/og/monibot.png",
  "external_url": "https://monipay.xyz/monibot",
  "capabilities": ["P2P Payments", "Social Escrow", "Campaign Grants", "Multi-recipient Batching"],
  "ai_engine": "Gemini 2.0 Flash",
  "framework": "Custom Node.js + Viem",
  "registrations": [
    { "agentId": 9103, "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" },
    { "agentId": 51818, "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" },
    { "agentId": 96451, "agentRegistry": "eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }
  ],
  "socials": {
    "twitter": "@monibot",
    "telegram": "monipaybot",
    "discord": "monibot#4480"
  }
}
```

---

## 2. Reputation Strategy (The Credit Score)

Reputation is earned via consistent, successful on-chain behavior.

### 2.1 Maximize Transaction Volume & Success Rate
- **Target:** Celo Mainnet.
- **Tactic:** Run "Gasless Celo Campaigns" frequently. Since MoniBot sponsors the gas, high volume can be generated at low cost.
- **Logic:** Ensure every `executeP2P` or `executeGrant` call is logged to a public reputation-tracking indexer.

### 2.2 Collect Attestations
- **Form to fill:** Use the **Reputation Registry** `submitFeedback` function.
- **Implementation:** After a successful Twitter reply, include a call-to-action: *"Rate this transaction at 8004scan.io to boost MoniBot's trust score!"*
- **Automated Feedback:** Partner with other ERC-8004 agents to perform mutual attestations for successful cross-agent interactions.

### 2.3 Reputation API
Create an API that allows explorers to query MoniBot's performance live.
- **Endpoint:** `https://monipay.xyz/api/v1/monibot/reputation`
- **Output:** JSON containing `total_transactions`, `success_rate`, `uptime_days`, and `staked_amount`.

---

## 3. Validation & Trust (The Proof)

High-ranking agents use cryptographic proofs to verify their execution.

### 3.1 Verifiable Execution Layer
- **Current:** MoniBot uses Gemini 2.0 Flash + signed EIP-712 intents.
- **Future Upgrade:** Implement **TEE (Trusted Execution Environment)** attestations for the Worker Bot process. This proves the code running on the server is exactly what is committed to GitHub.
- **ZK Proofs:** For high-value transactions, use zk-SNARKs to prove the agent followed correct logic without revealing private API keys.

### 3.2 Economic Staking
- **Action:** Stake CELO or USDT in the ERC-8004 **Validation Registry**.
- **Reasoning:** Staking acts as "skin in the game." If the agent acts maliciously, the stake can be slashed. High-stake agents are ranked higher in "Safety" leaderboards.

---

## 4. Ranking Boost Checklist (Celo Focus)

To dominate the Celo Agent Leaderboard:

1. [ ] **Verify on 8004scan.io:** Connect the MoniBot deployer wallet and claim the profile.
2. [ ] **Complete the "Human Link":** Use Celo’s SocialConnect or a similar protocol to link the bot's wallet to the verified `@monibot` X account.
3. [ ] **Update Celo Metadata:** In the Identity Registry, ensure the `metadata` field explicitly mentions "Native Celo USDT Support" and "Gasless execution via MoniPay Celo Router."
4. [ ] **Submit to QuickNode Explorer:** Fill out the [QuickNode ERC-8004 Agent Submission Form](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/).
5. [ ] **A2A / MCP Integration:** Advertise that MoniBot is "MCP (Model Context Protocol) Ready" to allow other agents to call its payment functions.

---

## 5. Forms and Portals to Update

| Portal | Action | URL |
|--------|--------|-----|
| **8004scan** | Claim Profile & Add Socials | [8004scan.io](https://8004scan.io) |
| **QuickNode Explorer** | Submit Agent for Indexing | [QuickNode.com](https://blog.quicknode.com) |
| **Celo Governance** | Present MoniBot as a Public Good Agent | [Celo Forum](https://forum.celo.org) |
| **Ethereum EIP Hub** | Ensure compliance with the latest EIP-8004 draft | [eips.ethereum.org](https://eips.ethereum.org) |

---

## 6. Reputation API Implementation Sketch

We will create a Supabase Edge Function `monibot-reputation` that returns:
```json
{
  "agentId": "monibot-001",
  "rank_signals": {
    "total_tx_evm": 12450,
    "success_rate": 0.998,
    "active_campaigns": 5,
    "trust_score": 98,
    "last_active": "2026-06-01T12:00:00Z"
  }
}
```

*Generated by MoniPay Engineering Team for ERC-8004 Compliance.*
