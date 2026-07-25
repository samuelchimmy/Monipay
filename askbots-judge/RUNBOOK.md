# AskBots Judge — Ops Runbook

Celo "Agentic Payments & DeFAI" hackathon, **Track 3 (AskBots, $450 pool: 150/100/80/70/50)**.

We run **two independent judge agents**. They share no wallet, no creds, no voice —
each judges in its own domain. This is deliberate (two real Celo projects each
running a judge in its actual lane), NOT sybil puppets.

## The two agents

| | MoniBot | SpaceDrift |
|---|---|---|
| agentId | `kn78kmhv1vfpbx9vpphmtmbzys8apt8z` | `kn768s56wpe9nm8n7gc4e0sgys8ay78g` |
| payout wallet | `0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3` | `0xfa2B8eD012f756E22E780B772d604af4575d5fcf` |
| credentials | `~/.config/askbots/credentials.json` | `~/.config/askbots-spacedrift/credentials.json` |
| lane | payments · APIs · infra · agent-economics | on-chain games · MiniPay UX · retention · prize-pool economics |
| answer folder | `answers/monibot/` | `answers/spacedrift/` |

**Never** cross the lanes or reuse a wallet — same payout address across both is the
exact signal the judges scan for.

## Daily limits (the real constraint)

Each agent: **2 responses/day** at rating 0.5, <7-day account. Rises with account
age + rating (up to 10/day at 7–30 days if rating ≥0.7). Ratings come from builders
thumbs-upping responses → higher rating → more matches → higher cap. **Quality
compounds; spam gets thumbs-down and caps you at 1/day.** So: pick projects each
agent can genuinely judge, write substantive answers.

## Commands

```bash
cd askbots-judge
node judge.mjs --agent <monibot|spacedrift> status         # rating, daily limit
node judge.mjs --agent <...> list                          # matched projects
node judge.mjs --agent <...> show <projectId>              # full questions
node judge.mjs --agent <...> scaffold <projectId>          # writes answers/<agent>/<id>.json
#   → fill in every "answer" field (I review each one)
node judge.mjs --agent <...> submit <projectId>            # respond + auto-solve math + payout
node judge.mjs --agent <...> ratings                       # thumbs up/down history
```

The math challenge (anti-human, ~2000ms) is auto-solved in-script via BigInt with
correct operator precedence + parentheses. Solves in ~1ms; never the bottleneck.

## Log — 2026-07-21 (day 1)

MoniBot (payments lane):
- PayForAPI (`k17deez…`) — accepted, `shouldPay:true` ✅
- Zombie Plague (`k17cfvv…`) — accepted; payout hit a transient on-chain error, platform said "will be retried" ⚠️ (verify later)

SpaceDrift (games lane):
- Tycoon (`k171d3a…`) — paid on-chain ✅ tx `0x555a68930e03862052438624ff9d3add1b6d2a70d21fe972bd927cdd483a2311`
- GameArena (`k17cc9z…`) — paid on-chain ✅ tx `0x0177da23fef64b6e9271851e355c23e6afe9d72d18b8ede8f77de16f00de1815`

Both agents 2/2 for the day. Resets next UTC day.

## Tomorrow's candidate pool (unjudged, by lane)

MoniBot: Verity API / Verity Data (`api` type — structural review), OnFRA if it
reopens, Abapay-style payment apps, CANVASSING.
SpaceDrift: Chesscito, Zorrito, Chessxu, Gambit, PlayChessify, nerdos, Decimoon,
Kamshak/Chessxu — all pure-game/miniapp, judged on game UX + MiniPay fit.

Some projects show `status: completed` (budget filled) and can't be responded to —
`list` marks active 🟢 vs ⚪.
