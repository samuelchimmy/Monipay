import { getDocBySlug, getAllDocs } from '@/lib/mdx';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MDXComponents } from '@/components/docs/MDXComponents';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { FooterUpdater } from '@/components/layout/FooterUpdater';
import { AISummary } from '@/components/ai/AISummary';
import { FAQAccordion } from '@/components/docs/FAQAccordion';
import { RelatedPages } from '@/components/docs/RelatedPages';
import { getNavigation } from '@/lib/navigation';
import * as motion from 'motion/react-client';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function generateStaticParams() {
  const docs = await getAllDocs();
  return docs.map((doc) => ({
    slug: doc.slug.split('/'),
  }));
}

interface PageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) return {};

  const ogUrl = new URL(`${process.env.APP_URL || 'https://docs.monipay.xyz'}/api/og`);
  ogUrl.searchParams.set('title', doc.meta.title);
  ogUrl.searchParams.set('description', doc.meta.description);

  return {
    title: doc.meta.title,
    description: doc.meta.description,
    keywords: doc.meta.keywords,
    openGraph: {
      title: doc.meta.title,
      description: doc.meta.description,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: doc.meta.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: doc.meta.title,
      description: doc.meta.description,
      images: [ogUrl.toString()],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const breadcrumbsList = slug.map((segment, index) => {
    const url = '/' + slug.slice(0, index + 1).join('/');
    // format segment for display (capitalize, replace dashes)
    const name = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return {
      '@type': 'ListItem',
      position: index + 2, // 1 is Home
      name,
      item: `https://docs.monipay.xyz${url}`,
    };
  });

  const jsonLdScripts: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://docs.monipay.xyz/',
        },
        ...breadcrumbsList,
      ],
    },
  ];

  // Auto-detect FAQ from MDX content if not in frontmatter
  let faqItems = doc.meta.faq || [];
  if (faqItems.length === 0) {
    const faqMatch = doc.content.match(/## (FAQ|Frequently Asked Questions)\n([\s\S]*?)(?=\n## |$)/);
    if (faqMatch) {
      const faqBody = faqMatch[2];
      const questions = faqBody.matchAll(/### (.*?)\n([\s\S]*?)(?=\n### |$)/g);
      for (const match of questions) {
        faqItems.push({ q: match[1].trim(), a: match[2].trim() });
      }
    }
  }

  if (faqItems.length > 0) {
    jsonLdScripts.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item: any) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    });
  }

  // TechArticle Schema
  jsonLdScripts.push({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": doc.meta.title,
    "description": doc.meta.description,
    "datePublished": doc.meta.updated || new Date().toISOString(),
    "dateModified": doc.meta.updated || new Date().toISOString(),
    "author": { "@type": "Organization", "name": "Monipay", "url": "https://monipay.xyz" },
    "publisher": {
      "@type": "Organization",
      "name": "Monipay",
      "url": "https://monipay.xyz",
      "logo": { "@type": "ImageObject", "url": "https://monipay.xyz/logo.svg" }
    },
    "mainEntityOfPage": `https://docs.monipay.xyz/docs/${doc.slug}`,
    "articleSection": doc.meta.section || slug[0],
    "keywords": (doc.meta.keywords || []).join(', '),
    "inLanguage": "en"
  });

  // SoftwareApplication Schema for API Reference
  if (doc.slug.startsWith('api-reference/')) {
    jsonLdScripts.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Monipay API",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "url": "https://monipay.xyz",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    });
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdScripts) }}
      />
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative flex flex-col lg:flex-row gap-12"
      >
      <div className="flex-1 min-w-0">
        <Breadcrumb slug={slug} />
        <article className="max-w-none text-text-primary">
          <header className="mb-8 border-b border-border pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
              {doc.meta.title}
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              {doc.meta.description}
            </p>
          </header>
          
          <div className="mdx-content">
            <MDXRemote 
              source={doc.content} 
              components={MDXComponents} 
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
          
          {doc.meta.faq && doc.meta.faq.length > 0 && (
            <FAQAccordion items={doc.meta.faq} />
          )}

          {/* Related Pages - Backlinking */}
          {(() => {
            const nav = getNavigation();
            const currentSection = slug[0];
            const currentHref = '/' + slug.join('/');
            const section = nav.find((s) => s.slug === currentSection);
            const siblingPages = section
              ? section.items
                  .filter((item) => item.href !== currentHref)
                  .slice(0, 4)
                  .map((item) => ({ title: item.title, href: item.href }))
              : [];
            // Also add one page from the next section for cross-linking
            const sectionIdx = nav.findIndex((s) => s.slug === currentSection);
            const nextSection = nav[sectionIdx + 1];
            const crossLinks = nextSection
              ? [{ title: `${nextSection.title}: ${nextSection.items[0]?.title}`, href: nextSection.items[0]?.href }]
              : [];
            const relatedPages = [...siblingPages, ...crossLinks].filter((p) => p.href);
            return <RelatedPages pages={relatedPages} />;
          })()}
        </article>
        
        <FooterUpdater updated={doc.meta.updated} />
      </div>

      <aside className="hidden xl:block w-64 shrink-0">
        <div className="sticky top-24 space-y-8">
          <AISummary title={doc.meta.title} content={doc.content} />
          <TableOfContents />
        </div>
      </aside>
    </motion.div>
    </>
  );
}
