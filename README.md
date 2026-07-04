<div align="center">

# Monipay

**The AI-powered social payment layer for Celo MiniPay users.**

Send stablecoins to anyone on X (Twitter), Telegram, Discord, and WhatsApp directly from inside MiniPay, without ever leaving your social feed.

[![Celo](https://img.shields.io/badge/Network-Celo%20Mainnet-FCFF52?style=flat-square&logo=celo&logoColor=000)](https://celoscan.io)
[![MiniPay](https://img.shields.io/badge/Wallet-MiniPay-00C65E?style=flat-square)](https://minipay.opera.com)
[![Chain ID](https://img.shields.io/badge/Chain%20ID-42220-blue?style=flat-square)](https://celoscan.io)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered%20Agent-purple?style=flat-square)](https://8004scan.io/agents/celo/9103)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

[Open in MiniPay](https://monipay.xyz/minipay) · [Live App](https://monipay.xyz) · [Security Docs](https://docs.monipay.xyz/minipay-security) · [X/Twitter](https://x.com/monipay_xyz) · [Mention MoniBot](https://x.com/monibot) · [MoniBot on Telegram](https://t.me/monipaybot?startgroup=new) · [MoniBot on Discord](https://top.gg/discord/servers/813055720311959552?s=0da542dd50950) · [KarmaHQ](https://karmahq.xyz/project/monipay)

</div>

---

> **For MiniPay reviewers:** Open [https://monipay.xyz/minipay](https://monipay.xyz/minipay) inside MiniPay Test Mode (MiniPay app → Settings → Developer → Test Mode). The app detects the injected wallet automatically and loads the full AI payment dashboard with zero clicks and zero account creation.

---

## What Monipay Does

Monipay is a non-custodial AI-powered social payment layer built specifically for Celo and MiniPay. It connects MiniPay wallets to social platforms so users can send USDT, USDC, USDm, and G$ to anyone using only a social handle via natural language commands. No wallet address needed, no app switching, no friction.

The system is built on two core smart contract primitives. Every feature routes through one of them, determined dynamically by whether the recipient is registered.

---
## Core Features: CasualPay & MagicPay (Routing)

Monipay's application logic routes all social payments through two core primitives, determined dynamically by the recipient's registration state:

### CasualPay (MoniBot Direct Transfer)

Used when the recipient has a registered `@PayTag` or linked social identity. Settles immediately on-chain using the `MoniBotRouter` contract under the sender's active spending allowance.

### MagicPay (IOU Registry Escrow)

Used as a fallback escrow registry when the recipient is not yet a registered Monipay user. Tokens are locked on-chain in the `IOURegistry` contract until claimed via verified social account links.

---

### CasualPay Execution Flow

1. **Resolution**
   MoniBot parses the recipient `@PayTag` or linked social handle from the user's natural language command, querying the database resolver to retrieve the recipient's registered Celo address.

2. **Allowance Validation**
   Before submitting, the relayer verifies that the transaction amount is within the sender's active spending allowance granted to the `MoniBotRouter` contract. The allowance is checked both in the database mirror and verified directly on-chain.

3. **Execution**
   The `MoniBotRouter` contract processes the gasless payment on behalf of the user, splits the 1% platform fee to the treasury address, and transfers the remaining 99% to the recipient in a single atomic transaction.

---

### MagicPay Escrow Flow

1. **On-Chain Lock**
   The sender locks stablecoins (USDT, G$, USDC, or USDm) into the `IOURegistry` smart contract. The transaction specifies the expiration block and the hashed identifier of the recipient.

2. **Claim Verification**
   When the recipient links their verified social account (verified via a [Secure claim](https://docs.monipay.xyz/minipay-security#identity-privacy)), the relayer invokes `batchClaim`. The contract releases the locked funds to the recipient's address.

3. **Refund Option**
   If the recipient does not claim the funds before the expiration date, the sender is free to call `batchRefund` directly on the contract to retrieve their tokens. The platform cannot block or override this function.
   
## Three Ways to Access Monipay

Monipay is a multi-access protocol. The `/minipay` route has distinct behavior depending on how it is opened.

**Path A: Inside the MiniPay WebView (Primary Celo Integration)**

When a user opens Monipay from within the MiniPay app, `window.ethereum.isMiniPay` resolves to `true`. The app reads the injected wallet address directly from the MiniPay provider, calls the `wallet-session` edge function to upsert the user into `wallet_profiles`, and renders the dedicated `MiniPayDashboard`. No PIN is needed and no private key is held by the app. The user signs everything through the native MiniPay prompt. Chain is Celo only. Gas is sponsored.

**Path B: Web Browser with an External Wallet (WalletConnect)**

When the same `/minipay` route is opened in a regular browser, the app surfaces a three-option chooser: create a new MoniTag account, log in with an external wallet via WalletConnect, or restore a legacy Monipay account. External wallet users access the full multi-chain experience across Celo, Base, BSC, and Ink.

**Path C: Legacy Monipay Account Holders Inside MiniPay**

If a user who previously registered a full Monipay account opens the MiniPay link, the `wallet-session` edge function detects their existing `profiles` record and sets `isLegacy: true`. The app renders `WalletDashboard` in MiniPay session mode, giving them full access to their PayTag, transaction history, MoniBot settings, and merchant features while transacting on Celo.

---

## Core Features: CasualPay and MagicPay

Monipay routes all social payments through two primitives, selected dynamically based on the recipient's registration state.

### CasualPay (Direct Transfer)

Used when the recipient has a registered PayTag or linked social identity. Settles immediately on-chain via the `MoniBotRouter` contract under the sender's active spending allowance.

**Execution flow:**

1. **Resolution.** MoniBot parses the recipient handle from the natural language command and queries the database resolver to retrieve their registered Celo address. To protect against username hijacking, resolution anchors to the platform's permanent, immutable numeric user ID (Twitter numeric ID, Discord snowflake, Telegram ID), not the handle text. Name changes cannot intercept pending payments.

2. **Allowance validation.** The relayer verifies the transaction amount is within the sender's active spending allowance granted to `MoniBotRouter`. The allowance is checked in the database mirror first, then verified directly on-chain, before any RPC call is made.

3. **Execution.** `MoniBotRouter` processes the gasless payment, splits the 1% platform fee to the treasury address, and transfers 99% to the recipient in a single atomic transaction.

### MagicPay (IOU Escrow)

Used as a fallback when the recipient is not yet a registered Monipay user. Tokens are locked on-chain in the `IOURegistry` contract until the recipient claims them via a verified social account link.

**Execution flow:**

1. **On-chain lock.** The sender locks stablecoins into `IOURegistry`. The transaction specifies the expiration block and the hashed recipient identifier. The recipient's social handle is never written to the chain.

2. **Claim verification.** When the recipient links their verified social account, the relayer invokes `batchClaim`. The contract computes `keccak256(abi.encodePacked(platform, ":", userId))` to match the stored hash and releases funds to the recipient's address.

3. **Refund option.** If the recipient does not claim before expiry, the sender calls `batchRefund` directly on the contract. The platform cannot block, delay, or intercept this function. Emergency situations are also covered by OpenZeppelin's `Pausable` module which allows temporary suspension of deposits and claims during black-swan events, but the owner has no custody or withdrawal rights over escrowed funds at any time.

**Wrong-recipient rescue.** If a user accidentally specifies the wrong handle and the unintended recipient is not yet registered, funds are routed to `IOURegistry`. The sender can delete the social command to prevent visibility, wait for expiry, and call `batchRefund` for a full recovery. If the unintended recipient is already registered, the transaction settles immediately via CasualPay, and the user's configured daily bot allowance limits total exposure.

---

## MiniPay-Specific Architecture

### CIP-64 Fee Abstraction

All transactions submitted inside MiniPay implement Celo Improvement Proposal 64 (CIP-64), the Celo standard for fee currency abstraction. The `sendTransaction` path in `useWalletSession.ts` strips EIP-1559 fields (`maxFeePerGas`, `maxPriorityFeePerGas`) and injects `feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a"` (USDm). MiniPay users never need native CELO in their wallet to pay gas.

### EIP-712 Payment Signing

The frontend (`src/lib/celoWallet.ts`) signs typed data using the following domain:

```typescript
{
  name: "MoniPay Router",
  version: "1",
  chainId: 42220,
  verifyingContract: CELO_MONIPAY_ROUTER
}
```

The signed struct is a `PaymentAuthorization` containing `from`, `to`, `amount`, `fee`, `nonce`, and `deadline`. The nonce is fetched by scanning `isNonceUsed` on-chain to find the next unused slot. The deadline is set to one hour from signing time. The contract enforces `require(block.timestamp <= deadline, "Payment authorization expired")`, which prevents latency manipulation by the relayer.

### The Celo Relayer (`relay-payment-celo`)

MiniPay users use a dedicated `relay-payment-celo` edge function isolated from the shared multi-chain relay, ensuring zero risk to Base and BSC flows during Celo-specific iterations. The function verifies the EIP-712 signature, checks `isNonceUsed` to reject replays, validates the deadline at the block level, then calls `relayPayment(from, to, amount, fee, nonce, deadline, signature)` on the `MoniPayRouter`. Nonces are marked as used on-chain the moment a transaction finishes, making any duplicate submission with the same nonce immediately rejected.

After beta, the public RPC endpoints will be replaced with a dedicated private RPC node for improved throughput, reduced latency, and higher reliability under sustained load.

### Gasless Activation

Before prompting a user to approve the router, `gasGuard.ts` calls the `activation-funder` edge function to verify the wallet has enough native gas. For Celo, the system waits 8 seconds after funding to account for the approximate 5-second block time.

### On-Chain Security Controls

**Cryptographic signature verification.** The `MoniBotRouter` and `MoniPayRouter` require valid EIP-712 signatures on all payloads. The contract recovers the signer address on-chain using `ecrecover`. If the recovered address does not match the authorizing wallet, the transaction reverts.

**Replay protection.** Nonces are tracked per address via `isNonceUsed(address user, uint256 nonce)`. A previously marked nonce cannot be reused.

**Reentrancy and safe transfers.** The `IOURegistry` inherits OpenZeppelin's `ReentrancyGuard` against recursive claim exploits. All token movements use `SafeERC20` (`safeTransfer`, `safeTransferFrom`) for secure integration with USDT, USDC, and G$.

**Compiler-level safety.** All contracts are compiled with Solidity 0.8.x, providing built-in overflow and underflow protection.

---

## Spending Approvals and MiniPay Compatibility

MiniPay takes standing allowances seriously. Monipay is designed to address every concern raised by the MiniPay team directly in the architecture.

MoniBot uses standard ERC-20 `approve()` against the `MoniBotRouter`. This allowance is:

- Never pre-authorized or set to infinite by default. The user must set a specific value inside the dashboard before any bot command can execute.
- Enforced on-chain by `MoniBotRouter` before executing any transfer. Commands exceeding the allowance revert at the contract level.
- Checked off-chain by the relayer in the database mirror before any RPC call is made, so oversized commands are rejected before gas is consumed.
- Instantly revocable. The user sets allowance to zero from the dashboard or by calling the token contract directly from their MiniPay wallet.

Monipay is prepared to implement any additional constraints for the MiniPay environment, including hardcoded frontend transaction ceilings, lower per-command allowance recommendations, explicit confirmation screens displaying token, amount, fee, and recipient before any delegated allowance is set, cooldown windows between repeated bot actions, and prominent user education flows.

CasualPay direct dashboard transfers and MagicPay IOU creation bypass the bot allowance entirely. Every such transaction is individually signed by the user through the MiniPay native wallet prompt. No delegation is involved.

---

## AI Agent Security Pipeline

MoniBot enforces a strict 4-layer security pipeline before any transaction reaches the chain.

**Layer 1: Input sanitization.** Every incoming message passes through a local sanitizer. Messages over 500 characters are blocked. Lookalike Unicode characters are normalized. HTML/XML tags and hidden JSON text are stripped to prevent format manipulation.

**Layer 2: Prompt injection guard.** Clean messages are scanned by regex for known attack patterns, including instruction overrides ("ignore all previous instructions"), persona hijacks ("DAN mode", "act as admin"), and extraction attempts ("repeat your system prompt"). Flagged messages are blocked instantly without calling the AI.

**Layer 3: Deterministic JSON extractor.** Safe messages are sent to the AI. The model operates inside a system prompt boundary that forces JSON-only output. The user message is wrapped in `<user_message>` tags so the model treats it as input data, not instructions. If the AI detects a bypass attempt, it self-flags with `{"_rejected":"injection_detected"}`.

**Layer 4: Output validation.** The AI's output is validated against a strict schema before any on-chain action. Unsupported action types and chains are rejected. Amounts above $10,000 are blocked. Recipients are checked against a blocklist (e.g. `everyone`, `here`, `channel`). Batch size is capped at 50 recipients.

**Layer 5: On-chain spending cap.** MoniBot can only execute via `MoniBotRouter`, which enforces the user's configured ERC-20 spending cap on-chain. No pipeline bypass can exceed this limit.

---

## MoniBot: AI Agentic Payment Commands

MoniBot lives on Telegram, Discord, and X (Twitter). It parses natural language payment commands and routes execution through CasualPay or MagicPay depending on recipient state.

### Command Types

**Instant P2P Transfer**
```
!monibot send $5 to @alice
```
Resolves `@alice` by immutable numeric ID. Routes to `MoniBotRouter` (registered) or `IOURegistry` (unregistered). MiniPay recipients are locked to Celo. Attempting to send a MiniPay user funds on Base or BSC is caught with `ERROR_MINIPAY_RECIPIENT_CHAIN_RESTRICTION` before gas is consumed.

**Batch Multisend**
```
!monibot send $1 each to @alice, @bob, @charlie
```
The relayer calculates the total batch amount and checks sender balance and allowances before submitting. Each recipient is resolved independently. Self-send guards and a 50-recipient cap are enforced. Failures are logged and skipped without halting the rest of the batch.

**Scheduled Payments**
```
!monibot send $10 to @alice on Friday
```
Intent is registered off-chain. The sender can view or cancel any pending payment at any time. At the scheduled block, the relayer evaluates the recipient's current state and verifies active balance and allowances before routing.

**Recurring Payments**
```
!monibot send $20 to @alice every month, 5 times
```
Each installment is executed as an individual transaction. The sender can cancel the series at any time via the dashboard or with a natural language cancel command. Allowances are verified before every individual run.

**Conditional Oracle Payments**
```
!monibot send $10 to @bob if Arsenal wins today
```
No funds are locked upfront. MoniBot registers the trigger intent and monitors outcome via a 3-source sports oracle (football-data.org as primary, API-Football as fallback, openfootball as sanity check). Majority consensus of at least 2 out of 3 sources is required before any execution. If sources disagree, a Dispute Safety Lock halts execution and marks the transaction for manual review. Upon resolution, payout is pulled from the sender's active `MoniBotRouter` allowance. Senders retain full capital efficiency throughout and can cancel at any time by revoking the allowance.

**Campaign Grants**
`MoniBotRouter` includes `executeGrant(to, amount, campaignId)` with idempotency via `isGrantIssued(campaignId, recipient)`. Each `(campaignId, recipient)` pair receives a grant exactly once, enforced on-chain. Campaign grant evaluation is powered by Gemini 2.0 Flash which actively defends against spam, bot patterns, self-referral loops, and template farming.

### Nigerian Pidgin and Local Slang Parsing

MoniBot includes a `pidgin.js` module that normalizes Nigerian Pidgin English commands before they reach the AI parser:

```
abeg dash @chidi 5k sharp sharp
```

Recognized via a vocabulary of Pidgin verbs (`dash`, `settle`, `chook`, `wire`, `spray`), money slang (`raba`, `ego`, `kudi`, `mulla`), and confirmation phrases (`abeg`, `oya`, `no wahala`). This directly addresses the primary MiniPay user base in West Africa.

### The Two-Bot System

MoniBot operates as two isolated services to ensure no single point of failure can halt the financial layer.

| Service | Role | Responsibility |
| :--- | :--- | :--- |
| Worker Bot | The Silent Executor | Polls social platforms, parses commands, evaluates intent, executes on-chain via `MoniBotRouter`, logs to shared ledger |
| Reply Bot | The Social Voice | Reads transaction logs, generates context-aware confirmations via Gemini, posts verifiable receipts to the social platform |

Each chain runs its own isolated worker and reply service on Railway.

### Nonce Collision Prevention

The bot's `blockchain.js` implements a per-chain Mutex pattern for concurrent oracle bursts:

```javascript
class Mutex {
  run(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
}
```

The nonce is fetched once using `blockTag: 'pending'` and incremented in-memory for each sequential transaction. On failure, the cached nonce is cleared so the next job fetches fresh from the network.

### RPC Failover

Infrastructure failures (rate limits, timeouts, `ECONNREFUSED`, `ETIMEDOUT`, `Bad Gateway`) rotate to the next endpoint. Real contract errors throw immediately without burning retries.

Celo RPC pool: `forno.celo.org` (Celo Foundation), `rpc.ankr.com/celo`, `1rpc.io/celo`, `celo-rpc.publicnode.com`, `celo.llamarpc.com`, `celo-pokt.nodies.app`

---

## Social Identity Verification

**Telegram.** The `social-identity` edge function receives the Telegram Login Widget payload and verifies the HMAC-SHA256 signature using the `TELEGRAM_BOT_TOKEN` as the secret key. If the signature does not match, the link is rejected before any database write.

**X (Twitter).** Verified using OAuth 2.0 with PKCE directly against X's official identity endpoints.

**Discord.** Verified using standard Confidential Client OAuth 2.0. The authorization code is exchanged server-side with a hidden client secret.

**Bluesky.** Verified via AT Protocol session authentication using user-generated App Passwords.

**Duplicate link protection.** The `social-identity` function checks both `profiles` and `wallet_profiles` tables before writing. If a social ID is already linked to a different account, the request is rejected and the conflict surfaces in the UI as a `LinkConflictModal`.

**Data in transit.** All API requests between client and edge functions are encrypted over HTTPS using TLS 1.3. Profile metadata is isolated using PostgreSQL Row-Level Security (RLS) policies, ensuring records can only be accessed by verified profile owners.

---

## Off-Chain Security Controls

### HMAC Request Signing

All edge function calls include `x-request-timestamp` and `x-request-signature` headers. The server verifies `HMAC-SHA256(timestamp.body)` against a shared secret and rejects requests with timestamps older than 5 minutes, preventing replay attacks at the API layer.

### Rate Limits

| Action | Limit |
| :--- | :--- |
| Relay transactions per wallet | 5 per minute |
| Relay transactions per IP | 10 per minute |
| Account registration per IP | 3 per 10 minutes |
| PayTag lookup | 30 per minute |
| AI command parsing | 15 per minute |

### Admin Origin Restriction

Write endpoints validate the HTTP `Origin` header against an allowlist of Monipay domains. Requests from unknown origins are rejected with a 403 before any database write occurs.

---

## Merchant Features (Legacy and WalletConnect Users)

Legacy account holders and WalletConnect users on Path B and Path C have access to the full Monipay merchant suite in addition to social payments:

- **Point-of-Sale Dashboard.** Any smartphone becomes a zero-hardware POS terminal. Products are pinned to a quick-add grid for one-tap checkout.
- **QR Scan-to-Pay.** The customer scans the merchant's QR, confirms the amount, and the payment settles on-chain in seconds.
- **Product Catalog.** Full inventory management with categories, images, and pricing.
- **Invoice System.** Invoices sent by MoniTag with full payment status tracking.
- **Customer CRM.** Tracks repeat buyers, total spend, and purchase history.
- **Analytics Dashboard.** Revenue tracking and transaction history.
- **Developer Payment Gateway.** API key pairs (`pk_live_` / `sk_live_`), shareable payment links (`monipay.xyz/pay/pl_abc123`), hosted checkout, and HMAC-SHA256 signed webhooks for `payment.completed` events.
- **Subscriptions and Access Control.** Recurring stablecoin subscription flows for gated Telegram and Discord community access.

---

## ERC-8004 Agent Identity

MoniBot is a registered ERC-8004 Trustless Agent, providing an on-chain verifiable identity and reputation registry across all supported chains.

| Chain | Registry |
| :--- | :--- |
| Celo | [8004scan.io/agents/celo/9103](https://8004scan.io/agents/celo/9103) |
| Base | [8004scan.io/agents/base/51818](https://8004scan.io/agents/base/51818) |
| BSC | [8004scan.io/agents/bsc/96451](https://8004scan.io/agents/bsc/96451) |

Every payment, grant, and subscription managed by MoniBot is anchored to this on-chain reputation and validation registry.

---

## Deployed Smart Contracts

### Celo Mainnet

Both V1 and V2 contracts are active. The codebase routes between them via the `VITE_USE_V2_CONTRACTS` flag. V1 remains deployed and functional for existing allowances and unclaimed IOUs.

| Contract | V1 | V2 |
| :--- | :--- | :--- |
| MoniPayRouter | [0xd66C...88Bd2b0](https://celoscan.io/address/0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0) | [0x39E7...D1dEE](https://celoscan.io/address/0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE) |
| IOURegistry | [0x6bB3...155742](https://celoscan.io/address/0x6bB3C64C382fcF8fB65b24234C455bB62b155742) | [0x8921...BD31e](https://celoscan.io/address/0x89218866374DF22c74a0F44ae648bfA9de8BD31e) |
| MoniBotRouter | [0x2a6F...E138B9e](https://celoscan.io/address/0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e) | [0x8768...e227](https://celoscan.io/address/0x8768aCE3FCd925e9BD61808b90905a935697e227) |

**Supported Celo tokens:** USDT (`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`), USDC (`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`), USDm (`0x765DE816845861e75A25fCA122bb6898B8B1282a`), G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`)

G$ (GoodDollar) is a Celo-native UBI token that shares its primary user base with MiniPay across emerging markets in West Africa. Supporting G$ as a first-class payment token means Monipay reaches users who are already active on Celo but may not hold USDT or USDC.

### Other Active Networks

| Network | Token | MoniPayRouter | MoniBotRouter | IOURegistry |
| :--- | :--- | :--- | :--- | :--- |
| Base | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x4048d18F71E723647f83B61202362425C5a7D2c0` | `0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516` | `0x1945c633659Ae71991aE37eE2Bdfe64E00514650` |
| BSC | USDT `0x55d398326f99059fF775485246999027B3197955` | `0x557285AbC46038E898d90eB00943Ff42c4Fbcb54` | `0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E` | `0xF602b559eE5c51ED122F667d101be105d9eDf90d` |
| Ink | USDT0 `0x0200C29006150606B650577BBE7B6248F58470c1` | `0xb5f22E6a45Bc8992DE276Ed4d3aD8626D382E76b` | `0x046875a42B8F79E72349d38CB8225cbd6d24C7c5` | `0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08` |
| Tempo | aUSD `0x20c0000000000000000000000000000000000001` | `0xa39C3B7e02686cf7F226337525515c694318BDb9` | `0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc` | not deployed |

**Treasury:** `0xDC9B47551734bE984D7Aa2a365251E002f8FF2D7` (all chains)

---

## What Comes Next

The immediate roadmap for Celo and MiniPay centers on enabling P2P transfers directly inside social chats. MiniPay users will be able to send stablecoins to anyone on WhatsApp inside active chat threads, and when WhatsApp usernames roll out more broadly, to any contact by username alone. This makes Monipay the payment layer for conversations that are already happening, without requiring the recipient to download anything or open a separate app.

---

## Links

| | |
| :--- | :--- |
| MiniPay App | [monipay.xyz/minipay](https://monipay.xyz/minipay) |
| Main App | [monipay.xyz](https://monipay.xyz) |
| Security Architecture | [docs.monipay.xyz/minipay-security](https://docs.monipay.xyz/minipay-security) |
| Docs | [docs.monipay.xyz](https://docs.monipay.xyz) |
| X/Twitter | [@monipay_xyz](https://x.com/monipay_xyz) |
| MoniBot on X | [@monibot](https://x.com/monibot) |
| MoniBot on Telegram | [t.me/monipaybot](https://t.me/monipaybot?startgroup=new) |
| MoniBot on Discord | [top.gg listing](https://top.gg/discord/servers/813055720311959552?s=0da542dd50950) |
| KarmaHQ | [karmahq.xyz/project/monipay](https://karmahq.xyz/project/monipay) |
| DappBay (BNB Chain) | [dappbay.bnbchain.org/detail/monipay](https://dappbay.bnbchain.org/detail/monipay) |
| ERC-8004 Agent (Celo) | [8004scan.io/agents/celo/9103](https://8004scan.io/agents/celo/9103) |

---

<div align="center">
Built for Celo. Built for MiniPay. Built for the social internet.
</div>
