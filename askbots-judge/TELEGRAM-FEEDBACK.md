# AskBots — Telegram message to the team (2026-07-21)

Copy-paste into the AskBots hackathon Telegram. Evidence-backed: payout blocker +
two probed bugs + a feature suggestion (feedback endpoint).

---

Hi AskBots team 👋 — builder here from the Celo Agentic hackathon (Track 3).
Running the **MoniBot** judge agent. A few things from actually using the platform
today — one blocker, two small bugs, and a suggestion:

**1) 🔴 Payouts silently failing for one of my wallets (blocker)**
Two responses submitted, both accepted (`passed: true`, `shouldPay: true`) — but
**$0 has landed after 48h**. One `verify-challenge` even returned *"Response
accepted but on-chain payout failed. Payout will be retried."* — the retry never
arrived.
- Bot: **MoniBot** · agentId `kn78kmhv1vfpbx9vpphmtmbzys8apt8z`
- Payout wallet: `0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3`
- I checked on-chain: no incoming USDT/USDC/cUSD to that wallet at all.
- For contrast, a **different** agent of mine got paid instantly, same session,
  twice — so the pipeline works; it's specific to this wallet/escrow entry.
  Confirmed payouts:
  `0x555a68930e03862052438624ff9d3add1b6d2a70d21fe972bd927cdd483a2311`,
  `0x0177da23fef64b6e9271851e355c23e6afe9d72d18b8ede8f77de16f00de1815`.
Can you retry MoniBot's two pending payouts and check why they failed?

**2) 🐛 `verify-challenge` leaks internals on bad input**
POSTing an invalid `challengeId` returns **HTTP 500** with a raw
`ArgumentValidationError: ... Validator: v.id("pendingChallenges")` and a Request
ID, instead of a clean `400`. Minor, but it exposes the backend (Convex) and reads
as a crash.

**3) 🐛 Can't re-read my own reviewed projects**
`GET /projects/:id` returns `403 "Access denied"` once I've responded. Makes it
impossible to audit what I submitted. A read-only view of my own past responses
would help.

**4) 💡 Suggestion: add a feedback endpoint**
Right now there's **no API path for bots to report issues** — the whole platform is
API-first for autonomous agents, but the only way to flag a problem (like this
payout bug) is to find a human on Telegram. That doesn't scale and isn't
discoverable to an agent. Suggest a simple:
```
POST /api/feedback
{ "type": "bug|feature|payout", "message": "...", "refId": "<responseId/txHash>" }
```
so judge bots can file structured feedback the same way they do everything else.
Would also give you a clean signal channel instead of scattered DMs. Happy to be a
test user for it.

Thanks — genuinely like the model, just want the payouts flowing. 🙏

---

## Reference data (for you, not for the message)

Endpoint probe (2026-07-21), all documented routes:

| Endpoint | Method | Result |
|---|---|---|
| /auth/openclaw | POST | 200 (status check) |
| /bot-profiles | GET | 405 (POST-only) |
| /bot-profiles/me | GET | 200 |
| /bot-profiles/me/ratings | GET | 200 |
| /projects | GET | 200 |
| /projects/:id | GET | 403 "Access denied" after responding |
| /projects/:id/respond | POST | 400 "Project is not accepting responses" (closed project) |
| /projects/:id/verify-challenge | POST | 500 leaking Convex ArgumentValidationError on bad challengeId |

MoniBot pending (unpaid): PayForAPI `k17deez…`, Zombie Plague `k17cfvv…`.
SpaceDrift paid: Tycoon `k171d3a…`, GameArena `k17cc9z…`.
