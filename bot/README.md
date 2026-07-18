# MoniBot 🤖 - MoniPay's Autonomous Transaction Layer

**MoniBot** is the core Worker (Backend) for MoniPay's on-chain social layer. It is a **silent, resilient** service responsible for all USDC transfers via the **MoniBotRouter** smart contract. Its public-facing interaction is handled by its twin: **MoniBot-VP-Social**.

---

## 🔗 Architecture Overview: The Two-Bot System

This project is split into two autonomous services for stability and zero-cost Twitter write access:

| Bot | Role | Responsibilities |
|-----|------|------------------|
| **MoniBot (This Repo)** | The Worker | Reads Twitter, executes blockchain transfers via Router, logs outcomes to Supabase |
| **MoniBot-VP-Social** | The Social Agent | Reads transaction logs, generates AI replies, posts to Twitter via OAuth 2.0 |

**Repo Links:**
- 🔧 [MoniBot Worker](https://github.com/samuelchimmy/monibot)
- 💬 [MoniBot-VP-Social](https://github.com/samuelchimmy/monibot-vp-social)

---

## 🏗️ Smart Contract Architecture (v2.0)

MoniBot now uses the **MoniBotRouter** smart contract as a trusted executor, replacing direct `transferFrom` calls.

### Why the Router?

| Before (Direct Transfer) | After (Router Contract) |
|--------------------------|-------------------------|
| Bot wallet calls `transferFrom` directly | Bot calls Router's `executeP2P` |
| Users approve **bot's wallet** | Users approve **Router contract** |
| Two transactions (payment + fee) | Single atomic transaction |
| Off-chain deduplication only | On-chain nonce + tweet ID protection |
| Fee calculation in bot code | Fee calculation in contract |

### Contract Details

```
MoniBotRouter: 0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516
USDC (Base):   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Treasury:      0xfa2B8eD012f756E22E780B772d604af4575d5fcf
Chain:         Base Mainnet (8453)
```

### Fee Structure
- **Platform Fee:** 1% or $0.05 minimum (whichever is greater)
- **Fee Recipient:** Platform Treasury (hardcoded in contract)

---

## ⚡ Core Features

### 1. Recurring & Scheduled Payments
MoniBot supports natural language payment scheduling and series management directly from X:
* **One-Time Schedule:** `"@monibot send $5 to @alice in 10 minutes"`
* **Recurring Payments (Series):** `"@monibot send $5 to @alice every day 5 times"`
* **Series Management:** Users can manage their active series by tweeting `"@monibot cancel series [id]"`, `"@monibot series status [id]"`, or `"@monibot my series"`.

### 2. Conditional Sports P2P (World Cup Promo)
Automated conditional payment routing based on live World Cup 2026 match outcomes:
* **Syntax:** `"@monibot send $20 to @jade if Nigeria wins Brazil"`
* **3-Source Consensus Sports Oracle:** Secures prediction payouts using consensus from 3 independent sources (`football-data.org` as primary, `API-Football` (api-sports.io) as fallback, and `openfootball` on GitHub as sanity check). It requires agreement from at least 2 sources to resolve, and automatically triggers a **Dispute Safety Lock** (halting the job for manual admin resolution) if there is any data conflict or disagreement. Includes a 10-minute match stabilization gate.
* **Recipient Resolution Fallback:** Stores the recipient's permanent Twitter numeric ID at creation, falling back to MagicPay automatically if they deregister before match resolution.
* **Nonce Collision Mutex:** Restricts transaction submission using a Mutex to serialize EVM nonces, ensuring smooth processing during peak transaction bursts.

#### 📊 Supported Conditions & Outcomes
The bot evaluates match outcomes strictly using settled API fixture data:
* **Win/Loss Conditions**:
  * *Syntax:* `if Germany wins Curacao`, `if Germany beats Curacao`
  * *Resolves to:* `home_win` or `away_win` (determined by the predicted winner's role in the official match schedule).
* **Draw Conditions**:
  * *Syntax:* `if Germany draws Curacao`, `if they tie`, `if they end level`
  * *Resolves to:* `draw` (match ends with equal scores).
* **Correct Score / Exact Score**:
  * *Syntax:* `if Germany beats Spain 2-1`, `if Germany Spain 2:1`
  * *Resolves to:* `exact_score` (requires the exact score line to match, e.g. `home_score === 2` and `away_score === 1`).

*Note: Over/Under goal bets (e.g. Over 2) and Both Teams to Score (BTTS) are **not** supported.*

#### 📝 Example Commands
* `"Hey @monibot send $10 to @jade if Germany wins Curacao ⚽"`
* `"Hey @monibot pay @alice $5 if Nigeria draws Canada"`
* `"Hey @monibot slide $15 to @bob if France beats England 2-1"`
* `"Hey @monibot give @charlie $2.50 if Argentina ties Peru"`


---

## 📂 Code Breakdown

### 1. `index.js` — Entry Point

The main orchestrator that initializes all services and runs the polling loop.

```javascript
// Core loop runs every 60 seconds
setInterval(mainLoop, POLL_INTERVAL_MS);
```

**Responsibilities:**
- Validates environment variables
- Initializes Twitter, Gemini, Supabase, and Blockchain clients
- Runs `pollCampaigns()` and `pollCommands()` in sequence
- Handles graceful shutdown (SIGINT/SIGTERM)

---

### 2. `twitter.js` — Twitter Polling & Logic

**Silent Worker Mode:** This module reads Twitter but **never replies**. All outcomes are logged to the database for the Social Agent.

#### `pollCampaigns()`
Processes replies to campaign tweets for grant distribution.

```
Campaign Tweet → User Reply → AI Evaluation → Router.executeGrant() → Log to DB
```

- Fetches recent bot tweets and their replies
- Verifies reply author is X-verified in MoniPay
- Sends to Gemini for grant evaluation
- Executes grant via `executeGrantViaRouter()`
- Logs result with `tx_hash` (or error code)

#### `pollCommands()`
Processes P2P payment commands like `"@monibot send $5 to @alice"`.

```
Command Tweet → Parse Amount/Target → Verify Allowance → Router.executeP2P() → Log to DB
```

- Searches for `@monibot send/pay` mentions
- **Dual Deduplication:** Checks both DB and on-chain state
- Verifies sender's allowance to Router (not bot wallet!)
- Executes via `executeP2PViaRouter()`
- Logs result with `tx_hash` (or error code)

---

### 3. `gemini.js` — AI Decision Making

Uses **Gemini 2.0 Flash** to evaluate campaign replies for grant eligibility.

```javascript
const evaluation = await evaluateCampaignReply({
  campaignTweet: "...",
  reply: "...",
  replyAuthor: "alice",
  targetPayTag: "bob",
  isNewUser: true
});
// Returns: { approved: true, amount: 0.25, reasoning: "..." }
```

#### Grant Tiers
| Tier | Amount | Criteria |
|------|--------|----------|
| REJECT | $0.00 | Spam, bots, low-effort |
| MINIMAL | $0.10 | Basic participation |
| STANDARD | $0.25 | Good engagement, new user |
| QUALITY | $0.50 | Exceptional engagement |
| MAXIMUM | $1.00 | Outstanding (rare) |

#### Anti-Gaming Rules
- Self-tagging → REJECT
- Template/repeated replies → REJECT
- Single emoji/word → REJECT
- Bot patterns → REJECT

---

### 4. `blockchain.js` — Router Contract Interface

Interfaces with the **MoniBotRouter** smart contract on Base Mainnet.

#### `executeP2PViaRouter(from, to, amount, tweetId)`
Executes a P2P transfer using the sender's pre-approved allowance.

```javascript
// Pre-flight checks
const [nonce, balance, allowance, isTweetUsed] = await Promise.all([...]);

// Execute via Router (atomic: payment + fee in one tx)
const hash = await walletClient.writeContract({
  address: MONIBOT_ROUTER_ADDRESS,
  functionName: 'executeP2P',
  args: [from, to, amountInUnits, nonce, tweetId]
});
```

**Security Features:**
- On-chain nonce prevents replay attacks
- Tweet ID stored on-chain prevents duplicate execution
- Contract validates allowance and balance

#### `executeGrantViaRouter(to, amount, campaignId)`
Distributes grants from the Router's USDC balance.

```javascript
// Execute from contract balance
const hash = await walletClient.writeContract({
  address: MONIBOT_ROUTER_ADDRESS,
  functionName: 'executeGrant',
  args: [to, amountInUnits, campaignId]
});
```

**Security Features:**
- Campaign + recipient combination tracked on-chain
- Prevents duplicate grants per campaign

#### View Functions
| Function | Purpose |
|----------|---------|
| `getOnchainAllowance(user)` | Check user's allowance to Router |
| `getUserNonce(user)` | Get user's current nonce |
| `isTweetProcessed(tweetId)` | Check if tweet already executed |
| `isGrantAlreadyIssued(campaignId, recipient)` | Check grant status |
| `calculateFee(amount)` | Get fee and net amount |

---

### 5. `database.js` — Supabase Operations

All database operations use the **Service Role Key** to bypass RLS policies.

#### `logTransaction({ ... })`
**The Core Handshake.** Logs all outcomes for the Social Agent.

```javascript
await logTransaction({
  sender_id: "uuid",
  receiver_id: "uuid",
  amount: 4.95,
  fee: 0.05,
  tx_hash: "0xabc..." | "ERROR_BALANCE",
  type: "p2p_command" | "grant",
  tweet_id: "123456789",
  payer_pay_tag: "alice",
  // replied: false (default - triggers Social Agent)
});
```

#### Error Codes in `tx_hash`
| Code | Meaning |
|------|---------|
| `AI_REJECTED` | Gemini rejected the grant request |
| `ERROR_TARGET_NOT_FOUND` | PayTag not found in database |
| `ERROR_ALLOWANCE` | Insufficient allowance to Router |
| `ERROR_BALANCE` | Insufficient USDC balance |
| `ERROR_DUPLICATE_TWEET` | Tweet already processed on-chain |
| `ERROR_DUPLICATE_GRANT` | Grant already issued for campaign |
| `ERROR_TREASURY_EMPTY` | Router has insufficient USDC |
| `ERROR_BLOCKCHAIN` | Generic network/contract error |

---

## ⚙️ System Flows

### 📢 Campaign Grant Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  VP-Social Bot  │     │   Worker Bot    │     │ MoniBotRouter   │
│  (This Twin)    │     │   (This Repo)   │     │   (Contract)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Tweet Campaign     │                       │
         │◄──────────────────────│                       │
         │                       │                       │
         │      2. User Replies  │                       │
         │      "@alice thanks!" │                       │
         │                       │                       │
         │                       │ 3. Poll Twitter       │
         │                       │ 4. Verify User        │
         │                       │ 5. Gemini Evaluate    │
         │                       │                       │
         │                       │ 6. executeGrant()     │
         │                       │──────────────────────►│
         │                       │                       │ 7. Transfer USDC
         │                       │◄──────────────────────│    (from contract)
         │                       │                       │
         │                       │ 8. Log to DB          │
         │                       │   (replied: false)    │
         │                       │                       │
         │ 9. Poll DB            │                       │
         │ 10. Generate Reply    │                       │
         │ 11. Post to Twitter   │                       │
         │ 12. Set replied: true │                       │
         ▼                       ▼                       ▼
```

### 💸 P2P Command Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      User       │     │   Worker Bot    │     │ MoniBotRouter   │
│                 │     │                 │     │   (Contract)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Tweet Command      │                       │
         │ "@monibot send $5     │                       │
         │  to @jade"            │                       │
         │                       │                       │
         │                       │ 2. Poll Twitter       │
         │                       │ 3. Parse Command      │
         │                       │ 4. Verify Allowance   │
         │                       │    (to Router!)       │
         │                       │                       │
         │                       │ 5. executeP2P()       │
         │                       │──────────────────────►│
         │                       │                       │ 6. transferFrom
         │                       │                       │    (user→recipient)
         │                       │                       │ 7. transferFrom
         │                       │◄──────────────────────│    (user→treasury)
         │                       │                       │
         │                       │ 8. Log to DB          │
         │                       │   (replied: false)    │
         │                       │                       │
         │ 9. VP-Social replies  │                       │
         │◄──────────────────────│                       │
         ▼                       ▼                       ▼
```

---

## 🔐 Environment Variables

```bash
# Twitter API (Read-Only for Worker)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# AI (Campaign Evaluation)
GEMINI_API_KEY=your_gemini_key

# Blockchain (Executor Wallet)
MONIBOT_PRIVATE_KEY=0x...  # Must be authorized on MoniBotRouter
BASE_RPC_URL=https://mainnet.base.org

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Bot Identity
MONIBOT_PROFILE_ID=uuid-of-monibot-profile

# Optional
POLL_INTERVAL_MS=60000          # Default: 60 seconds
ENABLE_CAMPAIGNS=true           # Default: true
ENABLE_P2P_COMMANDS=true        # Default: true
TWITTER_BOT_USER_ID=123456789   # For faster timeline fetch
```

---

## 🚀 Deployment (Railway)

1. **Clone the repo:**
   ```bash
   git clone https://github.com/samuelchimmy/monibot.git
   cd monibot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variables** in Railway dashboard

4. **Authorize the Executor:**
   The bot's wallet must be added as an executor on MoniBotRouter:
   ```solidity
   // Call this from contract owner wallet
   MoniBotRouter.addExecutor(MONIBOT_WALLET_ADDRESS)
   ```

5. **Fund the Router** (for grants):
   ```bash
   # Send USDC to the Router contract address
   # 0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516
   ```

6. **Start the bot:**
   ```bash
   npm start
   ```

---

## 📊 Monitoring

### Console Output
```
🤖 MoniBot Worker Starting (Router Architecture)...

┌─────────────────────────────────────────────────┐
│           MoniBot Silent Worker v2.0           │
│          Router-Based Architecture             │
└─────────────────────────────────────────────────┘

📋 Configuration:
   Profile ID:     0cb9ca32-7ef2-4ced-8389-9dbca5156c94
   Router Address: 0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516
   RPC Endpoint:   https://mainnet.base.org...
   Poll Interval:  60000ms

✅ All services initialized successfully!

🔄 [12:00:00] Poll Cycle #1
────────────────────────────────────
📊 Polling for campaign replies...
💬 Polling for P2P commands...
────────────────────────────────────
✅ Cycle #1 complete. Next in 60s
```

### Database Tables
- `monibot_transactions` — All transaction logs
- `campaign_grants` — Grant deduplication
- `campaigns` — Campaign management

---

## 🔗 Related Resources

- [MoniBotRouter Contract](https://basescan.org/address/0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516)
- [MoniPay App](https://monipay.xyz)
- [MoniBot-VP-Social](https://github.com/samuelchimmy/monibot-vp-social)

---

## 🔀 Network Routing (Keyword Detection)

Base is the **default network** — all tweets that do NOT contain BSC keywords are handled here.

### BSC Keywords (skipped by this bot)
`usdt`, `bnb`, `bsc`, `binance`, `binance smart chain`

### Routing Examples

| Command | Handled By |
|---------|-----------|
| `@monibot send $5 to @alice` | ✅ **Base Worker** (default) |
| `@monibot pay @bob $10` | ✅ **Base Worker** (default) |
| `@monibot send $5 usdt to @alice` | ❌ BSC Worker (keyword: `usdt`) |
| `@monibot pay @bob $10 on bsc` | ❌ BSC Worker (keyword: `bsc`) |

### P2P Commands
- If a tweet contains BSC keywords, it is logged as `SKIP_BSC_NETWORK` and skipped.
- The BSC worker picks it up via its own keyword-filtered search query.

### Campaigns
- If a campaign reply or campaign message contains BSC keywords, it is skipped by the Base bot.

---

**Built with 💙 on Base**
