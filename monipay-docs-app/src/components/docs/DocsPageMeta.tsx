import Head from 'next/head';

interface DocsPageMetaProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  updated?: string;
  breadcrumbs?: { name: string; url: string }[];
  faq?: { q: string; a: string }[];
}

export function DocsPageMeta({
  title,
  description,
  canonical,
  ogImage = '/og/default.png',
  updated,
  breadcrumbs,
  faq,
}: DocsPageMetaProps) {
  const jsonLdScripts = [];

  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdScripts.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `https://docs.monipay.xyz${crumb.url}`,
      })),
    });
  }

  if (faq && faq.length > 0) {
    jsonLdScripts.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    });
  }

  return (
    <>
      <Head>
        <title>{title} | Monipay Docs</title>
        <meta name="description" content={description} />
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:title" content={`${title} | Monipay Docs`} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`https://docs.monipay.xyz${ogImage}`} />
        <meta name="twitter:title" content={`${title} | Monipay Docs`} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`https://docs.monipay.xyz${ogImage}`} />
      </Head>
      {jsonLdScripts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdScripts) }}
        />
      )}
    </>
  );
}
