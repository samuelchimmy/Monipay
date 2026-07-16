# MoniPay Docs — SEO Content & Implementation Blueprint

**Target site:** `https://docs.monipay.xyz` (Next.js app, separate repo)
**Companion app:** `https://monipay.xyz`
**Goal:** Rank #1 for "MoniPay", "MoniTag", "MoniBot", "gasless stablecoin payments", "send USDC by username", and long-tail multi-chain payment queries. Be crawled and indexed within hours of publish.
**Author voice:** Authoritative, technical, neutral. No marketing puffery. No em dashes on chain pages. Use `MoniTag™` (lowercase `m`, uppercase `T`, trademark) consistently. Never write "Not Just".

---

## 0. How to use this document

This file is the canonical SEO + content brief for the docs site. Each section maps 1:1 to a route in the Next.js docs app. For every page you will find:

1. **Route** — the URL path
2. **Title tag** (`<title>`, ≤60 chars) and **meta description** (≤160 chars)
3. **Canonical URL**
4. **Open Graph / Twitter** image and copy
5. **JSON-LD** schema(s) to inject server-side
6. **H1 + outline** (single H1, semantic H2/H3 hierarchy)
7. **Body copy** (drop-in MDX-ready prose) with internal links
8. **FAQs** (rendered as `<FAQPage>` JSON-LD + visible accordions)
9. **Internal link targets** (anchor text → URL)

> **Critical:** Next.js App Router supports per-route `metadata` exports and SSR. Use `generateMetadata` for dynamic routes. Inject JSON-LD via `<Script type="application/ld+json" />` in each page's server component. Do **not** rely on client-side `react-helmet`.

---

## 1. Global / site-wide SEO

### 1.1 `app/layout.tsx` — root metadata

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://docs.monipay.xyz'),
  title: {
    default: 'MoniPay Docs — Gasless Multi-Chain Stablecoin Payments',
    template: '%s | MoniPay Docs',
  },
  description:
    'Official MoniPay documentation. Learn how to send gasless stablecoin payments by username across Base, BSC, Solana, Tempo, Ink and Celo with MoniTag™.',
  applicationName: 'MoniPay Docs',
  keywords: [
    'MoniPay', 'MoniTag', 'MoniBot', 'gasless payments', 'stablecoin payments',
    'USDC payments', 'USDT payments', 'send crypto by username', 'Base payments',
    'BSC payments', 'Solana payments', 'Tempo payments', 'non-custodial wallet',
    'invisible wallet', 'crypto payment gateway', 'merchant crypto payments',
    'AlphaUSD', 'MiniPay Celo', 'gasless USDC', 'ERC-2771 meta transactions',
    'EIP-712 relayer', 'TIP-20', 'self-custody wallet', 'pay by tag',
  ],
  authors: [{ name: 'MoniPay', url: 'https://monipay.xyz' }],
  creator: 'MoniPay',
  publisher: 'MoniPay',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'MoniPay Docs',
    locale: 'en_US',
    url: 'https://docs.monipay.xyz',
    title: 'MoniPay Docs — Gasless Multi-Chain Stablecoin Payments',
    description:
      'Send stablecoins by username across Base, BSC, Solana, Tempo, Ink and Celo. Zero gas. Non-custodial.',
    images: [{ url: '/og/default.png', width: 1200, height: 630, alt: 'MoniPay Docs' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@monaborng',
    creator: '@monaborng',
    title: 'MoniPay Docs',
    description: 'Gasless multi-chain stablecoin payments. Pay by MoniTag™.',
    images: ['/og/default.png'],
  },
  alternates: {
    canonical: 'https://docs.monipay.xyz',
    languages: {
      'x-default': 'https://docs.monipay.xyz',
      en: 'https://docs.monipay.xyz',
    },
  },
  category: 'finance',
};
```

### 1.2 `app/sitemap.ts` (dynamic) — must include every route

```ts
import { MetadataRoute } from 'next';

const ROUTES = [
  '', 'getting-started', 'getting-started/create-monitag',
  'getting-started/fund-wallet', 'getting-started/send-payment',
  'concepts', 'concepts/monitag', 'concepts/invisible-wallet',
  'concepts/gasless-payments', 'concepts/multi-chain-routing',
  'concepts/walkaway-test',
  'chains', 'chains/base', 'chains/bsc', 'chains/solana',
  'chains/tempo', 'chains/ink', 'chains/celo-minipay',
  'wallet', 'wallet/security', 'wallet/backup', 'wallet/recovery',
  'wallet/pin-and-biometrics',
  'payments', 'payments/p2p', 'payments/qr-codes',
  'payments/payment-links', 'payments/iou', 'payments/external-wallets',
  'merchant', 'merchant/storefront', 'merchant/products',
  'merchant/invoices', 'merchant/orders', 'merchant/payment-gateway',
  'merchant/api-keys', 'merchant/webhooks',
  'monibot', 'monibot/discord', 'monibot/telegram', 'monibot/twitter',
  'monibot/commands', 'monibot/campaigns',
  'developers', 'developers/api-reference', 'developers/webhooks',
  'developers/chrome-extension', 'developers/sdk',
  'mobile', 'mobile/install-pwa', 'mobile/flutter-app',
  'security', 'security/architecture', 'security/audits',
  'faq', 'glossary', 'changelog', 'brand', 'support',
  'legal/privacy', 'legal/terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://docs.monipay.xyz';
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${base}/${r}`.replace(/\/$/, '') || base,
    lastModified,
    changeFrequency: r === '' ? 'daily' : 'weekly',
    priority: r === '' ? 1.0 : r.includes('/') ? 0.6 : 0.8,
  }));
}
```

### 1.3 `app/robots.ts`

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
    ],
    sitemap: 'https://docs.monipay.xyz/sitemap.xml',
    host: 'https://docs.monipay.xyz',
  };
}
```

### 1.4 Site-wide JSON-LD (inject in root layout)

```jsonc
[
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MoniPay",
    "url": "https://monipay.xyz",
    "logo": "https://monipay.xyz/og/default.png",
    "sameAs": [
      "https://x.com/monaborng",
      "https://x.com/maborng",
      "https://docs.monipay.xyz",
      "https://monipay.xyz"
    ],
    "description": "Gasless, non-custodial stablecoin payments across Base, BSC, Solana, Tempo, Ink and Celo.",
    "foundingDate": "2024",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "url": "https://monipay.xyz/support"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "MoniPay Docs",
    "url": "https://docs.monipay.xyz",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://docs.monipay.xyz/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
]
```

### 1.5 Performance & crawlability checklist

- Use `next/image` with `priority` on hero LCP images, `loading="lazy"` everywhere else.
- Use `next/font` for `DM Sans` (matches app); preload only the weights you ship.
- Set `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800` on all docs pages (ISR).
- Ship `app/icon.tsx` and `app/apple-icon.tsx` from the MoniPay logo.
- Submit `https://docs.monipay.xyz/sitemap.xml` to Google Search Console **and** Bing Webmaster Tools on day 1.
- Use IndexNow (`/api/indexnow`) to ping Bing/Yandex on each new page publish.
- Add `<link rel="me" href="https://x.com/monaborng" />` for Mastodon/identity verification.
- Add `<link rel="alternate" type="application/rss+xml" href="/changelog/rss.xml" />` once changelog is live.

---

## 2. Page-by-page content

For each page below:
- The **Title** is the `<title>` tag value (do **not** append "| MoniPay Docs" — the template handles it; the title shown is the raw page title).
- All canonical URLs are absolute.
- All JSON-LD goes in the page's server component.
- All FAQs render as visible accordions **and** as `FAQPage` JSON-LD.

---

### 2.1 `/` — Home

- **Title:** `MoniPay Docs — Gasless Multi-Chain Stablecoin Payments`
- **Description:** `Official MoniPay documentation. Send stablecoins by username across Base, BSC, Solana, Tempo, Ink and Celo. Non-custodial. Zero gas.`
- **Canonical:** `https://docs.monipay.xyz`
- **OG image:** `/og/default.png`
- **JSON-LD:** `WebSite` + `Organization` + `BreadcrumbList`

#### H1 + outline
```
H1: MoniPay Documentation
H2: What is MoniPay?
H2: Quick start
H2: Supported networks
H2: Core concepts
H2: For developers
H2: Frequently asked questions
```

#### Body
> **MoniPay** is a non-custodial, gasless stablecoin payment network. Send USDC, USDT, αUSD and cUSD to anyone by their **MoniTag™** — a human-readable username — across **Base, BSC, Solana, Tempo, Ink and Celo**. No seed phrases, no gas fees, no banks.
>
> MoniPay is a **Hammer, not a service**. Your private keys are generated locally, encrypted with your PIN using AES-256-GCM, and stored on your device. We never see them. If MoniPay disappears tomorrow, your funds are still yours — that is the **Walkaway Test**.

**Quick links:**
- [Create your MoniTag](/getting-started/create-monitag)
- [Fund your wallet](/getting-started/fund-wallet)
- [Send your first payment](/getting-started/send-payment)
- [API reference](/developers/api-reference)
- [Brand assets](/brand)

#### FAQs (top 6 — full set on `/faq`)
1. **What is MoniPay?** — A non-custodial, gasless stablecoin payment network across six chains.
2. **Is MoniPay free?** — Yes for personal use. Merchants pay 1% per transaction. Storefront Pro is $30/month.
3. **Do I need crypto to start?** — No native gas needed. You only need stablecoins on a supported chain.
4. **Which chains are supported?** — Base (USDC), BSC (USDT), Solana (USDC SPL), Tempo (αUSD), Ink, Celo (cUSD).
5. **Is MoniPay custodial?** — No. Keys are encrypted client-side and never leave your device.
6. **How do I get a MoniTag?** — Sign up at [monipay.xyz](https://monipay.xyz) and pick a unique username.

---

### 2.2 `/getting-started`

- **Title:** `Getting Started with MoniPay`
- **Description:** `Create a MoniTag, fund your wallet, and send your first gasless stablecoin payment in under 3 minutes.`
- **JSON-LD:** `HowTo` (3 steps), `BreadcrumbList`

#### HowTo schema
```jsonc
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Get started with MoniPay",
  "totalTime": "PT3M",
  "step": [
    { "@type": "HowToStep", "name": "Create your MoniTag", "url": "https://docs.monipay.xyz/getting-started/create-monitag" },
    { "@type": "HowToStep", "name": "Fund your wallet", "url": "https://docs.monipay.xyz/getting-started/fund-wallet" },
    { "@type": "HowToStep", "name": "Send your first payment", "url": "https://docs.monipay.xyz/getting-started/send-payment" }
  ]
}
```

#### Body outline
1. Visit `https://monipay.xyz`
2. Pick a unique MoniTag (lowercase, 3–20 chars, alphanumeric + underscore)
3. Set a 6-digit PIN (encrypts your local private key with AES-256-GCM)
4. Receive on Base/BSC/Solana/Tempo/Ink/Celo
5. Send by MoniTag

---

### 2.3 `/getting-started/create-monitag`

- **Title:** `Create Your MoniTag — MoniPay Username Setup`
- **Description:** `Pick a unique MoniTag™ to receive payments by username. Lowercase, 3–20 chars, alphanumeric and underscore.`
- **JSON-LD:** `HowTo`, `BreadcrumbList`

**Body covers:** valid characters, reserved usernames (link to `/concepts/monitag#reserved`), case rules (lowercase `m`), changing your tag (not allowed once registered), tag-to-address mapping per chain.

**FAQs:**
- Can I change my MoniTag? — No. Choose carefully.
- Are MoniTags case-sensitive? — Stored lowercase; UI displays as you typed.
- Can I have multiple MoniTags? — One per account. Use sub-stores under your tag for branding.
- What if my desired tag is reserved? — See the [reserved list](/concepts/monitag#reserved).

---

### 2.4 `/getting-started/fund-wallet`

- **Title:** `Fund Your MoniPay Wallet`
- **Description:** `Deposit USDC, USDT, αUSD or cUSD from any exchange or wallet. MoniPay detects deposits automatically.`

**Body:** Per-chain deposit addresses are shown in the Fund modal. EVM addresses are lowercase. Solana uses Base58. Send from Binance, Bybit, Coinbase, Phantom, Rabby, MetaMask, etc. Deposit detection polls the relevant RPC; UI shows a success animation and amount when confirmed.

**FAQs:**
- How long does a deposit take? — Usually under 30 seconds; depends on network finality.
- What if I send the wrong token? — Stuck. Only send the supported stablecoin per chain.
- Is there a minimum deposit? — None enforced; gas-equivalent dust may not be detected.
- Can I deposit from a CEX? — Yes; pick the matching network (Base, BSC, Solana, Celo).

---

### 2.5 `/getting-started/send-payment`

- **Title:** `Send a Gasless Stablecoin Payment`
- **Description:** `Send USDC/USDT/αUSD/cUSD by MoniTag in seconds. Zero gas. Non-custodial. Cross-chain auto-routing.`

**Body:** Enter `@MoniTag` → amount → confirm with PIN → signed locally → relayed → settled on-chain. Cross-chain routing automatically picks the chain where you have balance. Receipts include tx hash, explorer link, locked black `Moni` watermark.

---

### 2.6 `/concepts/monitag`

- **Title:** `MoniTag™ — Universal Payment Identity`
- **Description:** `MoniTag™ is your username across Base, BSC, Solana, Tempo, Ink and Celo. One identity, six chains.`
- **JSON-LD:** `DefinedTerm`, `BreadcrumbList`

**Body:** Definition, casing rules, reserved usernames (150+ blocklist), tag-to-address resolution per chain, social linking (Discord/Telegram/X handshake).

---

### 2.7 `/concepts/invisible-wallet`

- **Title:** `The Invisible Wallet — Non-Custodial by Design`
- **Description:** `MoniPay generates an Ethereum-compatible private key locally, encrypted with your PIN. Self-custody without seed phrases.`

**Body:** Key generation (CSPRNG), AES-256-GCM encryption, PIN hashing (Argon2id), localStorage + Secure Enclave on native, Solana twin-key Ed25519 model, account deactivation (soft delete).

---

### 2.8 `/concepts/gasless-payments`

- **Title:** `Gasless Payments — How MoniPay Sponsors Gas`
- **Description:** `MoniPay uses ERC-2771 meta-transactions on Base/BSC, native fee sponsorship on Tempo, and feePayer relays on Solana.`

**Body:**
- **Base/BSC:** EIP-712 signature → backend relayer → router contract splits 99% / 1%.
- **Tempo:** Native `feePayer` field; sponsor pays in αUSD.
- **Solana:** `feePayer` field on transaction; relay signs and submits.
- **Builder code:** ERC-8021 `bc_qt9yxo1d` hex suffix appended on Base.

---

### 2.9 `/concepts/multi-chain-routing`

- **Title:** `Cross-Chain Routing in MoniPay`
- **Description:** `MoniPay picks the optimal chain based on sender balance, recipient support, and gas-sponsor capacity.`

---

### 2.10 `/concepts/walkaway-test`

- **Title:** `The Walkaway Test — Why MoniPay is a Hammer`
- **Description:** `If MoniPay disappears tomorrow, your funds remain yours. Self-custody you can verify.`

---

### 2.11 Chain pages

Each chain page has identical structure. Use `generateMetadata` to template title/description, but write **unique** body copy.

#### `/chains/base`
- **Title:** `MoniPay on Base — Gasless USDC Payments`
- **Description:** `Send USDC on Base with zero gas. ERC-2771 meta-transactions, ERC-8021 builder code attribution, 1% platform fee.`
- **Body:** Chain ID 8453, USDC (6 decimals), router address, builder code `bc_qt9yxo1d`, Basescan links, gas grant on signup (0.000002 ETH).

#### `/chains/bsc`
- **Title:** `MoniPay on BSC — Gasless USDT Payments`
- **Description:** `Send USDT (BEP-20) on BNB Smart Chain with zero gas. EIP-712 relayer, 1% fee, 18 decimals.`
- **Body:** Chain ID 56, USDT (18 decimals), BscScan, no builder code.

#### `/chains/solana`
- **Title:** `MoniPay on Solana — Gasless USDC SPL Payments`
- **Description:** `Send USDC SPL on Solana with zero gas. Twin-Key Ed25519, feePayer relay, 1% fee split.`
- **Body:** Twin-key model, `feePayer` mechanics, Base58 addresses, encrypted key is **localStorage-only** (never in DB), import validates against DB-bound address.

#### `/chains/tempo`
- **Title:** `MoniPay on Tempo — Gasless AlphaUSD Payments`
- **Description:** `Send αUSD on Tempo Moderato Testnet (chain 42431) with native fee sponsorship. TIP-20, 18 decimals, 2D nonces.`
- **Body:** EIP-2718 type 0x76, no native gas token, AlphaUSD `0x20c0…0001`, faucet `https://faucet.tempo.xyz`, batch calls, scheduled txs. **Do not use em dashes on this page.**

#### `/chains/ink`
- **Title:** `MoniPay on Ink — Gasless Stablecoin Payments`
- **Description:** `Send stablecoins on Ink Layer 2 with zero gas via MoniPay.`

#### `/chains/celo-minipay`
- **Title:** `MoniPay × MiniPay on Celo — Gasless cUSD`
- **Description:** `Use MoniPay inside the Opera MiniPay browser on Celo. Send cUSD by MoniTag with zero gas.`

---

### 2.12 Wallet section

#### `/wallet/security`
- **Title:** `Wallet Security Architecture`
- **Description:** `AES-256-GCM key encryption, Argon2id PIN hashing, Secure Enclave on native, signed HTTP wrapper for Flutter.`

#### `/wallet/backup`
- **Title:** `Back Up Your MoniPay Wallet`
- **Description:** `Export an encrypted backup or sync to Google Drive (appDataFolder, AES-GCM). You hold the keys.`

#### `/wallet/recovery`
- **Title:** `Recover Your MoniPay Wallet`
- **Description:** `Restore from encrypted backup file or Google Drive. PIN required to decrypt.`

#### `/wallet/pin-and-biometrics`
- **Title:** `PIN & Biometrics`
- **Description:** `6-digit PIN encrypts your key. Optional FaceID/TouchID/fingerprint unlock on mobile. Lockout after 5 failed attempts.`

---

### 2.13 Payments section

- `/payments/p2p` — **`Person-to-Person Payments`** — Send by MoniTag, zero gas, instant settlement.
- `/payments/qr-codes` — **`QR Code Payments`** — Branded QR (pixel-locked), scan-to-pay flow. **Do not modify QR rendering.**
- `/payments/payment-links` — **`Payment Links (pl_ codes)`** — `monipay.xyz/pay/pl_[code]` format, single or multi-use, expiry, amount lock.
- `/payments/iou` — **`IOUs and Claims`** — On-chain IOU registry, claim flow at `/claim` and `/app/claim`.
- `/payments/external-wallets` — **`External Wallet Payments`** — MetaMask/Rabby/Phantom payments detected via relay-payment logs; cart updates triggered.

---

### 2.14 Merchant section

#### `/merchant`
- **Title:** `MoniPay for Merchants`
- **Description:** `Accept gasless stablecoin payments across six chains. Storefront, products, invoices, orders, and a payment gateway API.`
- **JSON-LD:** `Service` + `Offer` ($30/month Storefront Pro)

#### `/merchant/storefront`
- **Title:** `Merchant Storefront — Sell with @MoniTag`
- **Description:** `Public storefront at monipay.xyz/store/@yourtag. Cart limit 99 items, optional shipping form, 2.5s redirect on success.`
- **JSON-LD:** `Store`

#### `/merchant/products`, `/merchant/invoices`, `/merchant/orders`
- Standard product/invoice/order CRUD docs.

#### `/merchant/payment-gateway`
- **Title:** `MoniPay Payment Gateway API`
- **Description:** `Hosted checkout at monipay.xyz/pay?orderId=… HMAC-SHA256 signed webhooks. Public/secret key auth.`

#### `/merchant/api-keys`
- **Title:** `Generate API Keys`
- **Description:** `Public + secret keys per merchant. Rotate anytime. Rate limited (5/wallet/min, 10/IP/min on relay-payment).`

#### `/merchant/webhooks`
- **Title:** `Webhooks Reference`
- **Description:** `HMAC-SHA256 signed POST to your callback URL on payment completion. Retry policy and signature verification examples.`

---

### 2.15 MoniBot section

#### `/monibot`
- **Title:** `MoniBot — AI Payment Agent`
- **Description:** `Autonomous AI agent that processes crypto payments and giveaways on Discord, Telegram and X.`
- **JSON-LD:** `SoftwareApplication`

#### `/monibot/discord` (reference implementation)
- **Title:** `MoniBot for Discord`
- **Description:** `Slash commands: /send, /drop, /balance, /link. Reference implementation for all MoniBot platforms.`

#### `/monibot/telegram`, `/monibot/twitter`
- Platform-specific commands and limits (e.g., Twitter bans links, 18-char hash limit).

#### `/monibot/commands`
- **Title:** `MoniBot Commands Reference`
- Multi-recipient parsing (comma + "and"), Tempo keywords (`on tempo`, `tempo`, `alphausd`, `ausd`), regex → Gemini 2.0-flash fallback.

#### `/monibot/campaigns`
- Campaign giveaways, gas sponsorship from executor wallet, network-specific allowance (Tempo bypassed).

---

### 2.16 Developers section

#### `/developers/api-reference`
- **Title:** `MoniPay API Reference`
- **Description:** `REST API for payment links, orders, webhooks, and MoniTag resolution. HMAC-SHA256 signed.`
- **JSON-LD:** `APIReference`

#### `/developers/webhooks`
- Same content as merchant webhooks, dev-focused.

#### `/developers/chrome-extension`
- **Title:** `MoniPay Chrome Extension`
- **Description:** `window.monipay.requestPayment() API for gasless stablecoin payments inside any web app.`

#### `/developers/sdk`
- Future SDK reference; placeholder with `noindex` until shipped.

---

### 2.17 Mobile section

#### `/mobile/install-pwa`
- **Title:** `Install MoniPay as a PWA`
- **Description:** `Add MoniPay to your home screen. Offline support via service worker. 7-day install-prompt dismissal memory.`

#### `/mobile/flutter-app`
- **Title:** `MoniPay Native Flutter App`
- **Description:** `Strict visual and functional parity with the web app. Flutter SDK 3.27+, Dart 3.6+.`

---

### 2.18 Security section

#### `/security/architecture`
- **Title:** `Security Architecture`
- **Description:** `Client-side AES-256-GCM key encryption, Argon2id PIN hashing, RLS on all DB tables, HMAC-SHA256 signed APIs, rate limiting.`

#### `/security/audits`
- Public audit reports (link or "coming soon" with `noindex` until live).

---

### 2.19 `/faq` — Master FAQ page (CRITICAL for SEO)

- **Title:** `MoniPay FAQ — Frequently Asked Questions`
- **Description:** `Everything about MoniPay: gasless payments, MoniTag™, MoniBot, supported chains, security, fees, merchant tools, and developer API.`
- **JSON-LD:** Single `FAQPage` containing **all** Q&As below

#### Section A — General
1. **What is MoniPay?** A non-custodial, gasless stablecoin payment network spanning Base, BSC, Solana, Tempo, Ink and Celo. Send by MoniTag™ — a human-readable username.
2. **Who built MoniPay?** MoniPay is built and operated by the MoniPay team. See the [About page](https://monipay.xyz/about).
3. **Is MoniPay open source?** Smart contracts are verified on each chain's explorer. Core app source is closed.
4. **What chains does MoniPay support today?** Base (USDC), BSC (USDT), Solana (USDC SPL), Tempo (αUSD), Ink, Celo (cUSD via MiniPay).
5. **Is MoniPay free to use?** Personal sends are free of gas; merchants pay 1% per transaction. Storefront Pro is $30/month.

#### Section B — MoniTag™
6. **What is a MoniTag™?** A unique username that maps to your wallet address on every supported chain.
7. **Are MoniTags case-sensitive?** Stored lowercase. UI may display as you typed.
8. **Can I change my MoniTag™?** No. Pick carefully.
9. **What characters are allowed?** Lowercase letters, digits, underscore. Length 3–20.
10. **What if my MoniTag™ is reserved?** A 150+ word blocklist prevents impersonation (admin, support, monipay, etc.). Try a variant.
11. **Can I have multiple MoniTags™?** One per account. Use store sub-paths for brand variants.

#### Section C — Wallets & Security
12. **Is MoniPay custodial?** No. Keys are generated locally and encrypted with your PIN (AES-256-GCM).
13. **Where is my private key stored?** localStorage on web (encrypted), Secure Enclave/KeyStore on native, never on MoniPay servers. Solana key is **localStorage-only**.
14. **Can MoniPay access my funds?** No. We have no copy of your private key.
15. **What happens if I forget my PIN?** Restore from your encrypted backup file or Google Drive backup. Without either, funds are unrecoverable. PIN-only.
16. **Does MoniPay use seed phrases?** No. We use PIN-encrypted local keys. Seed-phrase compatibility is not exposed by default.
17. **What is the Walkaway Test?** If MoniPay shuts down, your encrypted key still works with any Ethereum/Solana tooling. You own your funds.
18. **What encryption is used?** AES-256-GCM for the key, Argon2id for the PIN hash.
19. **What about lockout?** 5 failed PIN attempts triggers a temporary lockout.
20. **Is biometric unlock supported?** Yes on native (FaceID/TouchID/fingerprint).

#### Section D — Payments
21. **How do I send a payment?** Enter `@MoniTag` → amount → confirm with PIN. Settled on-chain in seconds.
22. **Why are payments gasless?** MoniPay sponsors gas via ERC-2771 (Base/BSC), native `feePayer` (Tempo), and feePayer relay (Solana).
23. **What is the platform fee?** 1% per transaction, split atomically by the router contract.
24. **Are there minimums or maximums?** No hard minimum; rate limits apply (5/wallet/min, 10/IP/min on relay).
25. **Do payments settle on-chain?** Yes, every payment is a real on-chain transfer with an explorer link.
26. **Can I pay someone on a different chain?** Cross-chain auto-routing picks the chain where you have balance and the recipient is supported.
27. **Can I send to a non-MoniPay user?** Use an IOU at `/claim`; recipient claims later by creating a MoniTag.
28. **Can I cancel a payment?** Once signed and broadcast, no. On-chain is final.

#### Section E — Merchants
29. **How do I become a merchant?** Sign up, create a MoniTag™, enable merchant mode in settings.
30. **What is Storefront Pro?** $30/month subscription unlocking `/store/@yourtag` storefront customization.
31. **How does the payment gateway work?** Redirect customers to `monipay.xyz/pay?orderId=…` or `/pay/pl_[code]`. Webhook fires on completion.
32. **How are webhooks secured?** HMAC-SHA256 signature in the `X-MoniPay-Signature` header.
33. **What is a payment link?** A `pl_[code]` URL for a fixed or open-amount payment, single or multi-use.
34. **Can I issue invoices?** Yes, with itemized line items, due dates, and one-click pay.
35. **Is there a refund flow?** Initiate refunds manually from the order page; on-chain reverse transfer.

#### Section F — MoniBot
36. **What is MoniBot?** An autonomous AI agent that processes crypto payments and campaigns on Discord, Telegram and X.
37. **Which platform is the reference implementation?** Discord. Telegram and X mirror its behavior with platform-specific adaptations.
38. **How do I link my MoniTag™ to Discord/Telegram?** Use `/link @yourtag` and complete the handshake.
39. **Can MoniBot run giveaways?** Yes. First-come-first-served grants until campaign budget is exhausted.
40. **Does MoniBot support multi-recipient sends?** Yes. Use commas or "and" in the command.
41. **How does MoniBot pay gas?** An executor wallet sponsors gas; on Tempo, allowance approvals are bypassed.

#### Section G — Chains
42. **Which chain should I use?** Base for USDC, BSC for USDT, Solana for USDC SPL, Tempo for αUSD, Celo for cUSD via MiniPay.
43. **What is AlphaUSD?** A TIP-20 stablecoin on Tempo Moderato Testnet (chain ID 42431, 18 decimals).
44. **Is Tempo on mainnet?** Tempo support is currently testnet-only behind the `VITE_ENABLE_TEMPO` flag; the public `/tempo` route bypasses the flag.
45. **Why does Solana use a Twin-Key model?** Ed25519 + relay feePayer enables gasless SPL transfers without key custody.
46. **What is the ERC-8021 builder code?** `bc_qt9yxo1d` is appended to Base transactions for builder attribution.

#### Section H — Developers
47. **Does MoniPay have an SDK?** REST API + Chrome extension `window.monipay.requestPayment()` today; SDK roadmap published in [Changelog](/changelog).
48. **How do I generate API keys?** Merchant settings → API Keys → Generate. Public + secret pair.
49. **What rate limits apply?** 5 requests/wallet/min and 10/IP/min on `relay-payment`.
50. **Where are smart contracts verified?** Basescan, BscScan, contracts.tempo.xyz, Solscan/Solana program registry.

#### Section I — Mobile
51. **Is there a mobile app?** Native Flutter app (SDK 3.27+, Dart 3.6+) with strict parity to web. PWA also supported.
52. **Does the PWA work offline?** Network-first service worker cache; deep links via `monipay://pay?to=…`.
53. **Are push notifications supported?** Yes, with deep-link routing to the relevant transaction.

#### Section J — Privacy & Legal
54. **What data does MoniPay collect?** Account email, MoniTag™, transaction metadata. No private keys, no PIN.
55. **How do I delete my account?** Soft delete via Settings → Delete Account. `profiles.status='deactivated'`. Data retained for compliance; account blocked from re-import.
56. **Where can I read the privacy policy?** [monipay.xyz/privacy](https://monipay.xyz/privacy).
57. **Where are the Terms of Service?** [monipay.xyz/terms](https://monipay.xyz/terms).

---

### 2.20 `/glossary`

- **Title:** `MoniPay Glossary`
- **Description:** `Definitions for MoniPay terminology: MoniTag™, MoniBot, Walkaway Test, ERC-2771, TIP-20, feePayer, and more.`
- **JSON-LD:** Array of `DefinedTerm` items inside a `DefinedTermSet`

Terms to define: MoniPay, MoniTag™, MoniBot, Invisible Wallet, Walkaway Test, Gasless Payment, Paymaster, Relayer, ERC-2771, EIP-712, ERC-8021 Builder Code, TIP-20, AlphaUSD, MiniPay, Storefront Pro, IOU, Payment Link, MoniTag™ Resolution, Twin-Key (Solana), 2D Nonce (Tempo), Soft Delete.

---

### 2.21 `/changelog`

- **Title:** `MoniPay Changelog`
- **Description:** `Release notes for the MoniPay app, smart contracts, MoniBot and SDK.`
- **JSON-LD:** `Article` per release; expose RSS at `/changelog/rss.xml`.

---

### 2.22 `/brand`

- **Title:** `MoniPay Brand Assets`
- **Description:** `Logos, colors, typography, and usage rules. Trantor minimal aesthetic. F5F5F7 / 0E0F14, DM Sans.`

Cover: locked black `Moni` watermark on receipts, MoniTag™ casing rules, "no em dashes on chain pages", banned phrase "Not Just".

---

### 2.23 `/support`

- **Title:** `MoniPay Support`
- **Description:** `Get help with MoniPay. Contact channels, status page, and security disclosures.`

Include `security.txt` link and mention `/.well-known/security.txt` policy.

---

### 2.24 `/legal/privacy` and `/legal/terms`

Either mirror the canonical text from `monipay.xyz/privacy` and `/terms` with a `<link rel="canonical" href="https://monipay.xyz/privacy">` pointing back to the app, **or** host independent copies and self-canonicalize. Pick one and stick to it. Include a visible `<time datetime="…">Last updated</time>` element.

---

## 3. Internal linking matrix

Every page must link to at least 3 other docs pages. Suggested patterns:

- Concepts pages → corresponding chain pages and FAQ
- Chain pages → `/getting-started/fund-wallet`, `/payments/p2p`, `/security/architecture`
- Merchant pages → `/developers/webhooks`, `/merchant/api-keys`, `/payments/payment-links`
- MoniBot pages → `/monibot/commands`, `/monibot/campaigns`, `/glossary`
- Every page → `/faq` and `/glossary`

Anchor text should be descriptive (`"create a MoniTag"`), never `"click here"`.

---

## 4. Image & a11y standards

- Every `<img>` / `<Image>` must have descriptive `alt`. Decorative icons get `aria-hidden="true"`.
- Hero LCP image per page uses `priority` (next/image).
- Below-fold images use default lazy loading.
- Use `<picture>` only for art-directed responsive images; otherwise plain `next/image`.
- Color contrast ≥ 4.5:1 in both themes.
- Skip-to-content link on every page.
- All forms have visible labels and `aria-describedby` for error text.

---

## 5. Per-page OG image generation

Generate per-route OG images (`1200×630`, light or dark Trantor backgrounds, DM Sans, "MoniTag™" lowercase `m` uppercase `T`):

```
/public/og/
  default.png            (used by home + fallback)
  getting-started.png
  monitag.png
  invisible-wallet.png
  gasless.png
  multi-chain.png
  walkaway.png
  base.png  bsc.png  solana.png  tempo.png  ink.png  celo.png
  wallet-security.png  wallet-backup.png
  payments-p2p.png  payments-qr.png  payments-links.png  payments-iou.png
  merchant.png  storefront.png  payment-gateway.png  webhooks.png
  monibot.png  monibot-discord.png  monibot-telegram.png  monibot-twitter.png
  developers-api.png  chrome-extension.png
  mobile-pwa.png  mobile-flutter.png
  security.png  faq.png  glossary.png  changelog.png  brand.png
```

Reuse the existing MoniPay app OG images where they already exist (`base.png`, `bsc.png`, `solana.png`, `tempo.png`, `ink.png`, `monibot.png`, `minipay.png`, `install.png`, `default.png` are already shipped in the main app's `/public/og/` and can be copied verbatim).

---

## 6. Indexing & ranking acceleration

Day 1:
1. Submit sitemap to Google Search Console + Bing Webmaster Tools.
2. Configure IndexNow API key in `/.well-known/{key}.txt` and ping Bing on every publish.
3. Add the docs URL to Google Search Console as a property; verify via DNS TXT.
4. From the main `monipay.xyz` site, add prominent footer + nav links to `docs.monipay.xyz` (passes link equity).
5. Cross-link from `monipay.xyz/docs` (which currently 301s — keep the redirect to `docs.monipay.xyz`).
6. Tweet the docs launch from `@monaborng` with a per-section thread (each with the deep link).
7. Submit the homepage to Reddit (`r/CryptoCurrency`, `r/ethereum`, `r/solana`, `r/CryptoTechnology`) and HackerNews.

Week 1:
- Publish 3 long-form articles in `/concepts/*` and link them from the homepage.
- Pitch listings on `defillama.com`, `crypto.com/price`, `coingecko.com` (knowledge base section).
- Add `Article` JSON-LD to all concept and changelog pages.
- Get inbound links from MoniPay's GitHub READMEs (`monipay-mobile`, `chrome-extension`, contracts).

Ongoing:
- Update `lastmod` in `sitemap.ts` on every change (Next.js does this automatically when you derive from filesystem mtimes).
- Add a `<link rel="alternate" hreflang>` block once localized routes ship (8 languages already supported in the main app).

---

## 7. Forbidden actions (consistency with the main app)

- Do **not** alter MoniTag™ casing rules.
- Do **not** use the phrase "Not Just" anywhere.
- Do **not** use em dashes on chain pages (`/chains/*`).
- Do **not** describe MoniPay as a "service" — use "Hammer", "network", or "infrastructure".
- Do **not** publish private RPC keys, executor private keys, or any secret env values.
- Do **not** claim mainnet support for Tempo until the flag flips.

---

## 8. Verification checklist (before merging each page)

- [ ] Unique `<title>` ≤ 60 chars
- [ ] Unique meta description ≤ 160 chars
- [ ] Single `<h1>`
- [ ] Canonical URL set
- [ ] OG + Twitter tags present
- [ ] JSON-LD validates at `https://validator.schema.org`
- [ ] All images have `alt`
- [ ] At least 3 internal links
- [ ] FAQ block (where applicable) renders accordions **and** emits `FAQPage` JSON-LD
- [ ] Lighthouse SEO ≥ 95
- [ ] No console errors
- [ ] Mobile viewport renders cleanly at 360px width
- [ ] Page included in `sitemap.ts`

---

## 9. Appendix — MDX frontmatter template

For every docs page:

```mdx
---
title: "Send a Gasless Stablecoin Payment"
description: "Send USDC/USDT/αUSD/cUSD by MoniTag in seconds. Zero gas. Non-custodial. Cross-chain auto-routing."
canonical: "https://docs.monipay.xyz/getting-started/send-payment"
ogImage: "/og/getting-started.png"
breadcrumbs:
  - { name: "Home", url: "/" }
  - { name: "Getting Started", url: "/getting-started" }
  - { name: "Send a Payment", url: "/getting-started/send-payment" }
faq:
  - q: "How long does a payment take?"
    a: "Usually under 5 seconds, depending on the chain's finality."
  - q: "Who pays the gas?"
    a: "MoniPay sponsors gas via ERC-2771 (Base/BSC), native feePayer (Tempo), or relay feePayer (Solana)."
updated: "2026-05-12"
---
```

A shared `<DocsPageMeta frontmatter={…} />` component should consume this and render `<title>`, meta, OG, canonical, breadcrumbs, JSON-LD (BreadcrumbList + FAQPage), and the `<time datetime>` "Last updated" stamp.

---

**End of brief.** Hand this file to the docs-app implementer (or another AI). It contains everything needed to rebuild `docs.monipay.xyz` as an SEO-first, server-rendered Next.js docs site that ranks for "MoniPay" within days of launch.
