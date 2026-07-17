import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { TopNav } from '@/components/layout/TopNav';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { SportsPromoToast } from '@/components/layout/SportsPromoToast';
import { FooterProvider } from '@/components/layout/FooterContext';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.monipay.xyz'),
  title: {
    default: 'Monipay Docs | Gasless Multi-Chain Stablecoin Payments',
    template: '%s | Monipay Docs',
  },
  description:
    'Official Monipay documentation. Learn how to send gasless stablecoin payments by username across Base, BSC, Solana, Tempo, Ink and Celo with MoniTag™.',
  applicationName: 'Monipay Docs',
  keywords: [
    'Monipay', 'MoniTag', 'MoniBot', 'gasless payments', 'stablecoin payments',
    'USDC payments', 'USDT payments', 'send crypto by username', 'Base payments',
    'BSC payments', 'Solana payments', 'Tempo payments', 'non-custodial wallet',
    'invisible wallet', 'crypto payment gateway', 'merchant crypto payments',
    'AlphaUSD', 'MiniPay Celo', 'gasless USDC', 'ERC-2771 meta transactions',
    'EIP-712 relayer', 'TIP-20', 'self-custody wallet', 'pay by tag',
  ],
  authors: [{ name: 'Monipay', url: 'https://monipay.xyz' }],
  creator: 'Monipay',
  publisher: 'Monipay',
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
    siteName: 'Monipay Docs',
    locale: 'en_US',
    url: 'https://docs.monipay.xyz',
    title: 'Monipay Docs | Gasless Multi-Chain Stablecoin Payments',
    description:
      'Send stablecoins by username across Base, BSC, Solana, Tempo, Ink and Celo. Zero gas. Non-custodial.',
    images: [{ url: '/og/default.png', width: 1200, height: 630, alt: 'Monipay Docs' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@monipay_xyz',
    creator: '@monipay_xyz',
    title: 'Monipay Docs',
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
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Monipay",
      "url": "https://monipay.xyz",
      "logo": "https://monipay.xyz/og/default.png",
      "sameAs": [
        "https://x.com/monipay_xyz"
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
      "name": "Monipay Docs",
      "url": "https://docs.monipay.xyz",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://docs.monipay.xyz/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ];

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="me" href="https://x.com/monipay_xyz" />
        <link rel="alternate" type="application/rss+xml" href="/changelog/rss.xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <FooterProvider>
            <div className="relative min-h-screen flex flex-col">
              <TopNav />
              <div className="flex-1 flex items-start pt-20">
                <SidebarNav className="hidden md:block w-[260px] border-r border-border sticky top-20 h-[calc(100vh-5rem)] max-h-full overflow-y-auto" />
                <main className="flex-1 min-w-0">
                  <div className="max-w-5xl mx-auto px-4 py-12 md:px-8">
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </div>
                </main>
              </div>
              <Footer />
              <SportsPromoToast />
            </div>
          </FooterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
