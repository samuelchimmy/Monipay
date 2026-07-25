import { useState, useEffect, useCallback } from 'react';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { PageMeta } from '@/components/PageMeta';
import { useTheme } from 'next-themes';
import {
  ChevronLeft, ChevronRight, X, Check, Zap, Bot, Users, Store,
  Globe, CreditCard, Layers, FileText, GitBranch, ArrowRight,
  ExternalLink, Smartphone, Shield, Clock, BarChart3, Code,
  Target, Rocket, MessageSquare, Twitter, Cpu, Eye, Send,
  TrendingUp, Award, Terminal, Workflow, Link2, Lock, Coins
} from 'lucide-react';

/* ─── Chain color themes ─── */
type ChainTheme = 'neutral' | 'base' | 'bsc' | 'tempo';

const CHAIN_COLORS: Record<ChainTheme, { bg: string; fg: string; accent: string; accentFg: string; border: string; muted: string }> = {
  neutral: {
    bg: 'bg-white', fg: 'text-gray-950', accent: 'bg-gray-950', accentFg: 'text-white',
    border: 'border-gray-950/10', muted: 'text-gray-950/40',
  },
  base: {
    bg: 'bg-[#0052FF]', fg: 'text-white', accent: 'bg-white', accentFg: 'text-[#0052FF]',
    border: 'border-white/20', muted: 'text-white/50',
  },
  bsc: {
    bg: 'bg-[#F0B90B]', fg: 'text-gray-950', accent: 'bg-gray-950', accentFg: 'text-[#F0B90B]',
    border: 'border-gray-950/15', muted: 'text-gray-950/50',
  },
  tempo: {
    bg: 'bg-gray-950', fg: 'text-white', accent: 'bg-white', accentFg: 'text-gray-950',
    border: 'border-white/10', muted: 'text-white/40',
  },
};

/* ─── Grid Background ─── */
function GridBg({ theme = 'neutral' }: { theme?: ChainTheme }) {
  const lineColor = theme === 'neutral' || theme === 'bsc' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
  const cornerColor = theme === 'neutral' || theme === 'bsc' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      {[['top-0 left-0', 'h-32 w-px', 'w-32 h-px'], ['top-0 right-0', 'h-32 w-px', 'w-32 h-px'], ['bottom-0 left-0', 'h-32 w-px', 'w-32 h-px'], ['bottom-0 right-0', 'h-32 w-px', 'w-32 h-px']].map(([pos, v, h], i) => (
        <div key={i}>
          <div className={`absolute ${pos} ${v}`} style={{ backgroundColor: cornerColor }} />
          <div className={`absolute ${pos} ${h}`} style={{ backgroundColor: cornerColor }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Slide wrapper with chain theming ─── */
function Slide({ children, theme = 'neutral', inverted = false }: { children: React.ReactNode; theme?: ChainTheme; inverted?: boolean }) {
  const resolvedTheme = inverted && theme === 'neutral' ? 'tempo' : theme;
  const colors = CHAIN_COLORS[resolvedTheme];
  const isLight = resolvedTheme === 'neutral' || resolvedTheme === 'bsc';

  return (
    <div className={`w-full h-full flex flex-col justify-center px-8 sm:px-16 lg:px-24 relative ${colors.bg} ${colors.fg}`}>
      <GridBg theme={resolvedTheme} />
      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 block mb-3">{children}</span>;
}

function H1({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05] ${className}`}>{children}</h1>;
}

function H2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.1] ${className}`}>{children}</h2>;
}

function BulletX({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <X className="w-4 h-4 mt-0.5 opacity-40 shrink-0" />
      <span className="text-sm opacity-60">{children}</span>
    </div>
  );
}

function BulletCheck({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} />
      <span className="text-sm">{children}</span>
    </div>
  );
}

/* ─── Chain Badge ─── */
function ChainBadge({ chain, size = 'sm' }: { chain: 'base' | 'bsc' | 'tempo'; size?: 'sm' | 'lg' }) {
  const styles = {
    base: 'bg-[#0052FF] text-white',
    bsc: 'bg-[#F0B90B] text-gray-950',
    tempo: 'bg-gray-950 text-white',
  };
  const labels = { base: 'BASE', bsc: 'BSC', tempo: 'TEMPO' };
  const px = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return <span className={`${styles[chain]} ${px} font-bold tracking-widest`}>{labels[chain]}</span>;
}

/* ─── All Slides ─── */
function slides() {
  return [
    // ═══════════════════════════════════════════
    // SLIDE 1: Title — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <div className="flex items-center gap-2 mb-8">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">
            Live on 3 Chains · 2026
          </span>
        </div>
        <MoniPayLogo size={52} color="#0052FF" showText textSize={44} animationMode="idle" entranceOnMount />
        <p className="opacity-30 text-lg sm:text-xl font-medium mt-4 max-w-lg">
          The Intelligent Social Financial Layer for Agentic Commerce
        </p>
        <div className="mt-8 flex items-center gap-3">
          <ChainBadge chain="base" />
          <ChainBadge chain="bsc" />
          <ChainBadge chain="tempo" />
        </div>
        <div className="mt-10 flex items-center gap-6">
          <span className="text-xs font-bold opacity-30">@monibot</span>
          <span className="w-px h-3 opacity-15 bg-current" />
          <span className="text-xs font-bold opacity-30">monipay.xyz</span>
          <span className="w-px h-3 opacity-15 bg-current" />
          <span className="text-xs font-bold opacity-30">Built by @wallstreetjade</span>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 2: The Problem — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>The Problem</Label>
        <H2 className="mb-8">Why Crypto Payments Failed</H2>
        <div className="space-y-3 max-w-md">
          <BulletX>99% abandonment rate</BulletX>
          <BulletX>Wallet extensions & seed phrases</BulletX>
          <BulletX>Hexadecimal addresses (0x1a2b3c...)</BulletX>
          <BulletX>Gas fees in obscure tokens</BulletX>
          <BulletX>Requires blockchain literacy</BulletX>
        </div>
        <p className="mt-10 text-sm font-bold opacity-60 max-w-sm">
          Stablecoins should be the future of payments.<br />
          <span className="opacity-40">But the UX is stuck in 2015.</span>
        </p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 3: The Solution — Inverted
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <Label>The Solution</Label>
        <H2 className="mb-8">Just Tweet. Money Moves.</H2>
        <div className="border border-white/10 p-6 sm:p-8 max-w-lg mb-8">
          <p className="text-lg sm:text-xl font-bold font-mono">
            "@monibot send $5 to @alice"
          </p>
        </div>
        <p className="text-xl font-extrabold mb-6 opacity-80">That's it.</p>
        <div className="space-y-2 opacity-60">
          <p className="text-sm">No wallet opened</p>
          <p className="text-sm">No gas paid</p>
          <p className="text-sm">No blockchain seen</p>
        </div>
        <p className="mt-8 text-sm font-bold opacity-40">
          30 seconds later: Money transferred on-chain. On any chain.
        </p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 4: Meet MoniBot — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Meet MoniBot</Label>
        <H2 className="mb-2">An Autonomous Financial Agent</H2>
        <p className="text-sm opacity-40 mb-10">Not a chatbot. A VP of Growth.</p>
        <div className="grid sm:grid-cols-2 gap-px bg-gray-950/10 border border-gray-950/10 max-w-2xl">
          {[
            { icon: Send, text: 'Processes P2P payments via Twitter' },
            { icon: Target, text: 'Runs marketing campaigns 24/7' },
            { icon: Cpu, text: 'Makes strategic decisions autonomously' },
            { icon: Users, text: 'Acquires users while you sleep' },
          ].map((item) => (
            <div key={item.text} className="bg-white p-5 flex items-start gap-3">
              <item.icon className="w-4 h-4 opacity-20 mt-0.5 shrink-0" />
              <span className="text-xs opacity-60">{item.text}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm font-bold opacity-30">
          AI that doesn't assist your business — it runs it.
        </p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 5: Three Agents — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Architecture</Label>
        <H2 className="mb-10">Three AI Agents. Zero Humans.</H2>
        <div className="grid sm:grid-cols-3 gap-px bg-gray-950/10 border border-gray-950/10">
          {[
            { title: 'WORKER BOT', role: 'Executor', desc: 'Polls Twitter → Parses with AI → Executes on-chain', icon: Terminal },
            { title: 'REPLY BOT', role: 'Social Voice', desc: 'Monitors logs → Generates replies → Posts confirmations', icon: MessageSquare },
            { title: 'ADMIN AI', role: 'Strategy', desc: 'Schedules campaigns → Monitors budgets → Routes chains', icon: Eye },
          ].map((agent) => (
            <div key={agent.title} className="bg-white p-6 flex flex-col justify-between min-h-[180px]">
              <div>
                <agent.icon className="w-5 h-5 opacity-15 mb-4" />
                <h3 className="text-xs font-bold tracking-widest uppercase opacity-40">{agent.title}</h3>
                <p className="text-[10px] opacity-25 mb-3">{agent.role}</p>
              </div>
              <p className="text-xs opacity-50 leading-relaxed">{agent.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs opacity-30">One bot per chain. Every payment. Fully autonomous.</p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 6: The Invisible Wallet — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Core Tech</Label>
        <H2 className="mb-2">The Invisible Wallet</H2>
        <p className="text-sm opacity-40 mb-10">Non-custodial. No seed phrases. No extensions.</p>
        <div className="grid sm:grid-cols-2 gap-px bg-gray-950/10 border border-gray-950/10 max-w-2xl">
          {[
            { icon: Lock, title: 'Local Key Generation', desc: 'Private key generated in-browser, encrypted with your PIN (AES-256-GCM)' },
            { icon: Shield, title: 'Zero Custody', desc: 'Keys never leave your device. Not even MoniPay can access them.' },
            { icon: Smartphone, title: 'MoniTag Identity', desc: 'Human-readable @tags instead of 0x addresses. Like Venmo, but on-chain.' },
            { icon: Zap, title: 'Gasless Execution', desc: 'Meta-transactions on Base/BSC. Fee sponsorship on Tempo. You pay $0 gas.' },
          ].map((item) => (
            <div key={item.title} className="bg-white p-5 flex flex-col gap-2">
              <item.icon className="w-5 h-5 opacity-15" />
              <h3 className="text-xs font-bold">{item.title}</h3>
              <p className="text-[11px] opacity-40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm font-bold opacity-30">
          Passes the Walkaway Test: your funds survive even if our servers disappear.
        </p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 7: BASE — Blue/White
    // ═══════════════════════════════════════════
    () => (
      <Slide theme="base">
        <Label>Chain 1</Label>
        <H2 className="mb-2">Base · USDC</H2>
        <p className="text-sm opacity-50 mb-10">Our genesis chain. Mainnet live since Q1 2026.</p>
        <div className="grid sm:grid-cols-3 gap-px bg-white/10 border border-white/10 max-w-3xl">
          <div className="bg-[#0052FF] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Transactions</span>
            <div>
              <span className="text-2xl font-extrabold">80+</span>
              <p className="text-[10px] opacity-40 mt-1">Autonomous</p>
            </div>
          </div>
          <div className="bg-[#0052FF] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Distributed</span>
            <div>
              <span className="text-2xl font-extrabold">$35+</span>
              <p className="text-[10px] opacity-40 mt-1">USDC · 6 decimals</p>
            </div>
          </div>
          <div className="bg-[#0052FF] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Method</span>
            <div>
              <span className="text-lg font-extrabold">EIP-712</span>
              <p className="text-[10px] opacity-40 mt-1">Meta-transactions</p>
            </div>
          </div>
        </div>
        <div className="mt-8 space-y-2 max-w-md opacity-80">
          <BulletCheck>MoniPayRouter: 0x4048...D2c0</BulletCheck>
          <BulletCheck>MoniBotRouter: 0xBEE3...A516</BulletCheck>
          <BulletCheck>Gas relayer pays ETH fees for users</BulletCheck>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 8: BSC — Yellow/Black
    // ═══════════════════════════════════════════
    () => (
      <Slide theme="bsc">
        <Label>Chain 2</Label>
        <H2 className="mb-2">BSC · USDT</H2>
        <p className="text-sm opacity-50 mb-10">Emerging market expansion. Lower fees, higher reach.</p>
        <div className="grid sm:grid-cols-3 gap-px bg-gray-950/10 border border-gray-950/10 max-w-3xl">
          <div className="bg-[#F0B90B] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Transactions</span>
            <div>
              <span className="text-2xl font-extrabold">25+</span>
              <p className="text-[10px] opacity-40 mt-1">Autonomous</p>
            </div>
          </div>
          <div className="bg-[#F0B90B] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Distributed</span>
            <div>
              <span className="text-2xl font-extrabold">$15+</span>
              <p className="text-[10px] opacity-40 mt-1">USDT · 18 decimals</p>
            </div>
          </div>
          <div className="bg-[#F0B90B] p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Method</span>
            <div>
              <span className="text-lg font-extrabold">EIP-712</span>
              <p className="text-[10px] opacity-40 mt-1">Meta-transactions</p>
            </div>
          </div>
        </div>
        <div className="mt-8 space-y-2 max-w-md">
          <BulletCheck>MoniPayRouter: 0x5572...bcb5</BulletCheck>
          <BulletCheck>MoniBotRouter: 0x9EED...832E</BulletCheck>
          <BulletCheck>Gas relayer pays BNB fees for users</BulletCheck>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 9: TEMPO — Black/White
    // ═══════════════════════════════════════════
    () => (
      <Slide theme="tempo">
        <Label>Chain 3</Label>
        <H2 className="mb-2">Tempo · aUSD</H2>
        <p className="text-sm opacity-50 mb-10">A blockchain built for payments. Our best implementation.</p>
        <div className="grid sm:grid-cols-3 gap-px bg-white/10 border border-white/10 max-w-3xl">
          <div className="bg-gray-950 p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Innovation</span>
            <div>
              <span className="text-lg font-extrabold">Native</span>
              <p className="text-[10px] opacity-40 mt-1">Fee sponsorship</p>
            </div>
          </div>
          <div className="bg-gray-950 p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">User Fees</span>
            <div>
              <span className="text-2xl font-extrabold">$0</span>
              <p className="text-[10px] opacity-40 mt-1">True zero-cost</p>
            </div>
          </div>
          <div className="bg-gray-950 p-6 flex flex-col justify-between min-h-[120px]">
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Features</span>
            <div>
              <span className="text-lg font-extrabold">TIP-20</span>
              <p className="text-[10px] opacity-40 mt-1">Payment-native</p>
            </div>
          </div>
        </div>
        <div className="mt-8 space-y-2 max-w-md opacity-80">
          <BulletCheck>MoniPayRouter: 0xa39C...BDb9</BulletCheck>
          <BulletCheck>MoniBotRouter: 0x78A8...49fc</BulletCheck>
          <BulletCheck>2D nonces · Batch calls · Transfer memos</BulletCheck>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 10: Chain Comparison — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Multi-Chain</Label>
        <H2 className="mb-10">Three Chains. One Experience.</H2>
        <div className="border border-gray-950/10 max-w-3xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-4 gap-px bg-gray-200">
            <div className="bg-white p-3" />
            <div className="bg-[#0052FF] p-3 flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-widest text-white">BASE</span>
            </div>
            <div className="bg-[#F0B90B] p-3 flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-widest text-gray-950">BSC</span>
            </div>
            <div className="bg-gray-950 p-3 flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-widest text-white">TEMPO</span>
            </div>
          </div>
          {/* Rows */}
          {[
            { label: 'Token', base: 'USDC', bsc: 'USDT', tempo: 'aUSD' },
            { label: 'Gas Model', base: 'Relayer pays ETH', bsc: 'Relayer pays BNB', tempo: 'Native sponsorship' },
            { label: 'Signature', base: 'EIP-712', bsc: 'EIP-712', tempo: 'Direct / Sponsored' },
            { label: 'Decimals', base: '6', bsc: '18', tempo: '6' },
            { label: 'Nonces', base: 'Sequential', bsc: 'Sequential', tempo: '2D Concurrent' },
            { label: 'User Cost', base: '$0 gas', bsc: '$0 gas', tempo: '$0 everything' },
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-4 gap-px bg-gray-200">
              <div className="bg-white p-3">
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">{row.label}</span>
              </div>
              <div className="bg-blue-50 p-3"><span className="text-xs">{row.base}</span></div>
              <div className="bg-yellow-50 p-3"><span className="text-xs">{row.bsc}</span></div>
              <div className="bg-gray-100 p-3"><span className="text-xs font-bold">{row.tempo}</span></div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs opacity-30">Same @MoniTag. Same PIN. Funds are chain-specific.</p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 11: Live Proof — Inverted
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <Label>Live Proof</Label>
        <H2 className="mb-2">Not a Demo. Production System.</H2>
        <p className="text-sm opacity-40 mb-10">Real transactions. Real users. Real money.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/10 border border-white/10 max-w-2xl">
          {[
            { v: '100+', l: 'Transactions', s: 'Across 3 chains' },
            { v: '$50+', l: 'Distributed', s: 'Autonomously' },
            { v: '3', l: 'Chains', s: 'Base · BSC · Tempo' },
            { v: '0', l: 'Human Clicks', s: 'Fully automated' },
            { v: '100%', l: 'Uptime', s: 'Railway deployed' },
            { v: '30s', l: 'Avg Settlement', s: 'Tweet to receipt' },
          ].map((s) => (
            <div key={s.l} className="bg-gray-950 p-5 flex flex-col justify-between min-h-[100px]">
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-30">{s.l}</span>
              <div>
                <span className="text-xl font-extrabold">{s.v}</span>
                <p className="text-[10px] opacity-30">{s.s}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs opacity-40">Try it now: Tweet @monibot</p>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 12: Gasless Deep Dive — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>The Magic</Label>
        <H2 className="mb-10">True Gasless Payments</H2>
        <div className="grid md:grid-cols-3 gap-px bg-gray-200 border border-gray-950/10 max-w-3xl">
          <div className="bg-blue-50 p-6">
            <div className="flex items-center gap-2 mb-6">
              <ChainBadge chain="base" />
              <span className="text-[10px] opacity-40">/ BSC</span>
            </div>
            <div className="space-y-3 text-xs opacity-60">
              <p>User signs EIP-712 message</p>
              <p>→ Relayer submits on-chain</p>
              <p>→ Relayer pays gas (ETH/BNB)</p>
              <p>→ 1% fee deducted from amount</p>
            </div>
            <p className="mt-4 text-[10px] opacity-30">User pays indirectly via fee</p>
          </div>
          <div className="bg-gray-950 p-6 text-white">
            <div className="mb-6">
              <ChainBadge chain="tempo" />
            </div>
            <div className="space-y-3 text-xs opacity-80">
              <p>We sponsor ALL fees natively</p>
              <p>→ User receives 100%</p>
              <p>→ No gas token needed</p>
              <p>→ Zero friction</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[10px] opacity-50">
              <Check className="w-3 h-3" />
              <span>Payments become invisible.</span>
            </div>
          </div>
          <div className="bg-white p-6">
            <h4 className="text-[10px] font-bold tracking-widest uppercase opacity-30 mb-6">Result</h4>
            <div className="space-y-3 text-xs opacity-60">
              <p>User opens app</p>
              <p>→ Enters amount + @tag</p>
              <p>→ Enters PIN</p>
              <p>→ Done</p>
            </div>
            <p className="mt-4 text-[10px] font-bold opacity-40">No gas. No wallet extension. No blockchain UI.</p>
          </div>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 13: Autonomous Campaigns — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Campaigns</Label>
        <H2 className="mb-2">AI-Powered Marketing</H2>
        <p className="text-sm opacity-30 mb-10">That never sleeps. On every chain.</p>
        <div className="border border-gray-950/10 p-6 max-w-lg mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ChainBadge chain="base" />
            <ChainBadge chain="bsc" />
            <ChainBadge chain="tempo" />
          </div>
          <p className="text-base font-mono font-bold opacity-80">"First 5 to reply get $1"</p>
          <p className="text-[10px] opacity-30 mt-2">MoniBot auto-selects token per chain: USDC / USDT / aUSD</p>
        </div>
        <div className="space-y-2 max-w-md">
          <BulletCheck>Posts to Twitter autonomously</BulletCheck>
          <BulletCheck>Evaluates replies (AI blocks spam)</BulletCheck>
          <BulletCheck>Distributes grants on-chain</BulletCheck>
          <BulletCheck>Confirms with recipients via reply</BulletCheck>
          <BulletCheck>Tracks budget & auto-completes</BulletCheck>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 14: Use Cases — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Use Cases</Label>
        <H2 className="mb-10">Real-World Impact</H2>
        <div className="grid sm:grid-cols-2 gap-px bg-gray-950/10 border border-gray-950/10 max-w-2xl">
          {[
            { icon: Store, title: 'Merchants', desc: "Street vendor's phone = POS terminal. No hardware. No fees. QR or Tap.", badge: 'base' as const },
            { icon: Send, title: 'P2P Payments', desc: 'Send money like texting. Twitter → Blockchain in 30s.', badge: 'bsc' as const },
            { icon: Target, title: 'Growth Marketing', desc: 'AI runs campaigns 24/7. Acquires users autonomously.', badge: 'tempo' as const },
            { icon: Globe, title: 'Emerging Markets', desc: 'No bank account needed. Just a Twitter handle and a PIN.', badge: null },
          ].map((uc) => (
            <div key={uc.title} className="bg-white p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <uc.icon className="w-5 h-5 opacity-15" />
                {uc.badge && <ChainBadge chain={uc.badge} />}
              </div>
              <div>
                <h3 className="text-sm font-bold mb-1">{uc.title}</h3>
                <p className="text-[11px] opacity-40 leading-relaxed">{uc.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 15: Security — Inverted
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <Label>Security</Label>
        <H2 className="mb-2">Battle-Hardened Architecture</H2>
        <p className="text-sm opacity-40 mb-10">Frontend → Edge Functions → Database. Never direct.</p>
        <div className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10 max-w-2xl">
          {[
            { title: 'Gatekeeper Pattern', desc: 'All mutations routed through Edge Functions with HMAC-SHA256 verification. No direct DB access from browser.' },
            { title: 'Ownership Verification', desc: 'Every profile update requires wallet address proof. Prevents horizontal privilege escalation.' },
            { title: 'Rate Limiting', desc: '5 relay requests/min per wallet. 10/min per IP. Prevents treasury drain attacks.' },
            { title: 'Deny-All RLS', desc: 'Row Level Security enabled on every table. Client can\'t read sensitive data directly.' },
          ].map((item) => (
            <div key={item.title} className="bg-gray-950 p-5 flex flex-col gap-2">
              <h3 className="text-xs font-bold">{item.title}</h3>
              <p className="text-[11px] opacity-40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 16: Architecture — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Architecture</Label>
        <H2 className="mb-10">Built for Scale</H2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-950/10 border border-gray-950/10">
          {[
            { title: 'Frontend', sub: 'React + TypeScript', items: ['Multi-chain wallets', 'Real-time balances', 'PWA installable'] },
            { title: 'Contracts', sub: 'Solidity × 3 Chains', items: ['MoniPayRouter (POS)', 'MoniBotRouter (Social)', '1% / 1.3% fees'] },
            { title: 'Backend', sub: 'Supabase + Railway', items: ['Edge Functions', 'Worker bots (×3)', 'Reply bots (×3)'] },
            { title: 'AI Layer', sub: 'Gemini 2.0 Flash', items: ['Intent parsing', 'Spam detection', 'Campaign strategy'] },
          ].map((col) => (
            <div key={col.title} className="bg-white p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-bold">{col.title}</h3>
                <p className="text-[10px] opacity-25">{col.sub}</p>
              </div>
              <div className="space-y-1.5">
                {col.items.map((item) => (
                  <p key={item} className="text-[11px] opacity-40">· {item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 17: Differentiation — Inverted
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <Label>Differentiation</Label>
        <H2 className="mb-8">Not Just Another Payment App</H2>
        <div className="max-w-md space-y-6">
          <div className="opacity-40">
            <p className="text-xs uppercase tracking-widest mb-2">Most projects:</p>
            <p className="text-sm">"We built a wallet" / "We built DeFi" / "We built NFTs"</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-2 opacity-60">MoniPay:</p>
            <p className="text-xl font-extrabold">"We built an autonomous employee"</p>
          </div>
          <div className="h-px bg-white/10" />
          <p className="text-sm opacity-60">
            This isn't infrastructure.<br />
            <span className="font-bold opacity-100">It's Agentic Commerce.</span>
          </p>
          <p className="text-xs opacity-30">
            AI that doesn't wait for instructions — it executes business strategy 24/7.
          </p>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 18: The Vision — Inverted
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <Label>Vision</Label>
        <H1>Agentic Commerce</H1>
        <div className="mt-10 max-w-md space-y-6">
          <div className="opacity-40">
            <p className="text-xs uppercase tracking-widest mb-1">Today</p>
            <p className="text-sm">Humans run marketing → Bots execute tasks</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1 opacity-60">Tomorrow</p>
            <p className="text-sm font-bold">Bots run marketing → Humans supervise strategy</p>
          </div>
          <div className="h-px bg-white/10" />
          <p className="text-sm opacity-60">
            MoniBot is our VP of Growth.<br />
            It posts. It evaluates. It distributes. It reports.
          </p>
          <p className="text-xs opacity-30">24/7. No vacation. No salary. Just performance.</p>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 19: Roadmap — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Roadmap</Label>
        <H2 className="mb-10">What's Next</H2>
        <div className="grid sm:grid-cols-3 gap-px bg-gray-950/10 border border-gray-950/10 max-w-3xl">
          {[
            {
              q: 'Q1 2026', sub: 'Now', items: [
                '✅ Base + BSC mainnet live',
                '✅ Tempo testnet integration',
                '✅ 100+ autonomous transactions',
                '✅ 6 deployed smart contracts',
              ]
            },
            {
              q: 'Q2 2026', sub: 'Next', items: [
                '🎯 Tempo mainnet migration',
                '🎯 Passkey authentication',
                '🎯 Scheduled payments',
                '🎯 Chrome Extension',
              ]
            },
            {
              q: 'Q3 2026', sub: 'Scale', items: [
                '🎯 Merchant API & webhooks',
                '🎯 Advanced campaign AI',
                '🎯 Cross-chain routing',
                '🎯 10,000+ daily transactions',
              ]
            },
          ].map((phase) => (
            <div key={phase.q} className="bg-white p-6">
              <h3 className="text-sm font-bold">{phase.q}</h3>
              <p className="text-[10px] opacity-25 mb-4">{phase.sub}</p>
              <div className="space-y-1.5">
                {phase.items.map((item) => (
                  <p key={item} className="text-[11px] opacity-50">{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 20: CTA — Multi-chain gradient
    // ═══════════════════════════════════════════
    () => (
      <Slide inverted>
        <div className="text-center">
          <Label>Try It</Label>
          <H1 className="mb-6">Try It. Right Now.</H1>
          <div className="border border-white/10 p-6 max-w-sm mx-auto mb-8">
            <p className="text-sm font-mono font-bold">Tweet: "@monibot send $1 to @yourfriend"</p>
          </div>
          <p className="text-sm opacity-50 mb-6">Or visit: monipay.xyz</p>
          <div className="flex items-center justify-center gap-4">
            <ChainBadge chain="base" size="lg" />
            <ChainBadge chain="bsc" size="lg" />
            <ChainBadge chain="tempo" size="lg" />
          </div>
          <p className="mt-10 text-sm font-bold opacity-60">
            The future of payments is autonomous. And it's live today.
          </p>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // SLIDE 21: Thank You — Neutral
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <div className="text-center">
          <H1 className="mb-2">MoniPay</H1>
          <p className="text-sm opacity-40 mb-12">Autonomous Payments, Delivered</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-lg mx-auto mb-12">
            {[
              { l: 'Built by', v: '@wallstreetjade' },
              { l: 'Try it', v: '@monibot' },
              { l: 'Website', v: 'monipay.xyz' },
              { l: 'Code', v: 'github.com/monipay' },
            ].map((c) => (
              <div key={c.l}>
                <p className="text-[10px] font-bold tracking-widest uppercase opacity-25 mb-1">{c.l}</p>
                <p className="text-xs font-bold opacity-60">{c.v}</p>
              </div>
            ))}
          </div>
          <div className="border border-gray-950/10 p-4 max-w-lg mx-auto text-left">
            <p className="text-[10px] font-bold tracking-widest uppercase opacity-25 mb-3">Smart Contracts</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <ChainBadge chain="base" />
                <p className="text-[9px] font-mono opacity-30 mt-1.5">POS: 0x4048...D2c0</p>
                <p className="text-[9px] font-mono opacity-30">Bot: 0xBEE3...A516</p>
              </div>
              <div>
                <ChainBadge chain="bsc" />
                <p className="text-[9px] font-mono opacity-30 mt-1.5">POS: 0x5572...bcb5</p>
                <p className="text-[9px] font-mono opacity-30">Bot: 0x9EED...832E</p>
              </div>
              <div>
                <ChainBadge chain="tempo" />
                <p className="text-[9px] font-mono opacity-30 mt-1.5">POS: 0xa39C...BDb9</p>
                <p className="text-[9px] font-mono opacity-30">Bot: 0x78A8...49fc</p>
              </div>
            </div>
          </div>
          <p className="mt-10 text-lg font-extrabold opacity-20">Questions?</p>
        </div>
      </Slide>
    ),

    // ═══════════════════════════════════════════
    // BONUS: Technical Deep Dive
    // ═══════════════════════════════════════════
    () => (
      <Slide>
        <Label>Bonus: Under the Hood</Label>
        <H2 className="mb-10">Per-Chain Execution</H2>
        <div className="grid sm:grid-cols-3 gap-px bg-gray-200 border border-gray-950/10 max-w-3xl">
          <div className="bg-blue-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ChainBadge chain="base" />
            </div>
            <div className="space-y-1 text-[11px] opacity-50">
              <p>User signs EIP-712 payload</p>
              <p>Relayer submits to Base</p>
              <p>MoniPayRouter.relayPayment()</p>
              <p>ETH gas paid by relayer</p>
            </div>
          </div>
          <div className="bg-yellow-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ChainBadge chain="bsc" />
            </div>
            <div className="space-y-1 text-[11px] opacity-50">
              <p>Same EIP-712 pattern</p>
              <p>Relayer submits to BSC</p>
              <p>MoniPayRouter.relayPayment()</p>
              <p>BNB gas paid by relayer</p>
            </div>
          </div>
          <div className="bg-gray-950 p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <ChainBadge chain="tempo" />
            </div>
            <div className="space-y-1 text-[11px] opacity-60">
              <p>feePayer = sponsor wallet</p>
              <p>TIP-20 transfer with memo</p>
              <p>2D nonces (parallel)</p>
              <p>Batch calls (multi-recipient)</p>
            </div>
          </div>
        </div>
        <p className="mt-6 text-xs opacity-30">Same user experience. Different execution paths. Optimized per chain.</p>
      </Slide>
    ),
  ];
}

/* ─── Deck Page ─── */
function DeckThemeForcer() {
  const { setTheme } = useTheme();
  useEffect(() => { setTheme('light'); }, [setTheme]);
  return null;
}

const Deck = () => {
  const [current, setCurrent] = useState(0);
  const allSlides = slides();
  const total = allSlides.length;

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  // Touch swipe support
  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { diff > 0 ? goNext() : goPrev(); }
    };
    window.addEventListener('touchstart', onStart);
    window.addEventListener('touchend', onEnd);
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [goNext, goPrev]);

  const SlideComponent = allSlides[current];

  return (
    <>
      <PageMeta title="Pitch Deck" description="MoniPay investor deck — the future of gasless, non-custodial payments on Base." path="/deck" noIndex />
      <DeckThemeForcer />
      <div className="fixed inset-0 overflow-hidden select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
          >
            <SlideComponent />
          </motion.div>
        </AnimatePresence>

        {/* Navigation bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-50">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="p-2 opacity-20 hover:opacity-60 disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {allSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-0.5 transition-all duration-300 rounded-full ${i === current ? 'w-6 opacity-60 bg-current' : 'w-1.5 opacity-15 bg-current hover:opacity-25'}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold tracking-widest opacity-20 ml-2">
              {current + 1}/{total}
            </span>
          </div>

          <button
            onClick={goNext}
            disabled={current === total - 1}
            className="p-2 opacity-20 hover:opacity-60 disabled:opacity-0 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
};

export default Deck;
