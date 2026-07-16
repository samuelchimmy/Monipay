---
title: MoniPay Roadmap — Shipped, Shipping, and Coming Next
description: The complete MoniPay roadmap. What we have shipped across Base, BSC, Solana and Tempo, what is shipping now, and the path to a user-owned, decentralised payment protocol.
keywords: monipay roadmap, monipay future, monitag name service, monipay decentralization, monipay chains, monipay points, monipay referral, fiat rails
canonical: https://docs.monipay.xyz/roadmap
---

# MoniPay roadmap

MoniPay is a Hammer, not a service. Every milestone on this roadmap moves us closer to one outcome: a user-owned, multi-chain, identity-native stablecoin payment protocol that works without asking permission.

This page is the single source of truth for what is shipped, what is shipping, and what is coming. Dates are directional — we ship when it is right, not when it is convenient.

## Shipped (live in production)

These are live today on [monipay.xyz](https://monipay.xyz) and across MoniBot on Discord, Telegram, Twitter and Bluesky.

### Core wallet & identity
- **Embedded self-custodial wallet** — AES-GCM encrypted keys stored locally. Walkaway Test passes: export your key, leave anytime.
- **MoniTag™** — human-readable usernames that resolve to addresses across every supported chain.
- **PIN + biometric unlock** — fast local auth, no passwords, no seed-phrase ceremony.
- **Google Drive encrypted backup** — appDataFolder AES-GCM backup with conflict detection.
- **Soft account deletion** — deactivation with full data retention and re-import protection.

### Multi-chain support
- **Base mainnet** — USDC, gasless via EIP-712 relayer, Base Builder Code attribution.
- **BNB Smart Chain** — USDT, gasless via EIP-712 relayer.
- **Solana mainnet** — USDC SPL, twin-key Ed25519, feePayer relay, 1% fee split.
- **Tempo testnet (Moderato)** — AlphaUSD on TIP-20, native fee sponsorship, batch calls, 2D nonces.

### Payments
- **Gasless P2P transfers** — send by MoniTag™, recipient gets 100% on Tempo, ~99% on Base/BSC/Solana.
- **MagicPay** — recipients without a MoniPay account can still receive social tips securely.
- **Multi-recipient P2P** — `send $1 to @alice, @bob and @charlie` in one command.
- **External wallet payments** — pay from MetaMask/Rabby/Phantom and we still detect, log, and update carts.
- **Wallet funding bridge** — dual-adapter bridge prioritising MetaMask and Rabby.
- **Account activation gas grant** — 0.000002 ETH on Base for new wallets; Tempo and Solana bypassed.

### MoniBot (social payments)
- **Discord** — reference implementation, full P2P, campaigns, gas sponsorship.
- **Telegram** — P2P, return-to deep links, Smart Feedback replies.
- **Twitter / X** — P2P, campaign reply evaluation via Gemini.
- **Bluesky** — P2P polling and replies.
- **Natural-language parsing** — regex with Gemini 2.0-flash fallback. Improving every release.
- **Per-network on-chain allowances** — separate approvals per chain, Tempo bypassed by design.
- **Transaction deduplication** — `monibot_transactions` constraints prevent double-spends.

### Merchant (early access)
- **Storefront Pro** — `/store/@paytag` storefronts behind a $30/month gate.
- **Cart & checkout** — up to 99 items, optional shipping form, 2.5s success redirect.
- **Payment Gateway** — HMAC-SHA256 signed webhooks, source mapping, on-chain hash overrides DB errors.
- **Payment links** — `pl_[code]` short links with dynamic OG previews (`Pay @shopname`).
- **Chrome Extension SDK** — gasless `window.monipay.requestPayment()` for any site.
- **Invoice & receipt UI** — locked black "Moni" branding, PDF-ready.

### Platform & infrastructure
- **PWA + offline support** — network-first service worker, deep-linked notifications.
- **Native Flutter app** — strict visual and functional parity with web (SDK 3.27+, Dart 3.6+).
- **8-language i18n** — including RTL support, compact header variant.
- **Multi-RPC failover** — exponential backoff across providers per chain.
- **Performance caching** — PayTag 60s TTL, token balances 30s TTL with invalidation.
- **API rate limiting** — 5/wallet/min, 10/IP/min on `relay-payment`.
- **Admin dashboard** — obfuscated `/m0n1b0t-cmd` route, 10-minute auto-lock.
- **Marketing pages** — `/base`, `/bsc`, `/solana`, `/tempo` Trantor-style landings.
- **Smart install prompt** — 7-day dismissal memory.
- **Reserved MoniTag™ blocklist** — 150+ protected terms.

## Shipping now (Q2–Q3 2026)

Active development. Expect these in the next few release cycles.

### Tempo mainnet
Promote our Tempo testnet integration to mainnet the moment Tempo opens it. Tempo becomes the default chain for new users — zero fees, batch atomic transfers, scheduled payments, payment-native primitives.

### Full merchant launch
Graduate Storefront Pro out of early access. Inventory, variants, discount codes, multi-currency display, accounting exports, refund flows, customer CRM, and a public merchant directory.

### Payment links v2
Recurring payment links, donation pages, tip jars, multi-amount campaigns, expirable links, link-level analytics, and creator-style "buy me a coffee" pages — all powered by the same gasless rails.

### Points system
Earn points for every send, receive, and merchant payment. Points convert to fee rebates, MoniTag™ perks, and early access to new chains and features. Points are the on-ramp to protocol ownership.

### Referral program
Bring a friend, earn a share of their fees forever. Multi-tier, on-chain attribution, no dashboard gymnastics — your MoniTag™ is your referral code.

### MagicPay v2
Expand recipient-without-account flows: claim windows, expiry refunds, multi-platform claim (Discord → Telegram → Web), and financial intent execution from any social bio link.

## Next (Q4 2026 → 2027)

### MoniTag Name Service (MNS) on-chain
Move MoniTag™ from a centralised resolver to an on-chain name service. ENS-compatible reverse resolution, cross-chain primary names, subdomain delegation (e.g. `pay.@alice`), and renewable registration. Your username becomes a portable, censorship-resistant asset you actually own.

### Gated access for private communities
MoniTag™ + on-chain payment history as a permissioning layer. Token-gated chats, paid Discord roles, paywalled Telegram groups, members-only storefronts, and contributor-only campaign access. One subscription, recognised everywhere.

### New chain deployments
Bringing the same gasless, MoniTag™-resolved experience to:
- **Polygon PoS** — USDC, low-fee EVM mainstay.
- **Arbitrum One** — USDC native, deep liquidity.
- **Optimism / OP Mainnet** — USDC, Superchain alignment.
- **Arc** — Circle's payment-optimised L1 when public.
- **Additional Solana SPL stablecoins** — PYUSD, EURC.
- **Tempo mainnet** — full production (see above).

Every new chain ships with: gasless relay, MoniTag™ resolution, MoniBot routing, merchant checkout, and admin monitoring on day one.

### Fiat rails
On-ramp and off-ramp without leaving MoniPay:
- **Local on-ramps** — bank transfer, card, mobile money in priority regions (NGN, KES, GHS, ZAR, EUR, GBP, USD, BRL, INR).
- **Off-ramp to bank / mobile money** — withdraw stablecoins to your local account in minutes.
- **Merchant settlement in fiat** — accept stablecoins, settle in your local currency automatically.
- **Virtual cards** — spend your MoniPay balance anywhere Visa/Mastercard is accepted.
- **Payroll** — businesses pay teams in stablecoins, recipients receive in their preferred currency.

### Developer platform
- **Public REST + Webhook API** — production-grade, versioned, with SDKs in TS, Python, Go, Rust, Dart.
- **MoniBot bring-your-own-bot** — embed MoniBot in any community with one config.
- **Plugin marketplace** — Shopify, WooCommerce, Wix, Webflow, Framer, Ghost, Substack.
- **Smart contract SDK** — drop-in router contracts for builders shipping payments on supported chains.

## The endgame: decentralisation & user ownership

MoniPay is being built to be given away. The endgame is a payment protocol owned and governed by the people who use it.

### Phase 1 — Points & cashback (active)
Every fee paid to MoniPay accrues points to the payer. Points are the proof-of-use that seeds the future ownership distribution. No speculation, no farming — just usage.

### Phase 2 — Protocol-owned treasury
Platform fees flow into an on-chain treasury. Transparent, auditable, and earmarked for protocol development, security, and user rebates.

### Phase 3 — Cashback from protocol fees
Active users start earning a share of protocol fees back as cashback, weighted by points and tenure. The more MoniPay you use, the more MoniPay pays you.

### Phase 4 — Distributed ownership
A protocol token (or non-transferable governance credential, depending on regulatory clarity) is distributed to historical users based on points. No VC allocation. No team-favoured unlock cliffs designed to dump on users. Distribution is the launch.

### Phase 5 — User-governed protocol
Holders vote on:
- Fee parameters per chain.
- Treasury spending and grants.
- New chain integrations.
- Reserved MoniTag™ policy.
- Bot persona and reply behaviour.
- Merchant subscription pricing.

The team becomes one contributor among many. The Hammer belongs to the people swinging it.

## Things we will not do

A roadmap is also a list of refusals. To stay honest:
- **No custodial wallet pivot.** Keys stay with users. Always.
- **No seed-phrase exposure for everyday users.** Export is opt-in, never a default ceremony.
- **No surveillance-grade KYC for P2P.** Only where regulators force it on fiat rails, and never on-chain activity.
- **No paid placement in MoniBot replies.** The bot serves users, not advertisers.
- **No closed-source smart contracts.** All routers are verified on every chain we deploy to.
- **No "premium gas tier."** Gasless is the default forever.

## How to influence the roadmap

- **Vote with usage** — every transaction is a signal.
- **Join MoniBot communities** on Discord and Telegram.
- **Tag @monipay** on Twitter / X / Bluesky with feature requests.
- **Email** the team via the channels listed in [/support](https://monipay.xyz/support).

This page is updated on every major release. If you see something missing, that is a roadmap gap — tell us.
