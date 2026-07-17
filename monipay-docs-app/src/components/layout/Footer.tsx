'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFooter } from './FooterContext';
import { MonipayLogo } from '@/components/ui/MonipayLogo';

interface FooterProps {
  updated?: string;
}

export function Footer({ updated: propUpdated }: FooterProps = {}) {
  const pathname = usePathname();
  const { updated: contextUpdated } = useFooter();
  const updated = propUpdated || contextUpdated;

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="mt-12 border-t border-border pt-8 pb-4">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <MonipayLogo size={20} color="#0052FF" />
            <span className="text-[18px] font-bold tracking-tight">
              Monipay
            </span>
          </div>

          <p className="text-sm text-text-muted max-w-lg leading-relaxed">
            Smart stablecoin payments powered by AI. Non-custodial,
            gasless, and multi-chain.
          </p>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center mb-6">
          {/* Product */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-text-muted font-semibold mb-2">
              Product
            </h4>

            <div className="space-y-1 text-[12px] sm:text-sm">
              <Link
                href="/docs/what-is-monipay"
                className="block text-text-muted hover:text-text-primary"
              >
                About
              </Link>

              <Link
                href="/docs/how-it-works"
                className="block text-text-muted hover:text-text-primary"
              >
                How It Works
              </Link>

              <Link
                href="/docs/monibot"
                className="block text-text-muted hover:text-text-primary"
              >
                MoniBot
              </Link>
            </div>
          </div>

          {/* Chains */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-text-muted font-semibold mb-2">
              Chains
            </h4>

            <div className="space-y-1 text-[12px] sm:text-sm">
              <Link
                href="/docs/chains/base"
                className="block text-text-muted hover:text-text-primary"
              >
                Base
              </Link>

              <Link
                href="/docs/chains/bsc"
                className="block text-text-muted hover:text-text-primary"
              >
                BSC
              </Link>

              <Link
                href="/docs/chains/solana"
                className="block text-text-muted hover:text-text-primary"
              >
                Solana
              </Link>

              <Link
                href="/docs/chains/tempo"
                className="block text-text-muted hover:text-text-primary"
              >
                Tempo
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-text-muted font-semibold mb-2">
              Resources
            </h4>

            <div className="space-y-1 text-[12px] sm:text-sm">
              <Link
                href="/docs/getting-started"
                className="block text-text-muted hover:text-text-primary"
              >
                Docs
              </Link>

              <Link
                href="/docs/changelog"
                className="block text-text-muted hover:text-text-primary"
              >
                Changelog
              </Link>

              <a
                href="https://x.com/monipay_xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-text-muted hover:text-text-primary"
              >
                Twitter
              </a>

              <a
                href="https://discord.gg/monipay"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-text-muted hover:text-text-primary"
              >
                Discord
              </a>

              <a
                href="https://github.com/monipay"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-text-muted hover:text-text-primary"
              >
                GitHub
              </a>

              <a
                href="/llms.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-text-muted hover:text-text-primary"
              >
                LLMs.txt
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-4 flex flex-col items-center gap-2 text-xs text-text-muted">
          <div className="flex items-center gap-5">
            <a
              href="https://monipay.xyz/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary"
            >
              Privacy
            </a>

            <a
              href="https://monipay.xyz/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary"
            >
              Terms
            </a>
          </div>

          <p className="mb-0 text-center break-words w-full">
            © {new Date().getFullYear()} Monipay. All rights reserved.
            {updated && ` · Last updated: ${updated}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
