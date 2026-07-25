# MoniBot BSC Worker 🤖⛓️ - BNB Smart Chain Transaction Layer

**MoniBot BSC Worker** is the BSC-specific fork of the MoniBot Silent Worker. It executes USDT transactions on BNB Smart Chain via the **MoniBotRouter** contract.

---

## 🔗 Key Differences from Base Worker

| Aspect | Base Worker | BSC Worker |
|--------|------------|------------|
| Chain | Base Mainnet (8453) | BSC Mainnet (56) |
| Token | USDC | USDT |
| Decimals | 6 | 18 |
| Router | `0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516` | `0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E` |
| RPC Env | `BASE_RPC_URL` | `BSC_RPC_URL` |
| Auto-Restart | None | 90 minutes (OAuth refresh) |
| Database | Shared | Shared (same Supabase) |

---

## 🏗️ Contract Details

```
MoniBotRouter (BSC): 0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E
USDT (BSC):          0x55d398326f99059fF775485246999027B3197955
MoniPayRouter (BSC): 0x557285AbC46038E898d90eB00943Ff42c4Fbcb54
Treasury:            0xfa2B8eD012f756E22E780B772d604af4575d5fcf
Chain:               BSC Mainnet (56)
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

# Blockchain (Executor Wallet - must be authorized on BSC MoniBotRouter)
MONIBOT_PRIVATE_KEY=0x...
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Database (Shared with Base Worker)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Bot Identity
MONIBOT_PROFILE_ID=uuid-of-monibot-profile
MONIBOT_WALLET_ADDRESS=0x...

# Optional
POLL_INTERVAL_MS=60000
ENABLE_CAMPAIGNS=true
ENABLE_P2P_COMMANDS=true
```

---

## 🚀 Deployment (Railway)

1. **Create a new Railway service** (separate from Base worker)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variables** in Railway dashboard

4. **Authorize the Executor on BSC:**
   ```solidity
   // Call from contract owner wallet on BSC
   MoniBotRouter.addExecutor(MONIBOT_WALLET_ADDRESS)
   ```

5. **Fund the BSC Router** (for grants):
   ```
   Send USDT to: 0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E
   ```

6. **Fund the executor wallet with BNB** for gas fees

7. **Start:**
   ```bash
   npm start
   ```

---

## 📊 Console Output

```
🤖 MoniBot BSC Worker Starting...

┌─────────────────────────────────────────────────┐
│        MoniBot BSC Silent Worker v1.0          │
│     Router-Based + DB-Driven (USDT/BSC)       │
└─────────────────────────────────────────────────┘

📋 Configuration:
   Chain:            BSC Mainnet (56)
   Token:            USDT (18 decimals)
   Router Address:   0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E
   Auto-Restart:     90 minutes

✅ All services initialized successfully!

🔄 [12:00:00] Poll Cycle #1 [BSC]
────────────────────────────────────
📊 [BSC] Polling for campaign replies...
💬 [BSC] Polling for P2P commands...
────────────────────────────────────
✅ Cycle #1 complete. Next in 60s
```

---

## 🔀 Network Routing

### Two Routing Strategies

MoniBot uses **different routing strategies** for campaigns vs P2P commands:

#### 1. Campaigns → Routed by `campaigns.network` column (Database)

Campaigns are assigned a network (`base` or `bsc`) when created. Each worker **only polls campaigns matching its network**.

- **BSC Worker** polls `WHERE network = 'bsc' AND status = 'active'`
- **Base Worker** polls `WHERE network = 'base' AND status = 'active'`

**No keyword detection needed for campaigns.** Any valid monitag reply to a BSC campaign gets a grant — users don't need to type "usdt" or "bsc". This ensures fully autonomous campaign processing.

| Scenario | Handled By | Why |
|----------|-----------|-----|
| Reply to a `network='bsc'` campaign | ✅ **BSC Worker** | DB filter |
| Reply to a `network='base'` campaign | ❌ Base Worker | DB filter |

#### 2. P2P Commands → Routed by Keyword Detection (Twitter Search)

P2P commands still use keyword-based routing since there's no pre-assigned network context.

**BSC Keywords:** `usdt`, `bnb`, `bsc`, `binance`, `binance smart chain`

| Command | Handled By | Why |
|---------|-----------|-----|
| `@monibot send $5 usdt to @alice` | ✅ **BSC Worker** | keyword: `usdt` |
| `@monibot send $5 to @alice` | ❌ Base Worker | no BSC keyword |
| `@monibot pay @bob $10 on bsc` | ✅ **BSC Worker** | keyword: `bsc` |

### Why Two Strategies?

- **Campaigns** have a known network at creation time → route via DB column (reliable, no keyword dependency)
- **P2P commands** are ad-hoc tweets with no prior context → route via keywords in the tweet text

---

**Built with 💙 on BNB Smart Chain**
