// Pure JSON-LD builders. No imports from React or app state.
// Used by PageMeta to emit per-page structured data.

const SITE = 'https://monipay.xyz';
const NAME = 'MoniPay';

export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: NAME,
  url: SITE,
  logo: `${SITE}/og/default.png`,
  sameAs: ['https://twitter.com/monipay_xyz', 'https://x.com/monipay_xyz'],
});

export const getWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: NAME,
  url: SITE,
});

export type ChainKey = 'base' | 'bsc' | 'solana' | 'tempo' | 'ink' | 'celo' | 'multi';

const CHAIN_META: Record<ChainKey, { label: string; token: string; path: string }> = {
  base:   { label: 'Base',        token: 'USDC',         path: '/base' },
  bsc:    { label: 'BSC',         token: 'USDT',         path: '/bsc' },
  solana: { label: 'Solana',      token: 'USDC',         path: '/solana' },
  tempo:  { label: 'Tempo',       token: 'AlphaUSD',     path: '/tempo' },
  ink:    { label: 'Ink',         token: 'USDT0',        path: '/ink' },
  celo:   { label: 'Celo',        token: 'USDm',         path: '/minipay' },
  multi:  { label: 'Multi-chain', token: 'Stablecoins',  path: '/' },
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
      ? 'Gasless non-custodial stablecoin payments across multiple chains.'
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

export const getItemListSchema = (name: string, items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    url: it.url,
  })),
});

export const SITE_URL = SITE;