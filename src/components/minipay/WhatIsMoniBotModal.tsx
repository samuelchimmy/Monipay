import { Bot, Send, Users, Sparkles, Clock, RefreshCw, Zap, Twitter, AtSign, Wallet, Link2, Rocket, Wand2, Coffee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const COMMAND_GROUPS: { platform: string; prefix: string; items: { icon: any; label: string; cmd: string }[] }[] = [
  {
    platform: 'X (Twitter)',
    prefix: '@monibot',
    items: [
      { icon: Send,      label: 'Send Payment', cmd: '@monibot send $5 to @alice' },
      { icon: Users,     label: 'Multi-Send',   cmd: '@monibot send $2 each to @bob, @charlie' },
      { icon: Sparkles,  label: 'Giveaway',     cmd: '@monibot send $1 to first 50 replies' },
      { icon: Clock,     label: 'Scheduled',    cmd: '@monibot send $5 to @alice in 5mins' },
      { icon: RefreshCw, label: 'Balance',      cmd: '@monibot balance' },
      { icon: Zap,       label: 'Allowance',    cmd: '@monibot allowance' },
    ],
  },
  {
    platform: 'Discord',
    prefix: '!monibot',
    items: [
      { icon: Send,      label: 'Send Payment', cmd: '!monibot send $5 to @alice' },
      { icon: Users,     label: 'Multi-Send',   cmd: '!monibot send $2 to @bob and @charlie' },
      { icon: Sparkles,  label: 'Giveaway',     cmd: '!monibot giveaway $10 to first 20 reactors' },
      { icon: Clock,     label: 'Scheduled',    cmd: '!monibot send $5 to @alice in 10mins' },
      { icon: RefreshCw, label: 'Balance',      cmd: '!monibot balance' },
      { icon: Zap,       label: 'Allowance',    cmd: '!monibot allowance' },
    ],
  },
  {
    platform: 'Telegram',
    prefix: '/monibot',
    items: [
      { icon: Send,      label: 'Send Payment', cmd: '/send $5 to @alice' },
      { icon: Users,     label: 'Multi-Send',   cmd: '/send $2 to @bob, @charlie' },
      { icon: Sparkles,  label: 'Giveaway',     cmd: '/giveaway $10 to first 20 members' },
      { icon: Clock,     label: 'Scheduled',    cmd: '/schedule $5 to @alice in 10mins' },
      { icon: RefreshCw, label: 'Balance',      cmd: '/balance' },
      { icon: Zap,       label: 'Allowance',    cmd: '/allowance' },
    ],
  },
];

const HOW_STEPS = [
  { icon: Link2,  title: 'Link your socials',  body: 'Connect X, Discord, or Telegram so MoniBot can recognise your handle and route payments to your wallet.' },
  { icon: Wallet, title: 'Approve an allowance', body: 'Set a spending cap. MoniBot can only move funds up to that limit. Revoke or top up any time.' },
  { icon: AtSign, title: 'Mention monibot in commands', body: 'On X reply or post payment commands by tagging @monibot. On Discord use !monibot or mention the bot . On Telegram mention @monipaybot . Plain English works.' },
];

export function WhatIsMoniBotModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-border/60 max-h-[88vh] flex flex-col">
        {/* Hero */}
        <div
          className="px-6 pt-6 pb-5 border-b border-black/10"
          style={{ background: 'linear-gradient(135deg, #FCFF52 0%, #E6FFB0 55%, hsl(154 91% 88%) 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-[#FCFF52]" />
            </div>
            <div className="min-w-0">
              <DialogHeader className="text-left space-y-0">
                <DialogTitle className="text-[15px] font-extrabold tracking-tight text-black">
                  What is MoniBot?
                </DialogTitle>
              </DialogHeader>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-black/65 mt-0.5">
                Autonomous Social Payments Agent
              </p>
            </div>
          </div>
          <p className="text-[12.5px] leading-relaxed text-black/80 mt-3">
            MoniBot is the AI agent that turns your social posts into real on-chain payments.
            Mention it on X, Discord, or Telegram and it sends stablecoins from your Minipay
            wallet to anyone, gas sponsored, no app switching.
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* How to use */}
          <section className="space-y-2.5">
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
              How to use
            </h4>
            <div className="space-y-2">
              {HOW_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} className="flex gap-3 rounded-2xl border border-border/60 bg-card/60 p-3">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--mp-primary)/0.12)] text-[hsl(var(--mp-primary))] flex items-center justify-center shrink-0 font-bold text-[11px]">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-[hsl(var(--mp-primary))]" />
                        {s.title}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                        {s.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Commands — per platform */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
              Commands
            </h4>
            {COMMAND_GROUPS.map((group) => (
              <div key={group.platform} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold tracking-tight text-foreground">{group.platform}</p>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {group.prefix}
                  </span>
                </div>
                <div className="rounded-2xl border border-border/60 overflow-hidden bg-card/60">
                  {group.items.map((c, i) => {
                    const Icon = c.icon;
                    return (
                      <div
                        key={c.label}
                        className={`flex items-center gap-3 px-3 py-2.5 ${i < group.items.length - 1 ? 'border-b border-border/50' : ''}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[hsl(var(--mp-primary)/0.12)] text-[hsl(var(--mp-primary))] flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold">{c.label}</p>
                          <p className="text-[10.5px] font-mono text-muted-foreground truncate">{c.cmd}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* MagicPay & CasualPay */}
          <section className="space-y-2.5">
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
              Payment modes
            </h4>
            <div className="rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/50">
              <div className="flex gap-3 p-3.5">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--mp-primary)/0.15)] text-[hsl(var(--mp-primary))] flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight">MagicPay</p>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                    Tip or pay anyone on X, Discord, or Telegram even if they do not have a
                    Minipay wallet yet. MoniBot holds the funds as a claimable IOU. The
                    recipient just opens Minipay, links the same social handle, and the
                    stablecoins drop into their wallet automatically.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3.5">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--mp-primary)/0.15)] text-[hsl(var(--mp-primary))] flex items-center justify-center shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight">CasualPay</p>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                    Plain-English payments inside threads and group chats. Say
                    "send alice five bucks" or "split $30 between bob and charlie" and
                    MoniBot parses, confirms, and executes on-chain. No forms, no
                    addresses, no app switching.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Roadmap */}
          <section className="space-y-2.5">
            <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-1.5">
              <Rocket className="w-3 h-3" />
              Roadmap
            </h4>
            <div className="rounded-2xl border border-[hsl(var(--mp-primary)/0.35)] bg-[hsl(var(--mp-primary)/0.06)] p-4 space-y-3">
              <div>
                <p className="text-[12.5px] font-semibold tracking-tight">Gated Access Manager</p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                  Monetize access to your community. Set a recurring fee in plain English and
                  MoniBot automatically gates entry to your Telegram group, Discord server, or
                  specific channels — handling renewals, expiry warnings, grace periods, kicks,
                  bans and on-chain receipts for you.
                </p>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold tracking-tight">Agent to agent payments</p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                  Other AI agents will be able to authenticate with MoniBot and autonomously use
                  every MoniPay feature you already use today. Pay, invoice, settle subscriptions,
                  run payouts, hold escrow, all through a single agent endpoint.
                </p>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold tracking-tight">Programmable allowances</p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                  Per-agent caps, per-recipient rules, scheduled releases, and revocable budgets.
                  Your keys, your limits, your audit trail.
                </p>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold tracking-tight">More chains, more rails</p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                  Base, BSC, Celo, Tempo and Solana today. More stablecoin networks rolling out as
                  the agent economy grows.
                </p>
              </div>
            </div>
          </section>

          <p className="text-[10.5px] text-center text-muted-foreground pt-1">
            Non-custodial. MoniBot can never move more than the allowance you approve.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}