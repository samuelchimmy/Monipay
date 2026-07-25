import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from './LanguageSelector';
import {
  Bot,
  Zap,
  Users,
  Globe,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Clock,
  Shield,
  Send,
  Twitter,
  Hash,
  Repeat2,
  Gift,
  Calendar,
  Lock,
  Bell,
  UserX,
  CreditCard,
  BarChart3,
  RefreshCw,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { MoniPayLogo } from "./MoniPayLogo";
import { ChainCrossLinks } from "./ChainCrossLinks";
import { PageMeta } from "./PageMeta";
import { XExhibitBadge } from "./XExhibitBadge";
import discordLogo from "@/assets/discord-logo.svg";
import telegramLogo from "@/assets/telegram-logo.svg";
import { NetworkBase, NetworkBinanceSmartChain, NetworkSolana, NetworkInk, NetworkCelo } from "@web3icons/react";

// ── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Grid background ───────────────────────────────────────────────────────────
function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

// ── Smooth wave SVG card background ──────────────────────────────────────────
function WaveBg({
  color1,
  color2,
  opacity = 0.18,
  id: idProp,
}: {
  color1: string;
  color2: string;
  opacity?: number;
  id?: string;
}) {
  const id = idProp || `wg${color1.replace(/[^a-z0-9]/gi, "")}${color2.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none" style={{ zIndex: 0 }}>
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity }}
      >
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color1} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
        </defs>
        <path
          d="M0,70 C60,30 120,110 180,70 C240,30 300,100 360,65 C385,52 396,60 400,55 L400,220 L0,220 Z"
          fill={`url(#${id})`}
        />
        <path
          d="M0,110 C70,80 130,140 200,105 C270,70 330,135 400,100 L400,220 L0,220 Z"
          fill={color2}
          fillOpacity="0.22"
        />
        <path
          d="M0,150 C80,125 160,168 240,145 C310,124 360,158 400,140 L400,220 L0,220 Z"
          fill={color1}
          fillOpacity="0.10"
        />
      </svg>
    </div>
  );
}

// ── Platform button ───────────────────────────────────────────────────────────
function PlatformBtn({
  icon,
  label,
  href,
  bg,
  hoverBg,
  textColor = "#fff",
  border,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  bg: string;
  hoverBg: string;
  textColor?: string;
  border?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 12,
        background: hov ? hoverBg : bg,
        border: border ? `1.5px solid ${border}` : "none",
        color: textColor,
        textDecoration: "none",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? `0 10px 30px ${bg}55` : `0 2px 12px ${bg}33`,
        transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        flex: "1 1 0",
        minWidth: 0,
        cursor: "pointer",
      }}
    >
      {icon}
      <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </a>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  desc,
  wave1,
  wave2,
  platform,
  borderColor,
  waveId,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  wave1: string;
  wave2: string;
  platform: string;
  borderColor: string;
  waveId: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        background: "hsl(var(--background))",
        border: `1.5px solid ${hov ? borderColor : "hsl(var(--border))"}`,
        padding: "26px 22px 22px",
        transform: hov ? "translateY(-5px)" : "translateY(0)",
        boxShadow: hov ? `0 16px 40px ${borderColor}22` : "0 2px 10px rgba(0,0,0,0.05)",
        transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <WaveBg color1={wave1} color2={wave2} opacity={hov ? 0.22 : 0.13} id={waveId} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: `linear-gradient(135deg, ${wave1}22, ${wave2}33)`,
            border: `1.5px solid ${wave1}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: 19, height: 19, color: wave1 }} />
        </div>
        <span
          style={{
            background: `${borderColor}18`,
            color: borderColor,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.06em",
            padding: "3px 10px",
            borderRadius: 20,
            textTransform: "uppercase",
            border: `1px solid ${borderColor}33`,
          }}
        >
          {platform}
        </span>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "hsl(var(--foreground))",
            letterSpacing: "-0.02em",
            marginBottom: 5,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.65 }}>{desc}</p>
      </div>
    </div>
  );
}

// ── Subscription feature item ─────────────────────────────────────────────────
function SubFeature({ icon: Icon, text, color }: { icon: React.ElementType; text: string; color: string }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon style={{ width: 11, height: 11 }} />
      </span>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{text}</span>
    </li>
  );
}

// ── Subscription card ─────────────────────────────────────────────────────────
function SubCard({
  platform,
  color,
  Icon,
  features,
  waveId,
}: {
  platform: string;
  color: string;
  Icon: React.ElementType;
  features: { icon: React.ElementType; text: string }[];
  waveId: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        overflow: "hidden",
        background: "#0d1117",
        border: `1.5px solid ${color}44`,
        padding: "28px 24px 26px",
        boxShadow: `0 4px 28px ${color}1a`,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <WaveBg color1={color} color2="#1a2030" opacity={0.32} id={waveId} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon style={{ width: 22, height: 22, color }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-0.01em" }}>{platform}</span>
        </div>
        <span
          style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "4px 12px",
            borderRadius: 20,
            textTransform: "uppercase",
          }}
        >
          Coming Soon
        </span>
      </div>
      <ul
        style={{
          position: "relative",
          zIndex: 1,
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 11,
        }}
      >
        {features.map((f, i) => (
          <SubFeature key={i} icon={f.icon} text={f.text} color={color} />
        ))}
      </ul>
    </div>
  );
}

// ── Chain pill ────────────────────────────────────────────────────────────────
function ChainPill({
  name,
  symbol,
  color,
  Logo,
  fg = "#fff",
}: {
  name: string;
  symbol: string;
  color: string;
  Logo: React.ComponentType<any>;
  fg?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide hover:opacity-80 transition-opacity"
      style={{ background: color, color: fg }}
    >
      <Logo size={12} variant="branded" />
      {name} · {symbol}
    </span>
  );
}

// ── SVG platform icons ────────────────────────────────────────────────────────
const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.254 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramSvg = ({ size = 18 }: { size?: number }) => (
  <img src={telegramLogo} width={size} height={size} alt="Telegram" style={{ display: "block" }} />
);

const DiscordSvg = ({ size = 18 }: { size?: number }) => (
  <img src={discordLogo} width={size} height={size} alt="Discord" style={{ display: "block", filter: "brightness(0) invert(1)" }} />
);

// ── Data ──────────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Send,
    title: "P2P Transfer",
    desc: "Send stablecoins to any MoniTag holder instantly. Type a sentence, money moves on-chain.",
    platform: "All Platforms",
    wave1: "#0052FF",
    wave2: "#7C3AED",
    borderColor: "#0052FF",
    waveId: "wf1",
  },
  {
    icon: Users,
    title: "Multi Send",
    desc: "Batch payments in one command. Split costs, pay a squad, or distribute salaries.",
    platform: "All Platforms",
    wave1: "#0EA5E9",
    wave2: "#0052FF",
    borderColor: "#0EA5E9",
    waveId: "wf2",
  },
  {
    icon: Lock,
    title: "MagicPay Escrow",
    desc: "Send to anyone, even the unregistered. Funds wait on-chain for 180 days. Trustless claim.",
    platform: "All Platforms",
    wave1: "#7C3AED",
    wave2: "#EC4899",
    borderColor: "#7C3AED",
    waveId: "wf3",
  },
  {
    icon: Repeat2,
    title: "Auto Reroute",
    desc: "Insufficient balance or allowance? MoniBot silently checks every chain and reroutes to the best one.",
    platform: "Intelligent",
    wave1: "#10B981",
    wave2: "#0052FF",
    borderColor: "#10B981",
    waveId: "wf4",
  },
  {
    icon: Gift,
    title: "Campaign Grants",
    desc: "Post a giveaway tweet or group message. AI evaluates replies for quality and distributes grants.",
    platform: "X + Discord",
    wave1: "#F59E0B",
    wave2: "#EF4444",
    borderColor: "#F59E0B",
    waveId: "wf5",
  },
  {
    icon: Calendar,
    title: "Scheduled Payments",
    desc: 'Set a payment for later. Say "Send $50 to @alice in 2 hours" and MoniBot handles the rest.',
    platform: "All Platforms",
    wave1: "#06B6D4",
    wave2: "#0052FF",
    borderColor: "#06B6D4",
    waveId: "wf6",
  },
  {
    icon: Globe,
    title: "Multi Chain Balance",
    desc: "Check your wallet across Base, BSC, Celo, Ink and Solana in one command.",
    platform: "All Platforms",
    wave1: "#0052FF",
    wave2: "#10B981",
    borderColor: "#0052FF",
    waveId: "wf7",
  },
  {
    icon: Shield,
    title: "On Chain Dedup",
    desc: "Tweet ID and nonce stored on-chain. Every payment executes exactly once. No double sends.",
    platform: "Security",
    wave1: "#EF4444",
    wave2: "#F59E0B",
    borderColor: "#EF4444",
    waveId: "wf8",
  },
  {
    icon: Bot,
    title: "AI Natural Language",
    desc: 'No rigid syntax. "Slide 10 bucks to jade" works exactly like "send $10 to @jade". MoniBot understands intent.',
    platform: "All Platforms",
    wave1: "#8B5CF6",
    wave2: "#0052FF",
    borderColor: "#8B5CF6",
    waveId: "wf9",
  },
];

const discordSubFeatures = [
  {
    icon: CreditCard,
    text: "Admin sets subscription fee, token, chain and duration directly in the server. Weekly, monthly or quarterly.",
  },
  {
    icon: Send,
    text: "Members pay with a single CasualPay command. MoniBot registers the subscription on-chain instantly.",
  },
  { icon: Bell, text: "Automated DM warnings sent to subscribers 7 days, 3 days and 24 hours before expiry." },
  {
    icon: MessageSquare,
    text: "Optional public announcement in a dedicated channel by @mention when a subscription expires.",
  },
  {
    icon: UserX,
    text: "Admin configures auto-kick for expired subscribers with a custom grace period of 1 to 7 days.",
  },
  {
    icon: BarChart3,
    text: "Admin dashboard shows active subscribers, total revenue and an expiry calendar at a glance.",
  },
  {
    icon: RefreshCw,
    text: "Verified subscriber role assigned automatically on payment and revoked cleanly on expiry.",
  },
];

const telegramSubFeatures = [
  {
    icon: CreditCard,
    text: "Group admin locks a subscription tier with a fee, token and chain of their choice in seconds.",
  },
  {
    icon: Send,
    text: 'Members type "subscribe" and MoniBot generates a payment link. One confirmation and they are in.',
  },
  { icon: Bell, text: "MoniBot sends private warnings 7 days and 1 day before a subscription expires via bot DM." },
  { icon: UserX, text: "Auto-removal from group on expiry with a configurable grace period set by the admin." },
  { icon: MessageSquare, text: "Admin can designate a special announce topic for subscription renewal reminders." },
  { icon: BarChart3, text: "Revenue reports available to group admins via bot DM on demand at any time." },
  { icon: RefreshCw, text: "Lapsed members pay and rejoin instantly with a frictionless re-subscribe flow." },
];

const commands = [
  {
    cmd: "@monibot send $5 to @alice",
    desc: "Send $5 USDC to @alice on their preferred chain. Gasless for both parties.",
    label: "P2P Transfer",
    color: "#0052FF",
  },
  {
    cmd: "@monibot send $1 to @a, @b, @c",
    desc: "Batch transfer to multiple recipients in one command. One message, multiple payments.",
    label: "Multi Send",
    color: "#0EA5E9",
  },
  {
    cmd: "Reply to campaign tweet",
    desc: "Reply to a MoniBot campaign tweet to receive a grant. Automatic AI distribution.",
    label: "Campaign Grant",
    color: "#F59E0B",
  },
  {
    cmd: "@monibot balance",
    desc: "Check your MoniPay balance across all chains. Base, BSC, Celo, Ink, Solana.",
    label: "Balance Check",
    color: "#10B981",
  },
];

// ── FAQs ──────────────────────────────────────────────────────────────────────
const faqs: { q: string; a: string }[] = [
  {
    q: "What is MoniBot?",
    a: "MoniBot is MoniPay's autonomous AI payment agent. It lets you send stablecoins on Base, BNB Chain, Celo, Ink and Solana directly from X (Twitter), Discord and Telegram using natural-language commands. Payments are gasless, on-chain and settle in seconds.",
  },
  {
    q: "Is MoniBot just a tipping bot for X (Twitter)?",
    a: "No, tipping is just one of its use cases. MoniBot is a complete multilevel financial intent execution bot for X. You can send stablecoins, trigger conditional distributions, or execute scheduled transfers simply by replying to any tweet with '@monibot send $5 to @username'. The recipient gets paid in stablecoins on their preferred chain with no browser extensions, seed phrases, or gas.",
  },
  {
    q: "What types of financial intents can MoniBot execute on X (Twitter)?",
    a: "MoniBot supports a wide range of multilevel financial intents including P2P transfers, tipping, multi-recipient distributions, subscription payments, and giveaway campaigns. Simply mention @monibot in any tweet, reply or quote to trigger the execution. Senders and recipients are notified instantly with a public on-chain receipt.",
  },
  {
    q: "Can MoniBot execute financial intents on Discord?",
    a: "Yes. Add MoniBot to any Discord server and members can execute multilevel financial intents (sends, tipping, subscription payments, or conditional claims) using commands like /send, /tip, or /pay. MoniBot also automates server-wide giveaway campaigns with AI-evaluated entries and automatic stablecoin payouts.",
  },
  {
    q: "Can I use MoniBot to execute financial intents on Telegram?",
    a: "Yes. Add @monipaybot to any Telegram group or DM it directly. You can execute financial intents (transfers, scheduled payments, and tipping) in plain English: 'send $1 to @alice'. Funds are delivered on-chain in seconds with a detailed Telegram receipt.",
  },
  {
    q: "Is MoniBot the best crypto payment bot for Discord servers?",
    a: "MoniBot is built for real on-chain payments — not points, not credits. Server admins get gasless P2P, batch payments, campaign grants, and full Discord-native commands. Every execution is a real stablecoin transfer with an explorer link, which puts MoniBot ahead of point-only or single-chain Discord bots.",
  },
  {
    q: "What is the best subscription bot for Discord?",
    a: "MoniBot's upcoming Subscription Manager turns any Discord server into a paid community. Admins set the fee, token, chain and duration; MoniBot collects on-chain payments, sends expiry warnings, manages roles and auto-kicks lapsed subscribers — all with zero custodial risk.",
  },
  {
    q: "Can MoniBot manage subscriptions on Discord and Telegram?",
    a: "Yes. MoniBot's subscription manager works on both Discord servers and Telegram groups. Members pay a single command, MoniBot tracks expiry on-chain, and revenue dashboards are available to admins on demand.",
  },
  {
    q: "Which chains and stablecoins does MoniBot support?",
    a: "MoniBot is live on Base (USDC), BNB Chain (USDT), Celo (USDT/USDm via MiniPay), Ink (USDT0) and Solana (USDC). Cross-chain auto-routing picks the best chain when a sender has insufficient balance on their preferred network.",
  },
  {
    q: "Are MoniBot payments really gasless?",
    a: "Yes. MoniPay sponsors gas on Base, BNB Chain, Celo and Ink via meta-transactions. On Solana, MoniPay acts as the fee payer. Senders and recipients pay zero gas — only a transparent 1% platform fee on transfers.",
  },
  {
    q: "Do I need a wallet to receive a MoniBot tip?",
    a: "No. MoniBot's MagicPay escrow lets you send to any X, Discord or Telegram identity even before they sign up. Funds wait on-chain for 180 days. The recipient creates a free MoniPay account with their MoniTag and claims instantly.",
  },
  {
    q: "Is MoniBot non-custodial?",
    a: "Yes. Every MoniPay user holds their own private key, encrypted locally with their PIN. MoniBot never custodies funds; it relays signed transactions to MoniPay's audited router contracts on each chain.",
  },
  {
    q: "How does MoniBot prevent double-payments?",
    a: "Every tweet ID, Discord message ID and Telegram message ID is recorded on-chain through the MoniBot router. Replays are rejected at the contract level, so a single command can only execute once.",
  },
  {
    q: "How do I get started with MoniBot?",
    a: "Create a free MoniTag at monipay.xyz, fund your wallet with stablecoins, then mention @monibot on X, add it to your Discord server, or message @monipaybot on Telegram. Your first tip takes under 30 seconds.",
  },
  {
    q: "Does MoniBot charge fees?",
    a: "MoniBot uses MoniPay's standard 1% fee on stablecoin transfers and a 2% fee on MagicPay escrow. There are no hidden charges, gas fees or subscription costs to use the bot itself.",
  },
];

// ── Main export ───────────────────────────────────────────────────────────────
export function MoniBotLanding() {
  return (
    <>
      <PageMeta
        title="MoniBot — AI Payment Agent"
        description="MoniBot is MoniPay's autonomous AI agent. Send payments via Twitter, Discord, and Telegram. Gasless, cross-chain, 24/7."
        path="/monibot"
        ogImage="https://monipay.xyz/og/monibot.png"
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'MoniBot', url: 'https://monipay.xyz/monibot' },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background">
        {/* ── Header ── */}
        <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
          <div className="flex items-center gap-3">
            <MoniPayLogo size={32} animationMode="idle" showText textSize={16} />
            <div className="h-4 w-px bg-foreground/15" />
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">MoniBot</span>
            </div>
          </div>
          <Button
            size="sm"
            asChild
            className="text-xs font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90 px-6 h-9"
          >
            <a href="https://monipay.xyz">Open App</a>
          </Button>
        </header>

        {/* ── Hero ── */}
        <section className="relative px-6 lg:px-16 py-20 lg:py-32 overflow-hidden">
          <GridBg />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10 text-center">
            {/* Live badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Autonomous AI Agent · Live on 5 Chains
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5 }}
              className="text-4xl sm:text-5xl lg:text-[4.2rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
            >
              The AI That Sends
              <br />
              <span className="text-primary">Payments for You.</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-sm text-foreground/50 mb-10 max-w-lg mx-auto leading-relaxed"
            >
              MoniBot is MoniPay's autonomous AI agent. Send stablecoin payments via Twitter, Discord, and Telegram.
              Cross-chain routing, campaign distribution, batch transfers. All gasless, all autonomous, 24/7.
            </motion.p>

            {/* Platform buttons — compact, equal-width, single row on all viewports */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 8,
                justifyContent: "center",
                marginBottom: 14,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <PlatformBtn icon={<XIcon size={16} />} label="X" href="https://x.com/monibot" bg="#000" hoverBg="#1a1a1a" />
              <PlatformBtn icon={<TelegramSvg size={18} />} label="Telegram" href="https://t.me/monipaybot?startgroup=new" bg="#229ED9" hoverBg="#1a8fc4" />
              <PlatformBtn icon={<DiscordSvg size={16} />} label="Discord" href="https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=6829344014687335&integration_type=0&scope=bot" bg="#5865F2" hoverBg="#4752d4" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
              className="flex justify-center mb-4"
            >
              <XExhibitBadge variant="pill" />
            </motion.div>

            {/* Chain pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 28 }}
            >
              <ChainPill name="Base" symbol="USDC" color="#0052FF" fg="#fff" Logo={NetworkBase} />
              <ChainPill name="BSC" symbol="USDT" color="#F0B90B" fg="#0a0a0a" Logo={NetworkBinanceSmartChain} />
              <ChainPill name="Solana" symbol="USDC" color="#14F195" fg="#0a0a0a" Logo={NetworkSolana} />
              <ChainPill name="Ink" symbol="USDT0" color="#7B5EA7" fg="#fff" Logo={NetworkInk} />
              <ChainPill name="Celo" symbol="USDT" color="#FCFF52" fg="#0a0a0a" Logo={NetworkCelo} />
            </motion.div>
          </div>
        </section>

        {/* ── Commands ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">
                  Commands
                </span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  How to Use MoniBot
                </h2>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
              {commands.map((c, i) => (
                <Reveal key={c.label} delay={i * 0.06}>
                  <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between">
                    <div className="flex items-start justify-between mb-4">
                      <Bot className="w-4 h-4 text-foreground/15" />
                      <span className="text-[9px] font-bold tracking-wider text-foreground/20 uppercase">
                        {c.label}
                      </span>
                    </div>
                    <div>
                      <code style={{ color: c.color }} className="text-xs font-mono font-bold block mb-2">
                        {c.cmd}
                      </code>
                      <p className="text-[11px] text-foreground/40 leading-relaxed">{c.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature cards ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">
                  Capabilities
                </span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Everything MoniBot Can Do
                </h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-md">
                  One agent. Five chains. Three platforms. Infinite use cases.
                </p>
              </div>
            </Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.04}>
                  <FeatureCard {...f} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Platforms (dark band) ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">
                  Platforms
                </span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">
                  Everywhere You Are
                </h2>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-px bg-background/10">
              {[
                {
                  icon: Twitter,
                  name: "Twitter / X",
                  desc: "Mention @monibot in any tweet to trigger payments, check balances, or join campaigns.",
                  color: "#aaa",
                },
                {
                  icon: Hash,
                  name: "Discord",
                  desc: "Use send, balance and campaign commands in any Discord server with MoniBot installed.",
                  color: "#5865F2",
                },
                {
                  icon: MessageSquare,
                  name: "Telegram",
                  desc: "Send payments and check balances via natural language messages to the bot.",
                  color: "#229ED9",
                },
              ].map((p, i) => (
                <Reveal key={p.name} delay={i * 0.08}>
                  <div className="bg-foreground p-6 lg:p-8 min-h-[180px] flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <p.icon className="w-5 h-5 text-background/30" />
                      <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: p.color }}>
                        Live
                      </span>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-background mb-1">{p.name}</h3>
                      <p className="text-[11px] text-background/40 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Subscription section ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="mb-6">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">
                  Coming Soon
                </span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Subscription Management
                </h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-lg leading-relaxed">
                  MoniBot will manage recurring on-chain subscriptions for Discord servers and Telegram groups. Admins
                  set the fee. MoniBot handles everything else automatically.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                {[
                  "Admin sets fee and duration",
                  "On-chain subscription registry",
                  "Automated expiry warnings",
                  "Auto-kick on expiry",
                  "Revenue analytics",
                ].map((t, i) => (
                  <span
                    key={i}
                    style={{
                      background: "hsl(var(--muted))",
                      color: "hsl(var(--muted-foreground))",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "5px 13px",
                      borderRadius: 20,
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
              <Reveal delay={0.08}>
                <SubCard
                  platform="Discord Subscriptions"
                  color="#5865F2"
                  Icon={DiscordSvg}
                  features={discordSubFeatures}
                  waveId="wsd"
                />
              </Reveal>
              <Reveal delay={0.14}>
                <SubCard
                  platform="Telegram Subscriptions"
                  color="#229ED9"
                  Icon={TelegramSvg}
                  features={telegramSubFeatures}
                  waveId="wst"
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── MagicPay callout ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div
                style={{
                  position: "relative",
                  borderRadius: 24,
                  overflow: "hidden",
                  background: "#0d0f1a",
                  padding: "48px 40px",
                  border: "1.5px solid rgba(124,58,237,0.3)",
                }}
              >
                <WaveBg color1="#7C3AED" color2="#0052FF" opacity={0.28} id="wmp" />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 48,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        background: "rgba(124,58,237,0.18)",
                        color: "#A78BFA",
                        border: "1px solid rgba(124,58,237,0.35)",
                        borderRadius: 20,
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "4px 14px",
                        marginBottom: 18,
                      }}
                    >
                      MagicPay · Social Escrow
                    </span>
                    <h3
                      style={{
                        fontWeight: 800,
                        fontSize: 30,
                        color: "#fff",
                        letterSpacing: "-0.03em",
                        lineHeight: 1.2,
                        marginBottom: 14,
                      }}
                    >
                      Send to anyone.
                      <br />
                      <span style={{ color: "#A78BFA" }}>Even the unregistered.</span>
                    </h3>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
                      MagicPay locks funds in an on-chain escrow tied to the recipient's social identity. When they
                      create a MoniPay account and link their profile, funds release automatically. 180-day claim
                      window. Trustless. Immutable.
                    </p>
                    <div style={{ display: "flex", gap: 28 }}>
                      {(
                        [
                          ["180 days", "Claim window"],
                          ["2%", "Escrow fee"],
                          ["5 chains", "Supported"],
                        ] as const
                      ).map(([val, lbl]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: "#A78BFA" }}>{val}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mock MagicPay claim card — styled after the real screenshot */}
                  <div>
                    <div
                      style={{
                        background: "linear-gradient(135deg, #7C3AED 0%, #5046E5 55%, #0052FF 100%)",
                        borderRadius: 22,
                        padding: "28px 26px",
                        boxShadow: "0 24px 64px rgba(124,58,237,0.45)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 20,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "rgba(255,255,255,0.18)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 15,
                            }}
                          >
                            ✦
                          </div>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>
                            MagicPay
                          </span>
                        </div>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.15)",
                            color: "#fff",
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: "3px 11px",
                            borderRadius: 20,
                            letterSpacing: "0.06em",
                          }}
                        >
                          ACTIVATED
                        </span>
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        You Received
                      </div>
                      <div style={{ color: "#fff", fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>
                        $50.00 <span style={{ fontSize: 16, opacity: 0.65 }}>USDC</span>
                      </div>
                      <div
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.13)",
                          marginTop: 20,
                          paddingTop: 16,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 8,
                        }}
                      >
                        {(
                          [
                            ["FROM", "@alice via Discord"],
                            ["SENT", "Apr 20, 2026"],
                            ["EXPIRES", "Oct 17, 2026"],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k}>
                            <div
                              style={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: 8.5,
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                marginBottom: 3,
                              }}
                            >
                              {k}
                            </div>
                            <div style={{ color: "#fff", fontSize: 10.5, fontWeight: 600 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 20,
                          background: "rgba(255,255,255,0.14)",
                          borderRadius: 14,
                          padding: "13px 0",
                          textAlign: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: "pointer",
                          backdropFilter: "blur(10px)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        ⚡ Claim $50.00 USDC
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-28 border-t border-foreground/5 relative">
          <GridBg />
          <div className="max-w-3xl mx-auto relative z-10">
            <Reveal>
              <div className="text-center">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                  Start Using MoniBot
                </h2>
                <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto leading-relaxed">
                  Create a MoniTag on monipay.xyz, then mention @monibot on Twitter to send your first payment.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="h-12 px-10 text-sm font-bold tracking-wide rounded-none">
                    <a href="https://monipay.xyz">
                      Create MoniTag <ArrowRight className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background"
                  >
                    <a href="https://x.com/monibot" target="_blank" rel="noopener noreferrer">
                      Follow @monibot <ExternalLink className="w-3.5 h-3.5 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <ChainCrossLinks />

        {/* ── FAQ ── */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="mb-10 text-center">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">
                  Questions
                </span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight inline-flex items-center gap-3">
                  <HelpCircle className="w-7 h-7 text-primary" /> Frequently Asked
                </h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-md mx-auto leading-relaxed">
                  Everything about MoniBot — intent execution, subscriptions, chains and security.
                </p>
              </div>
            </Reveal>
            <div className="divide-y divide-foreground/10 border border-foreground/10 rounded-2xl overflow-hidden bg-background">
              {faqs.map((f, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-foreground/[0.03] transition-colors">
                    <span className="text-sm font-bold text-foreground pr-4">{f.q}</span>
                    <ChevronDown className="w-4 h-4 text-foreground/40 transition-transform group-open:rotate-180 flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-5 text-[13px] leading-relaxed text-foreground/60">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-6 lg:px-16 py-8 border-t border-foreground/5">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MoniPayLogo size={20} animationMode="idle" showText textSize={10} />
              <span className="text-[10px] text-foreground/30">× MoniBot</span>
            </div>
            <div className="flex items-center gap-6 text-[11px] text-foreground/30">
              <a href="https://docs.monipay.xyz" className="hover:text-foreground transition-colors">
                Docs
              </a>
              <a href="https://blog.monipay.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Blog
              </a>
              <a href="https://discord.gg/kSAwXzeRDB" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Support
              </a>
              <a
                href="https://x.com/monipay_xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Twitter
              </a>
              <LanguageSelector variant="compact" />
              <span>© {new Date().getFullYear()} MoniPay</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
