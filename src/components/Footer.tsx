import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoniPayLogo } from './MoniPayLogo';
import { LanguageSelector } from './LanguageSelector';
import { XExhibitBadge } from './XExhibitBadge';

interface FooterProps {
  variant?: 'full' | 'minimal';
}

const LINKS = [
  { key: 'about', href: '/about' },
  { key: 'how_it_works', href: '/how-it-works' },
  { key: 'use_cases', href: '/use-cases' },
  { label: 'Deck', href: '/deck' },
  { label: 'MoniBot', href: '/monibot' },
  { key: 'privacy', href: '/privacy' },
  { key: 'terms', href: '/terms' },
];

const CHAIN_LINKS = [
  { label: 'Base', href: '/base' },
  { label: 'BSC', href: '/bsc' },
  { label: 'Solana', href: '/solana' },
  { label: 'Ink', href: '/ink' },
  { label: 'Tempo', href: '/tempo' },
  { label: 'Celo', href: '/minipay' },
];

const EXTERNAL_LINKS = [
  { label: 'Docs', href: 'https://docs.monipay.xyz', external: true },
  { label: 'Blog', href: 'https://blog.monipay.xyz', external: true },
  { label: 'Support', href: 'https://discord.gg/kSAwXzeRDB', external: true },
];

const SOCIAL = [
  { label: 'Twitter', href: 'https://x.com/monipay_xyz' },
  { label: 'Farcaster', href: 'https://farcaster.xyz/monibot' },
];

export function Footer({ variant = 'full' }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  if (variant === 'minimal') {
    return (
      <footer className="py-4 px-4 border-t border-foreground/5">
        <div className="max-w-md mx-auto flex flex-col items-center gap-2">
          <MoniPayLogo size={28} animationMode="idle" showText textSize={13} entranceOnView />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-foreground/30">
            {LINKS.slice(0, 5).map((link) => (
              <Link key={link.href} to={link.href} className="hover:text-foreground transition-colors">
                {link.key ? t(link.key) : link.label}
              </Link>
            ))}
          </div>
          <LanguageSelector variant="compact" />
          <span className="text-[10px] text-foreground/20">© {currentYear} MoniPay</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="px-6 lg:px-16 py-10 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex justify-center sm:justify-start">
          <XExhibitBadge variant="pill" />
        </div>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
          <div className="flex items-center gap-3">
            <MoniPayLogo size={28} animationMode="idle" showText textSize={13} entranceOnView />
            <LanguageSelector variant="compact" />
          </div>
          <div className="grid grid-cols-3 gap-x-12 gap-y-1 text-[11px]">
            <div>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/20 block mb-2">Product</span>
              {LINKS.map((link) => (
                <Link key={link.href} to={link.href} className="block py-0.5 text-foreground/30 hover:text-foreground transition-colors">
                  {link.key ? t(link.key) : link.label}
                </Link>
              ))}
            </div>
            <div>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/20 block mb-2">Chains</span>
              {CHAIN_LINKS.map((link) => (
                <Link key={link.href} to={link.href} className="block py-0.5 text-foreground/30 hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            <div>
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/20 block mb-2">Resources</span>
              {EXTERNAL_LINKS.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="block py-0.5 text-foreground/30 hover:text-foreground transition-colors">
                  {link.label}
                </a>
              ))}
              {SOCIAL.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="block py-0.5 text-foreground/30 hover:text-foreground transition-colors">
                  {link.label}
                </a>
              ))}
              <a href="/llm.txt" target="_blank" rel="noopener noreferrer" className="block py-0.5 text-foreground/30 hover:text-foreground transition-colors">Llm.txt</a>
            </div>
          </div>
        </div>
        <div className="border-t border-foreground/5 pt-4 flex items-center justify-between">
          <span className="text-[10px] text-foreground/20">© {currentYear} MoniPay</span>
          <div className="flex items-center gap-4 text-[10px] text-foreground/20">
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t('privacy')}</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">{t('terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
