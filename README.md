<div align="center">
  <h1>🟡 Monipay</h1>
  <p><b>The AI-powered social payment layer for Celo MiniPay users.</b></p>
  <p>Enable MiniPay users to send stablecoin payments directly on X (Twitter), WhatsApp, Telegram & Discord.</p>
</div>

---

## ⚡ Overview

Monipay bridges the gap between Web3 non-custodial wallets and everyday social interactions. Built entirely around the **MiniPay sandbox architecture** on the Celo network, Monipay allows users to execute gasless, stablecoin (cUSD, USDT, USDC) transactions using natural language—even in local dialects like Nigerian Pidgin.

Everything routes through the user's secure MiniPay wallet using two core smart contract primitives: **CasualPay** (Direct Transfer) and **MagicPay** (Escrow IOU).

## 🚀 Core Features

### 1. CasualPay (Direct PayTag Transfers)
For recipients who are already registered in the ecosystem. 
- **How it works:** Sender uses a simple natural language command (e.g., `!monibot send $5 to @alice`).
- **Execution:** Settles immediately on-chain using the `MoniBotRouter`.
- **Security:** Verified against the sender's active spending allowance and executed in a single atomic transaction.

### 2. MagicPay (IOU Escrow Registry)
For recipients who do not have a wallet or haven't registered yet.
- **How it works:** Tokens are locked in the `IOURegistry` smart contract.
- **Claiming:** The recipient receives a notification on their social platform. Once they authenticate via secure OAuth (linking their social identity), the funds are unlocked.
- **Refunds:** Senders can directly call `batchRefund` on-chain to retrieve their tokens if the recipient never claims them.

## 🤖 MoniBot: AI Agentic Features

Monipay utilizes advanced LLM parsing to execute complex routing instructions directly from social platforms:
- **Multisend (Batch P2P):** `send $1 each to @alice, @bob, and @charlie`
- **Programmable Recurring Payments:** `send $20 to @landlord every month, 5 times`
- **Conditional Payments (Oracle Triggered):** `send $10 to @jade if Arsenal wins today`
- **Cross-Chain Auto-Routing:** Frictionless stablecoin delivery leveraging Celo's fast block times while supporting Base, BSC, and Ink interoperability.
- **Nigerian Pidgin Parsing:** `abeg send 5k cUSD to @chidi` is perfectly understood and routed.

## 🛡️ MiniPay-First Security Architecture

Monipay is **100% non-custodial**. 
- **No Private Keys:** The system never holds private keys. All transactions are signed by the user's native MiniPay wallet.
- **Strict Allowances:** MoniBot operates on user-defined spending limits. Users can revoke allowances instantly on-chain.
- **On-Chain Nonce Tracking:** Cryptographic signatures have block-level deadlines and nonce tracking to prevent replay attacks.
- **Identity Privacy:** Social handles (like Telegram usernames) are obfuscated on-chain using `keccak256` hashing. Only the hashed identifier is written to the `IOURegistry`.
- **Verified Deployments:** All core contracts (`MoniPayRouter`, `IOURegistry`, `MoniBotRouter`) are fully verified on Celo Mainnet.

## 🔗 How it Works (Under the Hood)

1. **Intention Parsing:** User tags MoniBot on Telegram, Discord, or X with a payment instruction.
2. **Identity Resolution:** The relayer maps the mentioned handle to a registered Celo address.
3. **Allowance Check:** If direct routing is possible, the relayer verifies the active allowance.
4. **Execution/Escrow:** 
   - *Registered:* Funds routed immediately via `MoniPayRouter`.
   - *Unregistered:* Funds locked in `IOURegistry` pending a secure social login claim.

## 📜 Smart Contracts (Celo Mainnet)

| Contract | Address |
| :--- | :--- |
| **MoniPayRouter (V2)** | `0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE` |
| **IOURegistry (V2)** | `0x89218866374DF22c74a0F44ae648bfA9de8BD31e` |
| **MoniBotRouter (V2)** | `0x8768aCE3FCd925e9BD61808b90905a935697e227` |

---

<div align="center">
  <i>Building the seamless financial layer for the social internet. Powered by Celo.</i>
</div>
