'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  BookOpen, 
  Terminal, 
  Layers, 
  ShieldCheck, 
  Network, 
  Cpu, 
  MessageSquare, 
  Library,
  ChevronRight
} from 'lucide-react';

const navigation = [
  {
    title: 'INTRODUCTION',
    icon: BookOpen,
    items: [
      { title: 'What is Monipay?', href: '/introduction/what-is-monipay' },
      { title: 'Why Non-Custodial?', href: '/introduction/why-non-custodial' },
      { title: 'The Walkaway Test', href: '/introduction/the-walkaway-test' },
      { title: 'Core Concepts', href: '/introduction/core-concepts' },
    ],
  },
  {
    title: 'GETTING STARTED',
    icon: Terminal,
    items: [
      { title: 'Quick Start', href: '/getting-started/quick-start' },
      { title: 'Create Account', href: '/getting-started/create-account' },
      { title: 'Your First Payment', href: '/getting-started/your-first-payment' },
      { title: 'MoniTag Guide', href: '/getting-started/monetag-guide' },
    ],
  },
  {
    title: 'FEATURES',
    icon: Layers,
    items: [
      { title: 'Gasless Transactions', href: '/features/gasless-transactions' },
      { title: 'The Invisible Wallet', href: '/features/invisible-wallet' },
      { title: 'Merchant POS', href: '/features/merchant-pos' },
      { title: 'MoniBot Agent', href: '/features/monibot-agent' },
      { title: 'Payment Gateway', href: '/features/payment-gateway' },
      { title: 'Payment Links', href: '/features/payment-links' },
      { title: 'Invoices', href: '/features/invoices' },
      { title: 'Multi-Chain', href: '/features/multi-chain' },
    ],
  },
  {
    title: 'SECURITY',
    icon: ShieldCheck,
    items: [
      { title: 'Security Overview', href: '/security/overview' },
      { title: 'Key Encryption', href: '/security/key-encryption' },
      { title: 'Gatekeeper Pattern', href: '/security/gatekeeper-pattern' },
      { title: 'Rate Limiting', href: '/security/rate-limiting' },
    ],
  },
  {
    title: 'CHAINS',
    icon: Network,
    items: [
      { title: 'Base', href: '/chains/base' },
      { title: 'BNB Smart Chain', href: '/chains/bsc' },
      { title: 'Tempo', href: '/chains/tempo' },
      { title: 'Solana', href: '/chains/solana' },
    ],
  },
  {
    title: 'API REFERENCE',
    icon: Cpu,
    items: [
      { title: 'Authentication', href: '/api-reference/authentication' },
      { title: 'Payment Links', href: '/api-reference/payment-links' },
      { title: 'Orders', href: '/api-reference/orders' },
      { title: 'Webhooks', href: '/api-reference/webhooks' },
      { title: 'Error Codes', href: '/api-reference/error-codes' },
    ],
  },
  {
    title: 'MONIBOT',
    icon: MessageSquare,
    items: [
      { title: 'Overview', href: '/monibot/overview' },
      { title: 'Twitter Commands', href: '/monibot/twitter-commands' },
      { title: 'Campaign Grants', href: '/monibot/campaign-grants' },
      { title: 'Multi-Chain Execution', href: '/monibot/multi-chain' },
      { title: 'Admin Dashboard', href: '/monibot/admin-dashboard' },
    ],
  },
  {
    title: 'RESOURCES',
    icon: Library,
    items: [
      { title: 'Glossary', href: '/resources/glossary' },
      { title: 'FAQ', href: '/resources/faq' },
      { title: 'Changelog', href: '/resources/changelog' },
      { title: 'Community', href: '/resources/community' },
    ],
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn('bg-surface border-r border-border', className)}>
      <nav className="p-6 space-y-7">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="flex items-center gap-2 text-[10px] font-bold text-text-muted tracking-[0.1em] mb-3 uppercase">
              <section.icon className="w-3.5 h-3.5 opacity-70" />
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-md transition-all tracking-tight',
                      pathname === item.href
                        ? 'bg-brand/5 text-brand font-semibold'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                    )}
                  >
                    {item.title}
                    {pathname === item.href && <ChevronRight className="w-3 h-3" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
