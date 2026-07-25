# SpaceDrift — Celo Builders publish prep

Standalone. No MoniPay reference anywhere (separate builder, separate email
edoziesammy101@gmail.com, separate wallet 0xfa2B…5fcf). Do NOT cross-link.

Draft already saved: projectName **SpaceDrift**, status **draft**,
attributionTag **`celo_43d45a3403c1`** (locked), track **askbots**,
github samuelchimmy/SPACEDRIFT, appDomain spacedrift.space,
agentWallet 0xfa2B8eD012f756E22E780B772d604af4575d5fcf.

## Two blockers to publish (must exist first)

1. `erc8004Url` — an 8004scan.io / celoscan.io link (needs wallet)
2. `socialLink` — a public X/Twitter post (you post it)

Execute in this order: **ERC-8004 first → tweet (links it) → publish.**

---

## 1) ERC-8004 identity (wallet signatures — you sign)

Register SpaceDrift on Aigora (aigora.org) — mints the ERC-8004 identity in the
canonical registry, which also makes it viewable on 8004scan.io for the
`erc8004Url` field.

**Aigora field sheet (copy-paste):**

- **Name:** `SpaceDrift`
- **Profile image:** `https://spacedrift.space/icons/icon-512.png` (confirm this path resolves; else use any square logo URL on spacedrift.space)
- **Description (50–1024 chars):**
  > SpaceDrift is a mobile-first 3D vector space-shooter on Celo, optimized for
  > MiniPay. Players enter skill-based match pools using stablecoins (USDm, USDC,
  > USDT) and compete across four on-chain game modes — Daily Ranked, Wave Streak,
  > 1v1 Arena, and Co-op Run — with smart-contract prize pools that split payouts
  > automatically. An autonomous score-attestation service signs each run with
  > EIP-191 and settles results on-chain via the SpaceDriftV2 contract, preventing
  > client-side score falsification. Segregated per-token pools mean no oracle and
  > no peg risk. All game activity is publicly verifiable on Celo.
- **Service endpoint (≥1 required, must be public https):**
  - Type **Web** · `https://spacedrift.space` · "Live game (MiniPay-optimized web client)"
- **Skills (optional):** `onchain-gaming`, `score-attestation`, `prize-pool-settlement`
- **Categories:** Automation, Trading
- **Links:** Website `https://spacedrift.space` · GitHub `https://github.com/samuelchimmy/SPACEDRIFT` · Analytics `https://dune.com/jadeofwallstreet/spacedrift-celo-game-analytics`
- **Network:** BOTH — register twice via the Aigora mainnet↔testnet toggle.

**Network plan (DECIDED: both):**
- Run A — **Celo Sepolia (testnet)**: free gas (Sepolia faucet). Satisfies the
  hackathon "register on testnet" instruction. Save the aigora.org/services URL.
- Run B — **Celo mainnet**: small real CELO gas. Produces the
  `8004scan.io/agents/celo/<id>` link — THIS is what we submit to `erc8004Url`
  (matches the field's allowed hosts + MoniPay's accepted /agents/celo/9103).
Each run = 2 signatures (register mint + setAgentURI). Paste BOTH URLs back.

Contracts (for reference / contractAddresses field):
- SpaceDriftV2 (active): `0xf753e8fde882cf6cdc06361a6abcc49df3a2bcf5` (Celo mainnet)
- SpaceDrift V1 (legacy): `0x6fac4059d42942e31b7c802963d60b6c08567626`

---

## 2) X / Twitter post (you post, paste URL back)

Post from SpaceDrift's X account (or your personal — just not framed as MoniPay).
Fill in the ERC-8004 link once you have it from step 1.

> I'm building for the @CeloDevs Agentic Payments & DeFAI Hackathon 🟡
>
> SpaceDrift — a mobile-first 3D space-shooter on @Celo with on-chain stablecoin
> prize pools (Ranked, Streak, 1v1, Co-op), optimized for MiniPay.
>
> Registered onchain → [ERC-8004 LINK]
>
> Let's go! 🚀🕹️

---

## 3) Full submission payload (I send on publish)

```json
{
  "projectName": "SpaceDrift",
  "tagline": "A mobile-first 3D space-shooter on Celo with on-chain stablecoin prize pools.",
  "description": "<long description — see below>",
  "trackIds": ["askbots"],
  "bountyIds": ["askbots-prize-pool"],
  "githubUrl": "https://github.com/samuelchimmy/SPACEDRIFT",
  "demoUrl": "https://spacedrift.space",
  "socialLink": "<X post URL>",
  "celoNetwork": "celo-mainnet",
  "contractAddresses": ["0xf753e8fde882cf6cdc06361a6abcc49df3a2bcf5"],
  "agentContributionNotes": "Agent helped verify the codebase state, assemble the submission draft, and register the judge agent for the AskBots track.",
  "customFields": {
    "telegram": "@jakesully1",
    "appDomain": "https://spacedrift.space",
    "agentWalletAddress": "0xfa2B8eD012f756E22E780B772d604af4575d5fcf",
    "erc8004Url": "<8004scan.io link from step 1>"
  }
}
```
