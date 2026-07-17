import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  slug: string;
  items: NavItem[];
}

const TAXONOMY = [
  {
    slug: 'introduction',
    title: 'Introduction',
    items: [
      { slug: 'what-is-monipay', title: 'What is Monipay' },
      { slug: 'how-it-works', title: 'How It Works' }
    ]
  },
  {
    slug: 'concepts',
    title: 'Core Concepts',
    items: [
      { slug: 'concepts/invisible-wallet', title: 'The Invisible Wallet' },
      { slug: 'concepts/monitag', title: 'MoniTag Identity' },
      { slug: 'concepts/resolution', title: 'Username Resolution' },
      { slug: 'concepts/gasless-payments', title: 'Gasless Payments' },
      { slug: 'concepts/multi-chain-routing', title: 'Multi-Chain Routing' },
      { slug: 'concepts/walkaway-test', title: 'Walkaway Test' },
      { slug: 'glossary', title: 'Glossary' }
    ]
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    items: [
      { slug: 'getting-started', title: 'Quick Start' },
      { slug: 'getting-started/create-monitag', title: 'Create your MoniTag' },
      { slug: 'getting-started/fund-wallet', title: 'Fund your Wallet' },
      { slug: 'getting-started/send-payment', title: 'Send your First Payment' }
    ]
  },
  {
    slug: 'payments',
    title: 'Payments',
    items: [
      { slug: 'payments/p2p', title: 'P2P Payments' },
      { slug: 'payments/payment-links', title: 'Payment Links' },
      { slug: 'payments/qr-codes', title: 'QR Codes' },
      { slug: 'payments/iou', title: 'IOU Registry' }
    ]
  },
  {
    slug: 'merchant',
    title: 'Merchant',
    items: [
      { slug: 'merchant/overview', title: 'Merchant Overview' },
      { slug: 'merchant/storefront', title: 'Storefront' },
      { slug: 'merchant/payment-gateway', title: 'Payment Gateway' },
      { slug: 'merchant/webhooks', title: 'Webhooks' }
    ]
  },
  {
    slug: 'mobile',
    title: 'Mobile & PWA',
    items: [
      { slug: 'mobile/overview', title: 'Mobile Overview' },
      { slug: 'mobile/deep-links', title: 'Deep Links' }
    ]
  },
  {
    slug: 'monibot',
    title: 'MoniBot Agent',
    items: [
      { slug: 'monibot/overview', title: 'MoniBot Overview' },
      { slug: 'monibot/commands', title: 'Commands Reference' },
      { slug: 'monibot/sports-oracle', title: 'World Cup Sports Oracle' },
      { slug: 'monibot/multi-recipient', title: 'Multi-Recipient' },
      { slug: 'monibot/discord', title: 'Discord' },
      { slug: 'monibot/telegram', title: 'Telegram' },
      { slug: 'monibot/twitter', title: 'Twitter / X' }
    ]
  },
  {
    slug: 'chains',
    title: 'Supported Chains',
    items: [
      { slug: 'chains/base', title: 'Base' },
      { slug: 'chains/bsc', title: 'BSC' },
      { slug: 'chains/solana', title: 'Solana' },
      { slug: 'chains/tempo', title: 'Tempo' },
      { slug: 'chains/celo', title: 'Celo (MiniPay)' },
      { slug: 'chains/ink', title: 'Ink' },
      { slug: 'chains/arc', title: 'Arc' }
    ]
  },
  {
    slug: 'contracts',
    title: 'Smart Contracts',
    items: [
      { slug: 'contracts/overview', title: 'Contracts Overview' },
      { slug: 'contracts/base', title: 'Base Contracts' },
      { slug: 'contracts/bsc', title: 'BSC Contracts' },
      { slug: 'contracts/celo', title: 'Celo Contracts' },
      { slug: 'contracts/tempo', title: 'Tempo Contracts' }
    ]
  },
  {
    slug: 'security',
    title: 'Security',
    items: [
      { slug: 'security/architecture', title: 'Security Architecture' },
      { slug: 'security/solana-key-storage', title: 'Solana Key Storage' },
      { slug: 'concepts/reserved-usernames', title: 'Reserved Usernames' }
    ]
  },
  {
    slug: 'resources',
    title: 'Resources',
    items: [
      { slug: 'changelog', title: 'Changelog' },
      { slug: 'faq', title: 'FAQ' },
      { slug: 'support', title: 'Support' }
    ]
  }
];

export function getNavigation(): NavSection[] {
  return TAXONOMY.map(section => ({
    title: section.title,
    slug: section.slug,
    items: section.items.map(item => ({
      title: item.title,
      href: `/docs/${item.slug}`
    }))
  }));
}
