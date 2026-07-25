# SEO-IMPLEMENTATION.md

**Audience:** the AI agent that will execute this document in a follow-up build session.
**Author:** Chief Architect, MoniPay.
**Scope flag:** `Strict + lightweight perf` · **Routes:** all public routes · **Hreflang:** `x-default` + `en` today, scaffolded for 8-language expansion.

> **Mission**
> Improve MoniPay's on-site SEO without changing a single line of business logic, routing, wallet, balance, relay, context, or auth code. You are editing `<head>`, static assets, JSON-LD, semantic markup, `alt`/`aria-*`/`loading`/`fetchpriority` attributes, `robots.txt`, `sitemap.xml`, and `manifest.json`. Nothing else.

---

## 0. Mission & Guardrails (READ FIRST — DO NOT SKIP)

### 0.1 Hard rules
1. **Do not** install or configure `vite-react-ssg`, `vite-plugin-prerender`, `react-snap`, or any prerender/SSR tool. MoniPay's entry chain touches `localStorage`, `window.crypto`, `wagmi`, the Supabase client, the Solana adapter, and `PayTagContext` at module load — prerender will crash the build or silently strip critical state.
2. **Do not** create `public/_redirects`, `vercel.json`, `netlify.toml`, or `_headers`. Lovable hosting ignores them (built-in SPA fallback).
3. **Do not** add an SSR/edge function for `/store/:payTag` or `/pay/:linkCode`. They are intentionally decoupled from auth via localStorage lookup.
4. **Do not** add language-prefixed URLs (`/fr/...`, `/es/...`) or a `:lang?` router segment. That's an architectural change, not SEO.
5. **Do not** change router config, contexts, hooks, edge functions, Supabase migrations, or any wallet/balance/relay code.
6. **Do not** modify `BrandedQR.tsx`, `Receipt*.tsx`, `Invoice*.tsx`, or anything that affects QR pixel layout or receipt branding (memory: QR UI Constraint, Branding Details).
7. **Do not** convert `<img>` to `<picture>` / WebP swap. Add attributes only.
8. **Do not** add lazy-loading to route components, change Service Worker caches, or split bundles.
9. **Do not** disallow `/claim` or `/app/claim` in `robots.txt`. Use page-level `noIndex` only — these need to be linkable from emails/Twitter.
10. **Do not** create `sitemap-stores.xml` or a build-time DB sitemap (out of scope without prerender).
11. **Do not** replace the existing `/og-image.png` (it is the fallback). Add new images alongside it.
12. **Do not** echo or log any secret env var.

### 0.2 Why these rules exist
The audit you were given recommends prerendering, edge SSR, and localized routes. Those would deliver real SEO wins but they require changes to runtime behavior that this scope explicitly forbids. Helmet writes to the runtime `<head>`, which means Googlebot (two-pass JS) will index your changes; LinkedIn / Discord / Slack previews will not. That tradeoff is accepted. Do not relitigate it.

### 0.3 Definition of done
You may close this task only when every section A–M is implemented or explicitly marked `// TODO(seo-i18n)` per the doc, and the verification checklist (Section M) passes.

---

## 1. Pre-flight (read these files before editing)

- `index.html`
- `src/components/PageMeta.tsx`
- `src/pages/Index.tsx`, `About.tsx`, `HowItWorks.tsx`, `UseCases.tsx`, `Privacy.tsx`, `Terms.tsx`
- `src/pages/Base.tsx`, `BSC.tsx`, `Solana.tsx`, `Tempo.tsx`, `Ink.tsx`, `MiniPay.tsx`
- `src/pages/Pay.tsx`, `Store.tsx`, `ClaimIOU.tsx`, `Docs.tsx`, `Install.tsx`, `Deck.tsx`, `NotFound.tsx`
- `src/pages/DiscordCallback.tsx`, `TelegramCallback.tsx`, `x-callback.tsx`
- `src/pages/MoniBot.tsx`, `src/components/MoniBotLanding.tsx`
- `public/robots.txt`, `public/sitemap.xml`, `public/manifest.json`, `public/llm.txt`

Read in parallel batches. Do not skim.

---

## Section A — `index.html`

Apply these edits exactly. Preserve any existing tags not mentioned.

1. Remove the `<!-- TODO: Set the document title... -->` comment.
2. Replace `<title>` with:
   `<title>MoniPay — Gasless Crypto Payments on Base, BSC, Solana, Tempo & More</title>`
3. Replace the meta description with:
   `<meta name="description" content="Send stablecoins by username. Zero gas. Non-custodial. Multi-chain across Base, BSC, Solana, Tempo, Ink and Celo." />`
4. Move the OG image to your own domain. Add `/public/og/default.png` (Section H) and set:
   `<meta property="og:image" content="https://monipay.xyz/og/default.png" />`
   `<meta name="twitter:image" content="https://monipay.xyz/og/default.png" />`
5. Add `<meta property="og:locale" content="en_US" />` and one alternate per supported language: `fr_FR, ar_SA, es_ES, ja_JP, zh_CN, ru_RU, pt_BR`.
6. Add `<meta name="twitter:creator" content="@monaborng" />` (verify against `twitter:site` already present; do not invent a new handle).
7. **Remove the line** `<link rel="canonical" href="https://monipay.xyz" />`. PageMeta emits canonical per route; the static one overrides everything.
8. Fix the LCP preload: change `<link rel="preload" as="image" href="/monipay-phone.svg" />` to `href="/monipay-phone.png"` (matches what Landing actually renders) and add `fetchpriority="high"`.
9. Add explicit robots:
   `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`
10. Add `<meta name="application-name" content="MoniPay" />` and `<meta name="format-detection" content="telephone=no" />`.
11. Add icons:
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` (only if file exists, else skip),
    `<link rel="icon" sizes="32x32" href="/favicon-32.png" />` (only if file exists, else skip),
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />` (only if file exists, else skip).
    Do not invent files.
12. Add preconnects (use the actual Supabase project ref already present in the codebase — read `src/integrations/supabase/client.ts` to find it):
    ```html
    <link rel="preconnect" href="https://<SUPABASE_REF>.supabase.co" crossorigin />
    <link rel="dns-prefetch" href="https://accounts.google.com" />
    <link rel="preconnect" href="https://base-rpc.publicnode.com" />
    <link rel="preconnect" href="https://bsc-dataseed.binance.org" />
    <link rel="preconnect" href="https://api.mainnet-beta.solana.com" />
    <link rel="preconnect" href="https://rpc.moderato.tempo.xyz" />
    ```
13. **Dedupe OG / Twitter tags.** The audit found duplicate `og:title`, `og:description`, `twitter:title`, `twitter:description` blocks. Keep one of each only. Verify by `rg -n 'og:title\|twitter:title' index.html` after editing.
14. Add a `<noscript>` fallback inside `<body>` (NOT `<head>` — HTML5 forbids non-metadata children in head noscript). Place it right after `<div id="root"></div>`:
    ```html
    <noscript>
      <div style="font-family:system-ui;padding:24px;max-width:720px;margin:auto">
        <h1>MoniPay — Gasless crypto payments by username</h1>
        <p>MoniPay lets you send stablecoins across Base, BSC, Solana, Tempo, Ink and Celo with zero gas. Non-custodial. You hold the keys.</p>
        <p>Enable JavaScript to use the app, or visit:</p>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/how-it-works">How it works</a></li>
          <li><a href="/use-cases">Use cases</a></li>
          <li><a href="/base">MoniPay on Base</a></li>
          <li><a href="/bsc">MoniPay on BSC</a></li>
          <li><a href="/solana">MoniPay on Solana</a></li>
          <li><a href="/tempo">MoniPay on Tempo</a></li>
        </ul>
      </div>
    </noscript>
    ```
15. Add site-wide JSON-LD inside `<head>` (one `<script type="application/ld+json">` per schema, NOT combined):
    - **Organization** with `name: "MoniPay"`, `url: "https://monipay.xyz"`, `logo: "https://monipay.xyz/og/default.png"`, `sameAs: ["https://twitter.com/monaborng", "https://discord.gg/monipay"]` (verify each link exists in the codebase before including; drop any you cannot confirm).
    - **WebSite** with `name`, `url`, and a `potentialAction` of type `SearchAction` ONLY IF a public search exists (it does not — so omit `potentialAction` entirely).

---

## Section B — `src/components/PageMeta.tsx`

**Constraint: purely additive.** Every existing prop and behavior must continue to work. Do not rename, remove, or change defaults of existing props.

### B.1 New props
```ts
jsonLd?: object | object[];
themeColor?: string;
breadcrumbs?: { name: string; url: string }[];
alternates?: { hreflang: string; href: string }[];
twitterCreator?: string;
noIndexFollow?: boolean; // when true with noIndex, emit "noindex, follow" instead of "noindex, nofollow"
```

### B.2 Behavior
- **Default description:** rewrite `DEFAULT_DESCRIPTION` to `"Gasless, non-custodial stablecoin payments across Base, BSC, Solana, Tempo, Ink and Celo. Send crypto by username with MoniTag™."` (preserve the `™`).
- **Default title fallback:** change to `"MoniPay — Gasless Multi-Chain Payments"`.
- **`<html lang>`:** emit via Helmet's `<html lang={i18n.language || 'en'}>` so the runtime language is reflected. If the project's i18n hook is not trivial to import here, fall back to `lang="en"` and add a `// TODO(seo-i18n)` comment.
- **Robots variant:** when `noIndex` is true, emit `noindex, nofollow` by default; if `noIndexFollow` is true, emit `noindex, follow`.
- **Theme color:** if `themeColor` provided, emit `<meta name="theme-color" content={themeColor} />`.
- **JSON-LD:** if `jsonLd` provided, emit one `<script type="application/ld+json">` per object (handle array case).
- **Breadcrumbs:** if `breadcrumbs` provided, emit a `BreadcrumbList` JSON-LD via the helper from Section D.
- **Alternates / hreflang:** if `alternates` provided, emit `<link rel="alternate" hreflang={x.hreflang} href={x.href} />` per entry. If not provided, **default** to `[{ hreflang: 'x-default', href: canonical }, { hreflang: 'en', href: canonical }]` for any non-`noIndex` page.
- **Twitter creator:** if `twitterCreator` provided, emit `<meta name="twitter:creator" content={twitterCreator} />`.

### B.3 TODO scaffolding
Add this comment block at the top of `PageMeta.tsx`:
```ts
// TODO(seo-i18n): When localized routes ship, generate alternates dynamically:
//   const LOCALES = ['es','fr','pt','ru','zh','ja','ar'] as const;
//   alternates = [
//     { hreflang: 'x-default', href: `https://monipay.xyz${path}` },
//     { hreflang: 'en',        href: `https://monipay.xyz${path}` },
//     ...LOCALES.map(l => ({ hreflang: l, href: `https://monipay.xyz/${l}${path}` })),
//   ];
```

---

## Section C — Per-page additions

| Page | Title | Description | jsonLd | noIndex | breadcrumbs |
|------|-------|-------------|--------|---------|-------------|
| `Index.tsx` (`/`) | `MoniPay — Gasless Multi-Chain Payments by Username` | Default (rewritten in B.2) | `[Organization, WebSite, SoftwareApplication('multi')]` | – | – |
| `About.tsx` | `About MoniPay — Non-Custodial Multi-Chain Wallet` | `Learn about MoniPay — decentralized gasless payments across Base, BSC, Solana, Tempo, Ink and Celo. Non-custodial. You hold the keys.` | `AboutPage` + `Organization` | – | Home → About |
| `HowItWorks.tsx` | (keep existing or refine) | (keep) | `FAQPage` (from existing FAQ array on the page) + `HowTo` (from existing 6-step array) | – | Home → How it works |
| `UseCases.tsx` | (keep) | Expand to mention "street vendors, freelancers, creators, e-commerce, payroll" | `ItemList` of use-case categories + `WebPage` | – | Home → Use cases |
| `Privacy.tsx` | (keep) | (keep) | `WebPage` with `dateModified` (extract `LAST_UPDATED` const, use in both UI `<time>` tag and schema) | – | Home → Privacy |
| `Terms.tsx` | (keep) | (keep) | `WebPage` with `dateModified` (same pattern) | – | Home → Terms |
| `Base.tsx` | (keep) | (keep) | `getSoftwareApplicationSchema('base')` (refactor existing inline JSON-LD to use helper) | – | Home → Base |
| `BSC.tsx` | (keep) | (keep) | `getSoftwareApplicationSchema('bsc')` | – | Home → BSC |
| `Solana.tsx` | (keep) | (keep) | `getSoftwareApplicationSchema('solana')` | – | Home → Solana |
| `Tempo.tsx` | `MoniPay on Tempo — Fully Sponsored aUSD Payments` | (keep or refine, do not use em dashes per copywriting memory) | `getSoftwareApplicationSchema('tempo')` | – | Home → Tempo |
| `Ink.tsx` | `MoniPay on Ink — Coming Soon` | (keep) | `getSoftwareApplicationSchema('ink')` | – | Home → Ink |
| `MiniPay.tsx` | (keep) | (keep) | `getSoftwareApplicationSchema('celo')` | – | Home → MiniPay |
| `MoniBotLanding.tsx` (`/monibot`) | (keep) | (keep) | Existing `FAQPage` ✓ + add `SoftwareApplication` (subtype of MoniPay) | – | Home → MoniBot |
| `Install.tsx` | (keep) | (keep) | `SoftwareApplication` with `installUrl` | – | – |
| `Pay.tsx` (`/pay`, `/pay/:linkCode`) | (keep dynamic) | (keep dynamic) | – | **YES**, with `noIndexFollow={true}` | – |
| `Store.tsx` (`/store/:payTag`) | `${displayPayTag} on MoniPay — Shop with Crypto` | from `storeSettings.tagline` (fallback to default) | `getStoreSchema(storeSettings)` + `BreadcrumbList` | – | Home → Stores → @tag |
| `ClaimIOU.tsx` (`/claim`, `/app/claim`) | (keep) | (keep) | – | **YES** (default `noindex, nofollow`) | – |
| `Docs.tsx` (`/docs`) | `MoniPay Docs` | `MoniPay developer documentation.` | – | **YES**, with `noIndexFollow={true}` | – |
| `NotFound.tsx` | `Page Not Found — MoniPay` | `The page you're looking for doesn't exist.` | – | **YES** (default) | – |
| `DiscordCallback.tsx`, `TelegramCallback.tsx`, `x-callback.tsx` | (any) | (any) | – | **YES** (default — token-leak protection) | – |
| `Deck.tsx` (`/deck`) | (keep) | (keep) | – | **YES** (already set ✓) — also remove from sitemap | – |
| `MoniBot.tsx` (`/m0n1b0t-cmd`) | (keep) | (keep) | – | **YES** (already set ✓) | – |

**Important for `Store.tsx`:** This is client-rendered content. Helmet will populate `<head>` for Googlebot's two-pass crawl, but LinkedIn/Discord/Slack previews will see only `index.html`. That's an accepted limitation under this scope — document it in a one-line comment in the file.

---

## Section D — `src/lib/schema.ts` (new file)

Create a pure helper module — no React imports, no app-state imports, no side effects.

```ts
// src/lib/schema.ts
// Pure JSON-LD builders. No imports from React or app state.

const SITE = 'https://monipay.xyz';
const NAME = 'MoniPay';

export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: NAME,
  url: SITE,
  logo: `${SITE}/og/default.png`,
  sameAs: [
    'https://twitter.com/monaborng',
    // add other verified socials here
  ],
});

export const getWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: NAME,
  url: SITE,
});

type ChainKey = 'base' | 'bsc' | 'solana' | 'tempo' | 'ink' | 'celo' | 'multi';

const CHAIN_META: Record<ChainKey, { label: string; token: string; path: string }> = {
  base:   { label: 'Base',    token: 'USDC',     path: '/base' },
  bsc:    { label: 'BSC',     token: 'USDT',     path: '/bsc' },
  solana: { label: 'Solana',  token: 'USDC',     path: '/solana' },
  tempo:  { label: 'Tempo',   token: 'aUSD',     path: '/tempo' },
  ink:    { label: 'Ink',     token: 'USDC',     path: '/ink' },
  celo:   { label: 'Celo',    token: 'cUSD',     path: '/minipay' },
  multi:  { label: 'Multi-chain', token: 'Stablecoins', path: '/' },
};

export const getSoftwareApplicationSchema = (chain: ChainKey) => {
  const c = CHAIN_META[chain];
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: chain === 'multi' ? NAME : `${NAME} on ${c.label}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, iOS, Android',
    url: `${SITE}${c.path}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: chain === 'multi'
      ? `Gasless non-custodial stablecoin payments across multiple chains.`
      : `Send ${c.token} on ${c.label} by username with zero gas via ${NAME}.`,
  };
};

export const getFAQPageSchema = (qa: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

export const getHowToSchema = (name: string, steps: { name: string; text: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name,
  step: steps.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.name,
    text: s.text,
  })),
});

export const getBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: it.url,
  })),
});

export const getStoreSchema = (s: {
  payTag: string;
  displayName?: string;
  tagline?: string;
  bannerUrl?: string;
  logoUrl?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: s.displayName || `@${s.payTag}`,
  description: s.tagline || `Shop @${s.payTag} with crypto on MoniPay.`,
  url: `${SITE}/store/${s.payTag}`,
  image: s.bannerUrl || s.logoUrl || `${SITE}/og/default.png`,
});

export const getAboutPageSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: `About ${NAME}`,
  url: `${SITE}/about`,
});

export const getWebPageSchema = (opts: { name: string; path: string; dateModified?: string }) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: opts.name,
  url: `${SITE}${opts.path}`,
  ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
});
```

---

## Section E — `public/robots.txt` (full replacement)

```
# MoniPay robots.txt
# Indexable by default. AI bots explicitly allowed (see /llm.txt).

User-agent: *
Allow: /
Disallow: /m0n1b0t-cmd
Disallow: /discord-callback
Disallow: /telegram-callback
Disallow: /x-callback
Disallow: /pay
Disallow: /pay/

# Explicit AI-bot allow list (mirrors llm.txt policy)
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: anthropic-ai
Allow: /

Sitemap: https://monipay.xyz/sitemap.xml
```

> **Note:** `/claim` and `/app/claim` are NOT disallowed. They use page-level `noIndex` so emails and Twitter share-link previews still work.

---

## Section F — `public/sitemap.xml` (full replacement)

- Add: `/monibot`, `/ink`, `/minipay`, `/install`, `/docs`.
- Remove: `/deck` (it carries `noIndex`).
- Add `<lastmod>2026-05-10</lastmod>` for every URL.
- Add image sitemap entries (`xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`) for `/`, `/base`, `/bsc`, `/solana`, `/tempo`, `/ink`, `/minipay`, `/monibot` pointing at the per-route OG images from Section H.
- Do **not** create `sitemap-index.xml` or `sitemap-stores.xml`.

Skeleton:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://monipay.xyz/</loc>
    <lastmod>2026-05-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>https://monipay.xyz/og/default.png</image:loc></image:image>
  </url>
  <!-- repeat for: /about, /how-it-works, /use-cases, /privacy, /terms,
       /base, /bsc, /solana, /tempo, /ink, /minipay, /monibot, /install, /docs -->
</urlset>
```

---

## Section G — `public/manifest.json`

Additive edits only:
1. Add `"id": "/"`.
2. Populate `"screenshots"` array IF and ONLY IF screenshot files already exist in `/public/`. Search with `rg -i 'screenshot' public/` first. If none exist, leave `"screenshots": []` and add a `// TODO` comment in this doc's verification section instead. **Do not generate fake screenshots.**
3. Do not change `display`, `theme_color`, `background_color`, `start_url`, or `categories`.

If screenshots exist, format:
```json
"screenshots": [
  { "src": "/screenshots/mobile-1.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" },
  { "src": "/screenshots/mobile-2.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" },
  { "src": "/screenshots/desktop-1.png", "sizes": "1280x800", "type": "image/png", "form_factor": "wide" }
]
```

---

## Section H — Per-route OG images

Generate one image per public landing route at `/public/og/{slug}.png` using `imagegen--generate_image` with `model: 'premium'` (text legibility) and dimensions `1200x630`.

**Aesthetic constraints (memory-enforced):**
- Trantor minimal: light background `#F5F5F7` OR dark `#0E0F14`.
- DM Sans typography.
- "MoniTag™" must use lowercase `m`, uppercase `T`, and the `™` glyph.
- Never use the phrase "Not Just".
- Chain pages (`base`, `bsc`, `solana`, `tempo`, `ink`, `minipay`) **must not** contain em dashes (`—`). Use periods or commas.

**Files to generate:**
| File | Prompt |
|------|--------|
| `og/default.png` | "Trantor minimal OG card, 1200x630, light #F5F5F7 background, DM Sans. Title 'MoniPay'. Subtitle 'Gasless multi-chain payments by username'. Small chain logos row: Base, BSC, Solana, Tempo, Ink, Celo." |
| `og/base.png` | "Trantor OG card, 1200x630, dark #0E0F14. Title 'MoniPay on Base'. Subtitle 'Send USDC by username. Zero gas.' Subtle Base blue accent." |
| `og/bsc.png` | "Trantor OG card, 1200x630, dark #0E0F14. Title 'MoniPay on BSC'. Subtitle 'Send USDT by username. Zero gas.' Subtle BSC yellow accent." |
| `og/solana.png` | "Trantor OG card, 1200x630, dark #0E0F14. Title 'MoniPay on Solana'. Subtitle 'Send USDC by username. Zero gas.' Subtle Solana purple-green gradient accent." |
| `og/tempo.png` | "Trantor OG card, 1200x630, light #F5F5F7. Title 'MoniPay on Tempo'. Subtitle 'Fully sponsored aUSD payments. Zero fees.'" |
| `og/ink.png` | "Trantor OG card, 1200x630, dark #0E0F14. Title 'MoniPay on Ink'. Subtitle 'Coming soon.'" |
| `og/minipay.png` | "Trantor OG card, 1200x630, light #F5F5F7. Title 'MoniPay for MiniPay'. Subtitle 'Send cUSD on Celo by username.'" |
| `og/monibot.png` | "Trantor OG card, 1200x630, dark #0E0F14. Title 'MoniBot'. Subtitle 'Send crypto with a tweet, post, or DM.'" |
| `og/install.png` | "Trantor OG card, 1200x630, light #F5F5F7. Title 'Install MoniPay'. Subtitle 'Available on iOS, Android, and Web.'" |

After generation, run a QA pass: open each PNG and confirm the rendered text is legible and the aesthetic matches. If text is broken, regenerate with a tighter prompt. **Do not deliver broken OG images.**

Update each affected page's `<PageMeta ogImage="https://monipay.xyz/og/{slug}.png" />`.

---

## Section I — Image & a11y hygiene

Run these greps and fix every match within `src/components/**` and `src/pages/**` ONLY (not `BrandedQR.tsx`, `Receipt*.tsx`, or `Invoice*.tsx`):

1. `rg -n '<img' src/ | rg -v 'alt='` — every `<img>` must have an `alt`. For decorative images use `alt=""`. For meaningful images use a descriptive string.
2. `rg -n '<img' src/ | rg -v 'width='` — add explicit `width` and `height` attributes wherever the rendered size is known (skip dynamic catalog images if dimensions aren't known; do not invent values).
3. **Hero LCP images** on `Index.tsx`/`Landing.tsx`, `Base.tsx`, `BSC.tsx`, `Solana.tsx`, `Tempo.tsx`, `Ink.tsx`, `MiniPay.tsx`, `MoniBotLanding.tsx`: add `fetchpriority="high"` and ensure NO `loading="lazy"`.
4. **Below-fold images**: add `loading="lazy"` and `decoding="async"`.
5. Lucide icons inside text blocks (next to a label that conveys the same meaning): add `aria-hidden="true"`.
6. Top-of-document skip-to-content link in the shared layout/header component (if one exists; otherwise inject at top of each public page's main wrapper):
   ```tsx
   <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:rounded">Skip to content</a>
   ```
   And add `id="main"` to the page's `<main>` (do not change `<div>` to `<main>` if it would alter layout — only add the id where `<main>` already exists).
7. Add `aria-label="Primary"` to the top `<nav>` and `aria-label="Footer"` to the footer `<nav>` on public marketing pages.
8. On `Privacy.tsx` and `Terms.tsx`, replace the hardcoded "Last updated: …" text with a `<time dateTime="2026-01-01">January 2026</time>` element. Hoist the date to a `LAST_UPDATED` const used by both the UI and the `WebPage` JSON-LD.

---

## Section J — New auxiliary files

### `public/.well-known/security.txt`
```
Contact: mailto:security@monipay.xyz
Expires: 2027-01-01T00:00:00.000Z
Preferred-Languages: en
Canonical: https://monipay.xyz/.well-known/security.txt
Policy: https://monipay.xyz/privacy
```

### `public/humans.txt`
```
/* TEAM */
MoniPay — A Hammer. Not a Dishwasher.
Site: https://monipay.xyz

/* THANKS */
Base, BSC, Solana, Tempo, Ink, Celo communities.
```

Do **not** create `browserconfig.xml` unless Windows tile icons exist in `/public/`.

---

## Section K — Hreflang policy (today)

Until localized routes ship:
- Every non-`noIndex` page emits two `alternate` links via PageMeta default: `x-default` and `en`, both pointing at the canonical URL.
- The TODO scaffolding in `PageMeta.tsx` (Section B.3) documents the future shape.
- Do not add `hreflang="fr"`, `"es"`, etc. today — they would point at non-existent URLs and trigger Search Console errors.

---

## Section L — Forbidden actions (recap — re-read before every edit)

- ❌ No prerender / SSR / `vite-react-ssg`.
- ❌ No `_redirects`, `vercel.json`, `netlify.toml`, `_headers`.
- ❌ No edge function for `/store` or `/pay`.
- ❌ No `:lang?` route or new locale URLs.
- ❌ No router changes, no context changes, no hook changes.
- ❌ No edits to `BrandedQR.tsx`, `Receipt*.tsx`, `Invoice*.tsx`.
- ❌ No `<img>` → `<picture>`/WebP swap.
- ❌ No `React.lazy` refactors, no SW changes, no bundle splitting.
- ❌ No `Disallow: /claim` in robots.txt.
- ❌ No replacing `/og-image.png`.
- ❌ No invented social handles, screenshots, or asset paths.

---

## Section M — Verification checklist

Run these checks after implementation. Do not declare done until all pass.

1. `curl -s http://localhost:<port>/ | rg '<title>'` returns the new home title.
2. `curl -s http://localhost:<port>/ | rg 'application/ld\+json' | wc -l` returns ≥ 2 (Organization + WebSite).
3. `rg -n 'rel="canonical"' index.html` returns **zero** matches (canonical now per-route only).
4. `rg -n 'og:title\|twitter:title' index.html` returns exactly one of each.
5. `xmllint --noout public/sitemap.xml` exits 0 (or any equivalent XML validator).
6. `rg -n '/deck' public/sitemap.xml` returns **zero** matches.
7. Open `/pay`, `/claim`, `/404-test-route`, `/discord-callback` in the preview, inspect `<head>`, confirm `<meta name="robots" content="noindex, ...">` is present.
8. Open `/`, `/base`, `/tempo` in the preview, inspect `<head>`, confirm per-route `<title>`, `<meta name="description">`, canonical, JSON-LD, and `og:image` pointing at `/og/{slug}.png`.
9. `rg -n '<img' src/ | rg -v 'alt='` returns **zero** matches outside the excluded files.
10. No TypeScript errors (Lovable's auto build will catch this).
11. No console errors on `/`, `/about`, `/base`, `/tempo`, `/store/<any-existing-tag>`.
12. Visual diff: the home page, each chain landing, and the dashboard render identically to before (no layout shift, no new visible elements except the focus-only skip link).
13. Lighthouse SEO score on `/` ≥ 95.

If any check fails, fix and re-run. Do not hand off a partially-implemented doc.

---

**End of SEO-IMPLEMENTATION.md**