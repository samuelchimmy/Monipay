# MoniBot Telegram Bot

Telegram platform bot for MoniPay. It supports slash commands, natural language payment intent parsing, scheduled payments, cross-chain fallback checks, and MagicPay flows for unlinked recipients.

## Current Structure

```text
monibot-telegram/
  shared/   # chain configs, blockchain, db, ai, iou logic
  src/      # telegram platform layer (handlers, middleware, utils)
```

- Runtime entry: `src/index.js`
- Polling model: `node-telegram-bot-api` polling + `/health` Express endpoint
- Shared core logic is sourced from the Discord implementation and reused here

## Supported Networks

- Base (`USDC`)
- BSC (`USDT`)
- Celo (`USDT`)
- Ink (`USDT0`)
- Tempo (`αUSD`, testnet)
- Solana (`USDC`, relay flow)

## Contract Addresses

Official website: [monipay.xyz](https://monipay.xyz)

These addresses are sourced from `shared/chains.js` (single source of truth). Update that file first, then sync this README.

### base
- `tokenAddress`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- `routerAddress`: `0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516`
- `magicPayAddress`: `0x1945c633659Ae71991aE37eE2Bdfe64E00514650`

### bsc
- `tokenAddress`: `0x55d398326f99059fF775485246999027B3197955`
- `routerAddress`: `0x9eEd16952d734DFC84B7C4E75e9a3228B42D832e` (or `BSC_ROUTER_ADDRESS` env override)
- `magicPayAddress`: `0xF602b559eE5c51ED122F667d101be105d9eDf90d`

### celo
- `tokenAddress`: `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- `routerAddress`: `0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e`
- `magicPayAddress`: `0x6bB3C64C382fcF8fB65b24234C455bB62b155742`

### ink
- `tokenAddress`: `0x0200C29006150606B650577BBE7B6248F58470c1`
- `routerAddress`: `0x046875a42B8F79E72349d38CB8225cbd6d24C7c5`
- `magicPayAddress`: `0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08`

### tempo
- `tokenAddress`: `0x20c0000000000000000000000000000000000001`
- `routerAddress`: `0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc`
- `magicPayAddress`: not deployed / not available

### solana
- `tokenAddress`: `EPjFWdd5AufqnvUePlk4kJ2d8c1gb2cpEH43t1YpTrW`
- `routerAddress`: `TokenkegQfeZyiNwAJbVBCWLGGLGtoSte56GW7LUPbaL`
- `magicPayAddress`: not deployed / not available

## Setup

### 1) Create a Telegram Bot
1. Message [@BotFather](https://t.me/BotFather)
2. Run `/newbot` and follow prompts
3. Save the bot token

### 2) Configure Environment
Copy `.env.example` to `.env` and provide at minimum:

```bash
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
MONIBOT_PRIVATE_KEY=...
BASE_RPC_URL=...
```

Optional chain RPC overrides:
- `BSC_RPC_URL`
- `CELO_RPC_URL`
- `INK_RPC_URL`
- `TEMPO_RPC_URL`
- `SOLANA_RPC_URL`

Optional contract override:
- `BSC_ROUTER_ADDRESS` — use this if the BSC MoniBot router is redeployed or the default address is not a contract on BSC.

### 3) Install and Run

```bash
npm install
npm run start
```

Dev watch mode:

```bash
npm run dev
```

## BotFather Configuration

Use `/setcommands` with BotFather and paste the following:

```
help - How to set up and use MoniBot
about - What is MoniPay and MoniBot
change - Change your preferred payment chain
```

## Commands

Natural language is the primary way to interact with MoniBot. Standard commands:
- `send $5 to @alice`
- `slide $1 each to @alice and @bob`
- `giveaway $2 to the first 5`
- `balance` or `balance on celo`
- `/change preferred chain to base`
- `@monipaybot change preferred chain to bsc`
- `about`
- `help`
- `set chain to celo` (Group Admins only)

Natural language is also supported in private chats or when mentioning/replying to the bot.

## Chain Resolution Order

For payment and balance handlers:
1. Chain detected from message text
2. Sender preferred network (set with `/change preferred chain to base`, `bsc`, `celo`, `ink`, or `solana`)
3. Group default chain
4. Fallback to `base`

## Security and Safety Rules

- Identity key is Telegram numeric user ID (`msg.from.id`)
- Deduplication via `isCommandProcessed('telegram', message_id)`
- Rate limit is `5 commands / 60s` per user
- Self-send is blocked
- Amount validation: `> 0`, finite, max `10000`
- Allowance pre-check runs before P2P and MagicPay execution
- Gas uses 20% buffer on send path

## Notes

- `shared/chains.js` is the single source of truth for chain config
- MagicPay recipient hashing uses packed `keccak256(platform, ':', userId)` compatibility
- Scheduled job polling is handled every 30 seconds in `src/index.js`
