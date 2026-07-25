import { Helmet } from 'react-helmet-async';
import { getBreadcrumbSchema } from '@/lib/schema';

// TODO(seo-i18n): When localized routes ship, generate alternates dynamically:
//   const LOCALES = ['es','fr','pt','ru','zh','ja','ar'] as const;
//   alternates = [
//     { hreflang: 'x-default', href: `https://monipay.xyz${path}` },
//     { hreflang: 'en',        href: `https://monipay.xyz${path}` },
//     ...LOCALES.map(l => ({ hreflang: l, href: `https://monipay.xyz/${l}${path}` })),
//   ];

interface Alternate {
  hreflang: string;
  href: string;
}

interface Breadcrumb {
  name: string;
  url: string;
}

interface PageMetaProps {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  path?: string;
  noIndex?: boolean;
  noIndexFollow?: boolean;
  jsonLd?: object | object[];
  themeColor?: string;
  breadcrumbs?: Breadcrumb[];
  alternates?: Alternate[];
  twitterCreator?: string;
  lang?: string;
}

const SITE_NAME = 'MoniPay';
const BASE_URL = 'https://monipay.xyz';
const DEFAULT_DESCRIPTION =
  'Gasless, non-custodial stablecoin payments across Base, BSC, Solana, Tempo, Ink and Celo. Send crypto by username with MoniTag™.';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
const DEFAULT_TITLE = `${SITE_NAME} - Gasless Multi-Chain Payments`;

export function PageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  path = '',
  noIndex = false,
  noIndexFollow = false,
  jsonLd,
  themeColor,
  breadcrumbs,
  alternates,
  twitterCreator,
  lang,
}: PageMetaProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = `${BASE_URL}${path}`;

  // Default hreflang annotations: x-default + en today. Localized routes via TODO above.
  const effectiveAlternates: Alternate[] =
    alternates ??
    (noIndex
      ? []
      : [
          { hreflang: 'x-default', href: canonicalUrl },
          { hreflang: 'en', href: canonicalUrl },
        ]);

  // Robots variant: explicit (noindex, follow) when caller opts in (e.g., admin pages).
  const robotsContent = noIndex ? (noIndexFollow ? 'noindex, follow' : 'noindex, nofollow') : null;

  // Normalize jsonLd to array. Append BreadcrumbList if breadcrumbs supplied.
  const ldArray: object[] = [];
  if (jsonLd) {
    if (Array.isArray(jsonLd)) ldArray.push(...jsonLd);
    else ldArray.push(jsonLd);
  }
  if (breadcrumbs && breadcrumbs.length > 0) {
    ldArray.push(getBreadcrumbSchema(breadcrumbs));
  }

  return (
    <Helmet>
      {lang && <html lang={lang} />}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@monipay_xyz" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}

      {themeColor && <meta name="theme-color" content={themeColor} />}

      {robotsContent && <meta name="robots" content={robotsContent} />}

      {effectiveAlternates.map((a) => (
        <link key={`alt-${a.hreflang}`} rel="alternate" hrefLang={a.hreflang} href={a.href} />
      ))}

      {ldArray.map((obj, i) => (
        <script key={`ld-${i}`} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
