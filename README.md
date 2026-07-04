<div align="center">

# Monipay

**The AI-powered social payment layer for Celo MiniPay users.**

Send stablecoins to anyone on X (Twitter), Telegram, Discord, and WhatsApp directly from inside MiniPay, without ever leaving your social feed.

[![Celo](https://img.shields.io/badge/Network-Celo%20Mainnet-FCFF52?style=flat-square&logo=celo&logoColor=000)](https://celoscan.io)
[![MiniPay](https://img.shields.io/badge/Wallet-MiniPay-00C65E?style=flat-square)](https://minipay.opera.com)
[![Chain ID](https://img.shields.io/badge/Chain%20ID-42220-blue?style=flat-square)](https://celoscan.io)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

</div>

---

## What Monipay Does

Monipay is a non-custodial social payment layer built specifically for Celo and MiniPay. It connects MiniPay wallets to social platforms so users can send USDT, USDC, USDm, and G$ to anyone using only a social handle. No wallet address is needed, no app switching, no friction.

The system is built on two core smart contract primitives. Every feature in Monipay routes through one of them.

---

## The Two Core Primitives

### CasualPay (Direct Transfer via PayTag)

When the recipient already has a Monipay account, payment is immediate and direct. The sender types a natural language command such as `!monibot send $5 to @alice`. MoniBot resolves `@alice` to their registered Celo wallet address, verifies the sender's active spending allowance against the `MoniBotRouter` contract, and executes a gasless transfer on Celo in a single atomic transaction. The transaction splits the 1% platform fee to the treasury and delivers the remaining 99% to the recipient.

On Celo, MiniPay users are stored in a dedicated `wallet_profiles` table. The bot's unified profile lookup queries the standard `profiles` table first, then falls back to `wallet_profiles`. If either the sender or recipient is a MiniPay user, the execution chain is automatically forced to Celo. Attempting to send a MiniPay user funds on Base or BSC is caught with `ERROR_MINIPAY_RECIPIENT_CHAIN_RESTRICTION` before any gas is consumed.

### MagicPay (IOU Escrow Registry)

When the recipient has no wallet or Monipay account, funds are not dropped. They are locked in the `IOURegistry` smart contract. The sender's tokens are held in escrow on-chain and the recipient receives a notification on their social platform. When they link their social account through verified OAuth or HMAC widget signatures, the relayer calls `batchClaim`, the contract computes their `recipientId` from the hash, and releases the funds to their newly registered wallet.

If the recipient never claims before expiry, the sender calls `batchRefund` directly on the contract. The platform cannot block or delay this.

**Privacy:** Social handles are never written to the blockchain. The contract identifies recipients by a `keccak256` hash:

```
keccak256(abi.encodePacked(platform, ":", userId))
```

This exact formula is computed identically in the frontend (`src/lib/iouRegistry.ts`), the backend bots (`blockchain.js`), and the Solidity contract, making it the single source of truth for recipient identity.

---

## MiniPay-Specific Architecture

### How Monipay Runs Inside MiniPay

Monipay detects the MiniPay shell at runtime via `window.ethereum.isMiniPay`. When this flag is true, the app activates a dedicated dashboard (`MiniPayDashboard.tsx`) and several MiniPay-specific behaviors:

**Transaction format.** MiniPay requires legacy transaction format. All approval and payment transactions sent via `window.ethereum` omit `maxFeePerGas` and `maxPriorityFeePerGas`.

**Gas currency.** Instead of paying gas in native CELO, every transaction includes `feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a"` (USDm). This lets MiniPay users pay gas entirely in stablecoins, which is a hard requirement of the MiniPay environment.

**Gasless activation.** Before prompting the user to approve, `gasGuard.ts` calls the `activation-funder` edge function to ensure the wallet has enough native gas. For Celo, the system waits 8 seconds after funding to account for the approximate 5-second block time before asking the user to sign.

**Non-custodial boundary.** Monipay holds no private keys. Every approval and signature request routes through the MiniPay injected provider. No transaction can execute without the user confirming it in their native MiniPay wallet prompt.

### The Celo Relayer (`relay-payment-celo`)

MiniPay users on Celo use a dedicated `relay-payment-celo` Supabase edge function instead of the shared multi-chain relay. This isolation ensures zero risk to the live Base and BSC flows during Celo-specific iterations. The function:

1. Verifies the EIP-712 `PaymentAuthorization` signature from the user's MiniPay wallet.
2. Checks the on-chain nonce via `isNonceUsed` to reject replay attempts before broadcasting.
3. Validates the `deadline` field. Signatures expire one hour after creation at the block level.
4. Calls `relayPayment(from, to, amount, fee, nonce, deadline, signature)` on the `MoniPayRouter`.
5. Enforces rate limits: 5 relay transactions per minute per wallet, 10 per minute per IP address.

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

The signed struct is a `PaymentAuthorization` containing `from`, `to`, `amount`, `fee`, `nonce`, and `deadline`. The nonce is fetched directly from the contract by scanning `isNonceUsed` sequentially to find the next unused slot. The deadline is set to one hour from the time of signing.

---

## MoniBot: AI Agentic Payment Commands

MoniBot is the AI agent that lives on Telegram, Discord, and X (Twitter). It parses natural language payment commands, resolves identities, and executes transactions through the two core primitives.

### Command Types

**Instant P2P Transfer**
```
!monibot send $5 to @alice
```
Resolves `@alice` across both `profiles` and `wallet_profiles`. If `@alice` is a MiniPay user, execution is locked to Celo. Routes to `MoniBotRouter` for registered recipients and `IOURegistry` for unregistered ones.

**Batch Multisend**
```
!monibot send $1 each to @alice, @bob, @charlie
```
The `multiRecipient.js` handler processes each recipient individually. MiniPay chain restrictions are checked per recipient. If one recipient fails validation, that payment is logged and skipped while the rest of the batch continues uninterrupted.

**Recurring Payments**
```
!monibot send $20 to @alice every month, 5 times
```
Intent is registered off-chain. At each scheduled interval, the `scheduler.js` resolves the recipient's current state and routes dynamically. MiniPay senders are restricted to Celo at every execution, not only at the time of registration.

**Conditional Oracle Payments**
```
!monibot send $10 to @bob if Arsenal wins today
```
Handled by `sportsOracle.js`. No funds are locked upfront. MoniBot monitors the oracle outcome and, when the condition resolves, pulls from the sender's active `MoniBotRouter` allowance. If the recipient is unregistered at resolution time, funds go directly to `IOURegistry`.

**Campaign Grants**
The `MoniBotRouter` includes an `executeGrant(to, amount, campaignId)` function with idempotency protection via `isGrantIssued(campaignId, recipient)`. Campaign funds are held in the contract and can only be disbursed by whitelisted `executor` wallets. Each `(campaignId, recipient)` pair can only receive a grant once, enforced on-chain.

### Nigerian Pidgin and Local Slang Parsing

MoniBot includes a `pidgin.js` module that detects and normalizes Nigerian Pidgin English commands before they reach the AI parser. A command like:

```
abeg dash @chidi 5k sharp sharp
```

is recognized through a vocabulary of Pidgin verbs (`dash`, `settle`, `chook`, `wire`, `spray`), money slang (`raba`, `ego`, `kudi`, `mulla`), and confirmation phrases (`abeg`, `oya`, `no wahala`). This directly addresses the primary MiniPay user base in West Africa.

### Nonce Collision Prevention

The bot's `blockchain.js` implements a per-chain Mutex pattern to prevent nonce collisions when the oracle fires multiple jobs simultaneously:

```javascript
class Mutex {
  run(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
}
```

Each chain maintains its own mutex and in-memory cached nonce. The nonce is fetched once using `blockTag: 'pending'` and incremented for each sequential transaction. On any failure, the cached nonce is cleared so the next job fetches a fresh value from the network.

### RPC Failover

Every on-chain read and write loops through a priority-ordered list of RPC endpoints. Infrastructure failures such as rate limits, timeouts, and connection errors rotate to the next endpoint automatically. Real contract errors such as insufficient balance, invalid allowance, or duplicate nonce throw immediately without burning retries.

Celo RPC pool in priority order:

- `forno.celo.org` (Celo Foundation)
- `rpc.ankr.com/celo`
- `1rpc.io/celo`
- `celo-rpc.publicnode.com`
- `celo.llamarpc.com`
- `celo-pokt.nodies.app`

---

## Social Identity Verification

Linking a social account to a wallet controls who can claim escrow funds and who MoniBot will send to. Every link is cryptographically verified.

**Telegram.** The `social-identity` edge function receives the Telegram Login Widget payload and verifies the HMAC-SHA256 signature using the `TELEGRAM_BOT_TOKEN` as the secret key. This follows Telegram's official server-side verification scheme. If the signature does not match, the link is rejected before any database write.

**X (Twitter) and Discord.** Both use OAuth 2.0 with PKCE. The authorization code and code verifier are exchanged directly against the platform's official token endpoints before the identity is registered.

**Duplicate link protection.** The `social-identity` function checks both the `profiles` and `wallet_profiles` tables before writing. If a social ID is already linked to a different account, it returns a conflict response that surfaces in the MiniPay dashboard UI as a `LinkConflictModal`.

---

## Security Controls

### HMAC Request Signing

All edge function calls from the app include `x-request-timestamp` and `x-request-signature` headers. The server verifies the HMAC-SHA256 signature of `timestamp.body` using a shared secret and rejects any request with a timestamp older than 5 minutes.

### Rate Limits

| Action | Limit |
| :--- | :--- |
| Relay transactions per wallet | 5 per minute |
| Relay transactions per IP | 10 per minute |
| Account registration per IP | 3 per 10 minutes |
| PayTag lookup | 30 per minute |
| AI command parsing | 15 per minute |

### Admin Origin Restriction

Sensitive write endpoints validate the HTTP `Origin` header against an allowlist of Monipay domains. Requests from unknown origins are rejected with a 403 before any database write occurs.

---

## Deployed Smart Contracts

### Celo Mainnet

| Contract | Address | Role |
| :--- | :--- | :--- |
| MoniPayRouter V1 | `0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0` | EIP-712 gasless relay |
| MoniPayRouter V2 | `0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE` | EIP-712 gasless relay (current) |
| IOURegistry V1 | `0x6bB3C64C382fcF8fB65b24234C455bB62b155742` | MagicPay escrow |
| IOURegistry V2 | `0x89218866374DF22c74a0F44ae648bfA9de8BD31e` | MagicPay escrow (current) |
| MoniBotRouter V1 | `0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e` | AI agent delegated transfers |
| MoniBotRouter V2 | `0x8768aCE3FCd925e9BD61808b90905a935697e227` | AI agent delegated transfers (current) |

All contracts are verified on [CeloScan](https://celoscan.io).

**Supported Celo tokens:** USDT (`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`), USDC (`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`), USDm (`0x765DE816845861e75A25fCA122bb6898B8B1282a`), G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`)

### Other Networks

| Network | MoniBotRouter | IOURegistry |
| :--- | :--- | :--- |
| Base | `0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516` | `0x1945c633659Ae71991aE37eE2Bdfe64E00514650` |
| BSC | `0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E` | `0xF602b559eE5c51ED122F667d101be105d9eDf90d` |
| Ink | `0x046875a42B8F79E72349d38CB8225cbd6d24C7c5` | `0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08` |

---

## Spending Allowances

MoniBot uses a standard ERC-20 `approve()` flow against the `MoniBotRouter`. Users set a specific spending limit inside the MiniPay dashboard. This limit is never infinite by default and requires explicit user action to configure. The `MoniBotRouter` checks the live allowance before executing any transfer, and the off-chain relayer mirrors this check before submitting any RPC call. The user can reset the allowance to zero instantly through the dashboard or by calling the token contract directly from their MiniPay wallet.

CasualPay direct transfers and MagicPay IOU creation do not use spending allowances. Every such transaction is individually prompted and signed through the MiniPay native wallet prompt.

---

## Treasury

The Monipay treasury address is `0xDC9B47551734bE984D7Aa2a365251E002f8FF2D7`. The 1% platform fee (minimum $0.05) is collected as part of the on-chain transaction, not via a separate transfer, so it is atomic and transparent on-chain.

---

<div align="center">
Built for Celo. Built for MiniPay. Built for the social internet.
</div>
