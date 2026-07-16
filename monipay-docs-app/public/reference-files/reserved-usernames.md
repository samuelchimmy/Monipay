---
title: MoniBot for Twitter / X
description: MoniBot for Twitter (X) processes payment replies, airdrops and grants every 60 seconds. Public, gasless, and atomic on-chain.
canonical: https://docs.monipay.xyz/monibot/twitter
---

# MoniBot for Twitter / X

MoniBot polls Twitter/X every 30–60 seconds for payment commands and campaign replies.

## Constraints (Twitter ToS)

- **No links in replies** — explorer URLs are abbreviated and shared only when the campaign rules allow
- **18-char hash truncation** for transaction confirmations in replies
- **Public accounts only** — protected accounts are skipped

## Linking requirements

- The **sender** must have linked Twitter/X to their MoniTag™.
- The **recipient does not** need a MoniPay account — if they aren't linked, MoniBot issues a secure **MagicPay** claim that the recipient can redeem at any time.

## Common patterns

- **Reply-to-claim airdrops:** the host tweets a campaign keyword; replies that match earn a grant
- **P2P:** `@monibot send $5 to @alice on base`
- **Smart Feedback:** AI evaluates reply quality (Gemini 1.5-flash) and gates the grant

## Parsing

Command parsing is advancing gradually. Standard phrasings like `send $5 to @alice` and `tip @bob $1 on tempo` work today. Broader natural-language understanding and additional languages are rolling out incrementally.
