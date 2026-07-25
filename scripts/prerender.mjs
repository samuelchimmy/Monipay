#!/usr/bin/env node
/**
 * Build-time prerender for SEO.
 *
 * Reads dist/index.html and emits one static HTML file per public route
 * (dist/<route>/index.html) with route-specific <title>, <meta>, OG/Twitter
 * tags, canonical URL, and JSON-LD baked in. The SPA still mounts and takes
 * over once JS loads — these files exist purely so non-JS crawlers (Bing,
 * LinkedIn, Discord, Slack, Twitter, Googlebot's first pass) see correct
 * route-specific metadata.
 *
 * Static hosts (Lovable, Netlify, Cloudflare Pages, Vercel static) serve
 * the exact file when it exists and fall back to the SPA's index.html
 * for everything else.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
const SITE = 'https://monipay.xyz';

const SHELL_PATH = resolve(DIST, 'index.html');
if (!existsSync(SHELL_PATH)) {
  console.error('[prerender] dist/index.html not found — run vite build first.');
  process.exit(0); // do not fail the build
}
const SHELL = readFileSync(SHELL_PATH, 'utf8');

// ─────────────────────────────────────────────────────────────────────────
// Route definitions. Keep titles <60 chars and descriptions <160 chars.
// JSON-LD is route-scoped; Organization + WebSite are already in shell.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_OG = `${SITE}/og/default.png`;

const ld = {
  org: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MoniPay',
    url: SITE,
    logo: DEFAULT_OG,
    sameAs: ['https://twitter.com/monaborng'],
  },
  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MoniPay',
    url: SITE,
  },
  app: (chain) => {
    const meta = {
      base:   { label: 'Base',   token: 'USDC', path: '/base' },
      bsc:    { label: 'BSC',    token: 'USDT', path: '/bsc' },
      solana: { label: 'Solana', token: 'USDC', path: '/solana' },
      tempo:  { label: 'Tempo',  token: 'aUSD', path: '/tempo' },
      ink:    { label: 'Ink',    token: 'USDC', path: '/ink' },
      celo:   { label: 'Celo',   token: 'cUSD', path: '/minipay' },
      multi:  { label: 'Multi-chain', token: 'Stablecoins', path: '/' },
    }[chain];
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: chain === 'multi' ? 'MoniPay' : `MoniPay on ${meta.label}`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, iOS, Android',
      url: `${SITE}${meta.path}`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        chain === 'multi'
          ? 'Gasless non-custodial stablecoin payments across multiple chains.'
          : `Send ${meta.token} on ${meta.label} by username with zero gas via MoniPay.`,
    };
  },
  breadcrumb: (items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }),
};

const crumb = (name, path) => [
  { name: 'Home', url: `${SITE}/` },
  { name, url: `${SITE}${path}` },
];

/** @type {{path:string,title:string,description:string,ogImage?:string,jsonLd?:object[],noIndex?:boolean}[]} */
const ROUTES = [
  {
    path: '/',
    title: 'MoniPay — Gasless Multi-Chain Payments by Username',
    description:
      'Send stablecoins by username. Zero gas. Non-custodial. Multi-chain across Base, BSC, Solana, Tempo, Ink and Celo.',
    ogImage: DEFAULT_OG,
    jsonLd: [ld.org, ld.website, ld.app('multi')],
  },
  {
    path: '/about',
    title: 'About MoniPay — Non-Custodial Multi-Chain Wallet',
    description:
      'Learn about MoniPay — decentralized gasless payments across Base, BSC, Solana, Tempo, Ink and Celo. Non-custodial. You hold the keys.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About MoniPay', url: `${SITE}/about` },
      ld.org,
      ld.breadcrumb(crumb('About', '/about')),
    ],
  },
  {
    path: '/how-it-works',
    title: 'How MoniPay Works — Gasless Stablecoin Payments',
    description:
      'See how MoniPay enables gasless crypto payments — create a MoniTag, fund your wallet, and pay anyone instantly across Base, BSC, Solana, Tempo, Ink and Celo.',
    jsonLd: [ld.breadcrumb(crumb('How it works', '/how-it-works'))],
  },
  {
    path: '/use-cases',
    title: 'MoniPay Use Cases — Merchants, P2P, Payroll & More',
    description:
      'Discover how MoniPay powers merchants, P2P transfers, online checkout, payroll, and AI-driven social commerce with gasless stablecoin payments.',
    jsonLd: [ld.breadcrumb(crumb('Use cases', '/use-cases'))],
  },
  {
    path: '/base',
    title: 'MoniPay on Base — Gasless USDC Payments & MoniBot',
    description:
      "MoniPay's home chain. Send USDC instantly on Base using human-readable MoniTags. Powered by MoniBot — the AI agent for social payments.",
    ogImage: `${SITE}/og/base.png`,
    jsonLd: [ld.app('base'), ld.breadcrumb(crumb('Base', '/base'))],
  },
  {
    path: '/bsc',
    title: 'MoniPay on BSC — Gasless USDT Payments by Username',
    description:
      'Send USDT on BNB Smart Chain by username with zero gas. Non-custodial wallet, instant settlement, AI-powered social payments via MoniBot.',
    ogImage: `${SITE}/og/bsc.png`,
    jsonLd: [ld.app('bsc'), ld.breadcrumb(crumb('BSC', '/bsc'))],
  },
  {
    path: '/solana',
    title: 'MoniPay on Solana — Gasless USDC SPL Payments',
    description:
      'Send USDC on Solana by username with zero gas. Twin-key Ed25519 architecture, fee-payer relay, and instant settlement.',
    ogImage: `${SITE}/og/solana.png`,
    jsonLd: [ld.app('solana'), ld.breadcrumb(crumb('Solana', '/solana'))],
  },
  {
    path: '/tempo',
    title: 'MoniPay on Tempo — Native Gasless aUSD Payments',
    description:
      'Send aUSD on Tempo with native fee sponsorship and TIP-20 transfers. Built for payments — no native gas token required.',
    ogImage: `${SITE}/og/tempo.png`,
    jsonLd: [ld.app('tempo'), ld.breadcrumb(crumb('Tempo', '/tempo'))],
  },
  {
    path: '/ink',
    title: 'MoniPay on Ink — Coming Soon',
    description:
      'MoniPay is coming to Ink. Gasless USDC payments by username, powered by the same non-custodial architecture.',
    ogImage: `${SITE}/og/ink.png`,
    jsonLd: [ld.app('ink'), ld.breadcrumb(crumb('Ink', '/ink'))],
  },
  {
    path: '/minipay',
    title: 'MoniPay for MiniPay — Gasless cUSD on Celo',
    description:
      'Use MoniPay inside MiniPay on Celo. Send cUSD by username with zero gas, powered by MoniTag identity.',
    ogImage: `${SITE}/og/minipay.png`,
    jsonLd: [ld.app('celo'), ld.breadcrumb(crumb('MiniPay', '/minipay'))],
  },
  {
    path: '/monibot',
    title: 'MoniBot — AI Agent for Social Crypto Payments',
    description:
      'MoniBot is an autonomous AI agent that processes payments, airdrops, and campaigns via natural language on Twitter, Discord, and Telegram.',
    ogImage: `${SITE}/og/monibot.png`,
    jsonLd: [ld.breadcrumb(crumb('MoniBot', '/monibot'))],
  },
  {
    path: '/install',
    title: 'Install MoniPay — PWA & Mobile Apps',
    description:
      'Install MoniPay on iOS, Android, or as a Progressive Web App. Gasless stablecoin payments in your pocket.',
    ogImage: `${SITE}/og/install.png`,
    jsonLd: [ld.breadcrumb(crumb('Install', '/install'))],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — MoniPay',
    description: 'How MoniPay handles your data. Non-custodial by design — your keys never leave your device.',
    jsonLd: [ld.breadcrumb(crumb('Privacy', '/privacy'))],
  },
  {
    path: '/terms',
    title: 'Terms of Service — MoniPay',
    description: 'Terms of service for using MoniPay, the gasless multi-chain stablecoin payment platform.',
    jsonLd: [ld.breadcrumb(crumb('Terms', '/terms'))],
  },
  {
    path: '/support',
    title: 'MoniPay Support — Help, FAQs & Contact',
    description:
      'Get help with MoniPay. Recover wallets, troubleshoot deposits, fix MoniBot commands, and contact MoniPay support across Base, BSC, Solana and Tempo.',
    jsonLd: [ld.breadcrumb(crumb('Support', '/support'))],
  },
  {
    path: '/stats',
    title: 'MoniPay — Live Platform Traction & Metrics',
    description:
      'Real-time MoniPay protocol metrics: transaction count, volume, Daily Active Users (DAU), platform fees, and gas paid across Base, Celo, BSC, Ink, Tempo, Solana, and Arc.',
    ogImage: DEFAULT_OG,
    jsonLd: [ld.breadcrumb(crumb('Stats', '/stats'))],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// HTML rewriting
// ─────────────────────────────────────────────────────────────────────────

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function rewrite(html, route) {
  const canonical = `${SITE}${route.path}`;
  const title = route.title;
  const desc = route.description;
  const og = route.ogImage || DEFAULT_OG;
  let out = html;

  // <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);

  // meta name="description"
  out = out.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeAttr(desc)}" />`,
  );

  // meta robots — honor noIndex
  if (route.noIndex) {
    if (/<meta\s+name="robots"[^>]*>/i.test(out)) {
      out = out.replace(/<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="noindex, nofollow" />');
    } else {
      out = out.replace('</head>', `  <meta name="robots" content="noindex, nofollow" />\n</head>`);
    }
  }

  // og:title / twitter:title (there are two of each — replace all)
  out = out.replace(
    /<meta\s+property="og:title"[^>]*>/gi,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:title"[^>]*>/gi,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
  );

  // og:description / twitter:description
  out = out.replace(
    /<meta\s+property="og:description"[^>]*>/gi,
    `<meta property="og:description" content="${escapeAttr(desc)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:description"[^>]*>/gi,
    `<meta name="twitter:description" content="${escapeAttr(desc)}" />`,
  );

  // og:image / twitter:image
  out = out.replace(
    /<meta\s+property="og:image"[^>]*>/gi,
    `<meta property="og:image" content="${escapeAttr(og)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:image"[^>]*>/gi,
    `<meta name="twitter:image" content="${escapeAttr(og)}" />`,
  );

  // og:url — replace if present, otherwise inject
  if (/<meta\s+property="og:url"[^>]*>/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:url"[^>]*>/gi,
      `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    );
  } else {
    out = out.replace('</head>', `  <meta property="og:url" content="${escapeAttr(canonical)}" />\n</head>`);
  }

  // canonical link
  if (/<link\s+rel="canonical"[^>]*>/i.test(out)) {
    out = out.replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    );
  } else {
    out = out.replace('</head>', `  <link rel="canonical" href="${escapeAttr(canonical)}" />\n</head>`);
  }

  // Strip the existing JSON-LD blocks from the shell so we can replace them
  // with the route-scoped set. This avoids duplicate Organization/WebSite.
  out = out.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');

  const ldBlocks = (route.jsonLd || [])
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n  ');

  if (ldBlocks) {
    out = out.replace('</head>', `  ${ldBlocks}\n</head>`);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Emit files
// ─────────────────────────────────────────────────────────────────────────

let count = 0;
for (const route of ROUTES) {
  const html = rewrite(SHELL, route);
  const outPath =
    route.path === '/'
      ? resolve(DIST, 'index.html')
      : resolve(DIST, route.path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  count += 1;
  console.log(`[prerender] ${route.path} -> ${outPath.replace(DIST, 'dist')}`);
}

console.log(`[prerender] wrote ${count} route shells.`);