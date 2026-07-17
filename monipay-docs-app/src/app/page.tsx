import Link from 'next/link';
import { ArrowRight, Zap, Shield, Globe, Bot, CreditCard, Link2, FileCode, Terminal } from 'lucide-react';
import * as motion from 'motion/react-client';
import { HeroSearch } from '@/components/search/HeroSearch';

const CHAINS = [
  { name: 'Celo', token: 'USDT', status: 'live', color: 'var(--color-celo)', bg: 'var(--color-celo-bg)', href: '/docs/chains/celo',
    icon: <img src="/chains/celo.svg" alt="Celo Logo" className="w-12 h-12 object-contain" /> },
  { name: 'Base', token: 'USDC', status: 'live', color: 'var(--color-base)', bg: 'var(--color-base-bg)', href: '/docs/chains/base',
    icon: <img src="/chains/base.svg" alt="Base Logo" className="w-12 h-12 object-contain" /> },
  { name: 'BNB Chain', token: 'USDT', status: 'live', color: 'var(--color-bsc)', bg: 'var(--color-bsc-bg)', href: '/docs/chains/bsc',
    icon: <img src="/chains/bnb.svg" alt="BNB Chain Logo" className="w-12 h-12 object-contain" /> },
  { name: 'Ink', token: 'USDT0', status: 'live', color: 'var(--color-ink)', bg: 'var(--color-ink-bg)', href: '/docs/chains/ink',
    icon: <img src="/chains/ink.svg" alt="Ink Logo" className="w-12 h-12 object-contain" /> },
  { name: 'Solana', token: 'USDC', status: 'live', color: '#9945FF', bg: 'rgba(153,69,255,0.08)', href: '/docs/chains/solana',
    icon: <img src="/chains/solana.svg" alt="Solana Logo" className="w-12 h-12 object-contain" /> },
  { name: 'Arc', token: 'USDC', status: 'soon', color: 'var(--color-arc)', bg: 'var(--color-arc-bg)', href: '/docs/chains/arc',
    icon: <img src="/chains/arc.svg" alt="Arc Logo" className="w-12 h-12 object-contain" /> },
];

const QUICK_LINKS = [
  { title: 'Quick Start', desc: 'Get your first payment in 5 minutes', href: '/docs/getting-started', icon: <Zap className="w-5 h-5 text-[var(--color-celo)]" /> },
  { title: 'MoniBot Agent', desc: 'Discord, Telegram & X bot commands', href: '/docs/monibot/overview', icon: <Bot className="w-5 h-5 text-[var(--color-ink)]" /> },
  { title: 'Smart Contracts', desc: 'Verified routers and IOU registry', href: '/docs/contracts/overview', icon: <FileCode className="w-5 h-5 text-[var(--color-base)]" /> },
  { title: 'API Reference', desc: 'Authentication, orders, webhooks', href: '/docs/merchant/payment-gateway', icon: <Terminal className="w-5 h-5 text-[var(--color-celo)]" /> },
];

const WHO_IS_IT_FOR = [
  {
    audience: 'Developers',
    desc: 'REST API, webhooks, embeddable checkout, and SDK. Integrate gasless stablecoin payments in any stack.',
    cta: 'Read API docs',
    href: '/docs/merchant/payment-gateway',
    color: 'var(--color-base)',
  },
  {
    audience: 'Non-devs & Merchants',
    desc: 'Payment links, QR codes, invoices, and storefronts. No code needed. Start accepting crypto in minutes.',
    cta: 'Get started',
    href: '/docs/getting-started',
    color: 'var(--color-celo)',
  },
  {
    audience: 'AI Agents & Bots',
    desc: 'MagicPay sends to social usernames. Scoped API keys. Natural language commands. MCP-ready.',
    cta: 'MoniBot docs',
    href: '/docs/monibot/overview',
    color: 'var(--color-ink)',
  },
];

const FEATURES = [
  { title: 'Gasless', desc: 'Zero gas for users. Relayer sponsors all fees.', href: '/docs/concepts/gasless-payments', icon: <Zap className="w-4 h-4" /> },
  { title: 'Non-Custodial', desc: 'Keys encrypted client-side. We never touch them.', href: '/docs/concepts/invisible-wallet', icon: <Shield className="w-4 h-4" /> },
  { title: 'Multi-Chain', desc: 'One API across 6 chains. Automatic routing.', href: '/docs/concepts/multi-chain-routing', icon: <Globe className="w-4 h-4" /> },
  { title: 'Agent Native', desc: 'Scoped keys and natural language for LLM agents.', href: '/docs/monibot/overview', icon: <Bot className="w-4 h-4" /> },
  { title: 'Pay by Username', desc: 'MoniTag resolves to wallets across all chains.', href: '/docs/concepts/monitag', icon: <CreditCard className="w-4 h-4" /> },
  { title: 'Payment Links', desc: 'One-click links. No wallet extension needed.', href: '/docs/payments/payment-links', icon: <Link2 className="w-4 h-4" /> },
];

export default function Page() {
  return (
    <div className="relative max-w-4xl mx-auto">

      {/* ── Hero ── */}
      <section className="pt-8 pb-14 border-b border-[var(--color-border)]">

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="text-[30px] sm:text-[40px] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] leading-[1.1] mb-4 text-center">
          Payments for Everyone.
          <br />
          <span style={{ color: 'var(--color-celo)' }}>Powered by stablecoins.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
          className="text-[14px] text-[var(--color-text-muted)] max-w-lg mx-auto text-center mb-8 leading-relaxed">
          Send stablecoins to anyone just by posting on X, Discord, Telegram, or Bluesky.
          No addresses. No gas. No friction. Just chat and pay.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.13 }}
          className="max-w-md mx-auto mb-8">
          <HeroSearch />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.17 }}
          className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/docs/getting-started"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all"
            style={{ background: 'var(--color-text-primary)', color: 'var(--color-bg)' }}>
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/docs/monibot/overview"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] font-bold hover:border-[var(--color-border-strong)] transition-all">
            MoniBot docs
          </Link>
          <Link href="/docs/what-is-monipay"
            className="text-[var(--color-text-muted)] text-[13px] font-semibold hover:text-[var(--color-text-primary)] transition-colors inline-flex items-center gap-1">
            Learn more <ArrowRight className="w-3 h-3" />
          </Link>
        </motion.div>
      </section>

      {/* ── Who is it for ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          Built for everyone
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {WHO_IS_IT_FOR.map(w => (
            <Link key={w.audience} href={w.href}
              className="group p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all">
              <div className="w-2 h-2 rounded-full mb-3" style={{ background: w.color }} />
              <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-2">{w.audience}</h3>
              <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed mb-3">{w.desc}</p>
              <span className="text-[11px] font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                style={{ color: w.color }}>
                {w.cta} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* ── Quick Links ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          Quick links
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(link => (
            <Link key={link.href} href={link.href}
              className="group flex items-center gap-4 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all">
              <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors shrink-0">
                {link.icon}
              </div>
              <div>
                <span className="text-[13px] font-bold text-[var(--color-text-primary)] block mb-0.5">{link.title}</span>
                <span className="text-[12px] text-[var(--color-text-muted)]">{link.desc}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </motion.section>

      {/* ── Supported Chains ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          Supported chains
        </p>
        <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
          {CHAINS.map(chain => (
            <Link key={chain.name} href={chain.href}
              className="flex flex-col items-center gap-2.5 p-3 sm:p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all group relative">
              {chain.status === 'soon' && (
                <span className="absolute top-1 right-1 sm:top-2 sm:right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: chain.bg, color: chain.color }}>
                  soon
                </span>
              )}
              {chain.icon}
              <div className="text-center w-full">
                <span className="text-[11px] font-bold text-[var(--color-text-primary)] block leading-tight break-words">{chain.name}</span>
                <span className="text-[10px] font-mono leading-tight block" style={{ color: chain.color }}>{chain.token}</span>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* ── Features ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          Core features
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(f => (
            <Link key={f.href} href={f.href}
              className="group p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors mb-4">
                {f.icon}
              </div>
              <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-1">{f.title}</h3>
              <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* ── MagicPay Demo ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          See it in action
        </p>
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-celo)', opacity: 0.7 }} />
            </div>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)] ml-3 opacity-50 uppercase tracking-widest">
              X · @alex
            </span>
          </div>
          <div className="p-5 bg-[var(--color-code-bg)] space-y-3">
            {/* User message */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] shrink-0 flex items-center justify-center text-[11px] font-bold text-[var(--color-text-muted)]">U</div>
              <div className="bg-[var(--color-surface-2)] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[78%] sm:max-w-xs">
                <p className="text-[13px] text-[var(--color-text-primary)]">
                  amazing thread, here is a tip 🙌 <span className="text-[var(--color-accent)]">@MoniPay</span> send $5 to <span className="text-[var(--color-accent)]">@alex</span>
                </p>
              </div>
            </div>
            {/* MoniBot response */}
            <div className="flex gap-3 justify-end">
              <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[78%] sm:max-w-xs" style={{ background: 'var(--color-celo)' }}>
                <p className="text-[10px] font-bold text-black/60 mb-1">✓ MONIBOT</p>
                <p className="text-[13px] font-medium text-black">
                  Done. $5 USDT sent to @alex. Gas sponsored. Receipt 🔗
                </p>
              </div>
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
                style={{ background: 'var(--color-celo)' }}>M</div>
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-3 text-center">
          No wallet required for the recipient · Funds held on-chain via{' '}
          <Link href="/docs/payments/iou" className="text-[var(--color-accent)]">MagicPay IOU Registry</Link>
        </p>
      </motion.section>

      {/* ── Code Example ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
        className="py-12 border-b border-[var(--color-border)]">
        <p className="text-[10px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[0.14em] mb-6">
          Quick integration
        </p>
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xl">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
            </div>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)] ml-3 opacity-60 uppercase tracking-widest">
              magic-send.ts
            </span>
          </div>
          <pre className="p-6 bg-[#0A0A0A] text-[13px] font-mono leading-relaxed overflow-x-auto text-[#E6E6E6]">
            <code>
              <span className="text-[#c084fc]">import</span>
              {' '}<span className="text-[#e2e8f0]">{'{ Monipay }'}</span>{' '}
              <span className="text-[#c084fc]">from</span>{' '}
              <span className="text-[#86efac]">&apos;@monipay/sdk&apos;</span>
              {'\n\n'}
              <span className="text-[#64748b]">// Send to a username — no wallet needed on recipient side</span>
              {'\n'}
              <span className="text-[#c084fc]">const</span>{' '}
              <span className="text-[#93c5fd]">result</span>{' = '}
              <span className="text-[#c084fc]">await</span>{' '}
              <span className="text-[#e2e8f0]">Monipay</span>
              {'.magicPay({'}
              {'\n  '}
              <span className="text-[#93c5fd]">to</span>{': '}
              <span className="text-[#86efac]">&apos;@alice&apos;</span>{','}
              {'\n  '}
              <span className="text-[#93c5fd]">amount</span>{': '}
              <span className="text-[#fbbf24]">5.00</span>{','}
              {'\n  '}
              <span className="text-[#93c5fd]">token</span>{': '}
              <span className="text-[#86efac]">&apos;USDT&apos;</span>{','}
              {'\n  '}
              <span className="text-[#93c5fd]">chain</span>{': '}
              <span className="text-[#86efac]">&apos;celo&apos;</span>{','}
              {'\n  '}
              <span className="text-[#93c5fd]">platform</span>{': '}
              <span className="text-[#86efac]">&apos;twitter&apos;</span>
              {'\n})\n\n'}
              <span className="text-[#64748b]">{'// → Escrowed on-chain. Alice claims when ready.'}</span>
            </code>
          </pre>
        </div>
      </motion.section>

      {/* ── Footer CTA ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        className="py-16">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div>
            <h3 className="text-[18px] font-extrabold text-[var(--color-text-primary)] mb-2">
              Ready to integrate?
            </h3>
            <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
              Start accepting gasless stablecoin payments in minutes. Free to get started.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap justify-center gap-3 shrink-0">
            <Link href="/docs/getting-started"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all"
              style={{ background: 'var(--color-celo)', color: '#000' }}>
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://monipay.xyz" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] font-bold hover:border-[var(--color-border-strong)] transition-all">
              Launch app ↗
            </a>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
