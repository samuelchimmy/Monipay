# AskBots — follow-up TG message (payout fix request)

Send to the AskBots hackathon Telegram. Follow-up to the earlier payout report.
Context: MoniBot is now 0-for-3 on payouts; our other agent is 3-for-3. The API
has no way for us to change the payout address (PUT/PATCH 405, POST upsert 500)
or retry failed payouts — both need the team.

---

Follow-up on the MoniBot payout issue — it's now a clear, reproducible pattern:

**MoniBot judge agent is 0-for-3 on payouts.** Three accepted responses
(`shouldPay: true`), zero USDT received on-chain. Verified by decoding the wallet
receipts — nothing landed.

For contrast, a second judge agent I run settled **3-for-3 instantly** in the same
sessions (0.10 USDT + 0.01 fee each, confirmed on-chain). Same code path, same
escrow — so the failure is specific to MoniBot's payout wallet, not the platform.

- Failing bot: **MoniBot** · agentId `kn78kmhv1vfpbx9vpphmtmbzys8apt8z`
- Current payout wallet: `0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3`
  (note: this is a high-activity address already registered as a project's
  agentWalletAddress — I suspect your payout logic may be flagging/skipping it.)

**Two asks:**
1. **Please update MoniBot's payout address** to a clean wallet:
   `0xA430Bd6Ac5e2523690861C7b5FdF37642F6E089e`
   (fresh EOA, no other associations). The API has no update path for
   `celoAddress` — `PUT`/`PATCH /bot-profiles/me` return 405 and re-`POST` says
   "profile already exists" — so I can't change it myself.
2. **Please retry/settle the 3 failed MoniBot payouts** to that new address once
   updated. Response IDs on file:
   - Self.xyz review → responseId `k57102kdsv2tq6a7qs8011zdqx8b1k84`
   - (plus the two earlier failed ones — PayForAPI and Zombie Plague reviews)

Also, minor but related: `verify-challenge` returns a raw 500
`ArgumentValidationError` on a bad challengeId instead of a clean 400 — flagged
earlier, still there.

Thanks 🙏 — happy to verify on-chain once you push the retries.

---

## Internal notes (not for the message)

- New payout target chosen by builder: `0xA430Bd6Ac5e2523690861C7b5FdF37642F6E089e`
  (verified fresh EOA, nonce 0). Rejected an earlier candidate
  `0x52b2…ab8c0` — that one is SpaceDrift V1's on-chain owner, which would have
  cross-linked the two agents (breaks the firewall).
- API update attempts (all failed): PUT 405, PATCH 405, POST 500 "already exists".
- Past 3 failed payouts are NOT auto-recoverable by an address change — team must
  re-settle server-side.
- Confirmed-paid SpaceDrift txs (for their reference that the pipeline works):
  Tycoon 0x555a68…a2311 · GameArena 0x0177da…e1815 · Gambit 0x865a6d…068fc3
