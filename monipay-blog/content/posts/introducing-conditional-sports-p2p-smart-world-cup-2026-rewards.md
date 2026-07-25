---
title: "Introducing Conditional Sports P2P: Smart World Cup 2026 Rewards"
slug: "introducing-conditional-sports-p2p-smart-world-cup-2026-rewards"
description: "MoniBot introduces Conditional Sports P2P for World Cup 2026. Set automatic rewards for followers based on match results with zero escrow friction."
date: "2026-06-14"
tags: ["payments", "world-cup", "stablecoins", "monibot"]
featured: true
cover: "/images/conditional-sports-p2p.jpg"
ogImage: "/images/conditional-sports-p2p.jpg"
author: "Samuel Chiedozie"
---

## Introducing Conditional Sports P2P

The World Cup is in full swing and the noise online is deafening. Every timeline is filled with hot takes, match predictions, and friendly banter. People love asking their followers who they think will win. But until now, backing up those predictions with real rewards was a manual, trust-based headache. 

We wanted to make this interaction smooth, transparent, and completely automated. 

That is why we built Conditional Sports P2P for MoniBot. It lets you reward your community for correct match outcomes automatically, without locking up your funds in escrow or dealing with spreadsheets.

![Conditional Sports P2P Banner](/images/conditional-sports-p2p.jpg)

### How It Works

Instead of sending money to a third party or holding a pool of funds yourself, you simply post a tweet. 

You write a command directing [@monibot](https://twitter.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40jade%20if%20Germany%20wins%20Curacao%20%E2%9A%BD) to send a reward if a specific condition is met. 

The funds stay right in your wallet. MoniBot registers the job and starts monitoring the match. For a feature that moves money based on results, no single free source is good enough. You want a primary + fallback + sanity check, and only settle when ≥2 agree. This is why we designed a custom 3-Source Consensus Sports Oracle. Ten minutes after the final whistle blows, the oracle fetches data from `football-data.org` (primary), `API-Football` (fallback), and `openfootball` (sanity check). It requires a majority consensus from at least 2 independent feeds to settle the transaction. If there is a dispute or discrepancy in data, a safety lock automatically halts the payout, flagging the transaction for manual review.

If your team wins, the bot automatically executes the payment from your wallet to the recipient. If they lose or draw, the job is cancelled. No funds ever leave your account unless the match goes exactly the way you predicted.

Here is a real example of a Conditional Sports P2P transaction in action on X, showcasing the lifecycle from creation to automated payout:

[![Real example of Conditional Sports P2P resolution](/images/sports-p2p-payout-example.png)](https://x.com/WallstreetJade/status/2066144751217197147?s=20)

### Supported Conditions & Outcomes

The bot evaluates match outcomes strictly using settled API fixture data:
* **Win/Loss Conditions (Supported)**:
  * *Syntax:* `if Germany wins Curacao` or `if Germany beats Curacao`
  * *Resolves to:* `home_win` or `away_win` (determined by the predicted winner's role in the official match schedule).
* **Draw Conditions (Supported)**:
  * *Syntax:* `if Germany draws Curacao`, `if they tie`, or `if they end level`
  * *Resolves to:* `draw` (match ends with equal scores).
* **Correct Score / Exact Score (Supported)**:
  * *Syntax:* `if Germany beats Spain 2-1` or `if Germany Spain 2:1`
  * *Resolves to:* `exact_score` (requires the exact score line to match, e.g. `home_score === 2` and `away_score === 1`).

*Note: Over/Under goal bets (e.g. Over 2) and Both Teams to Score (BTTS) are **not** supported.*

### Example Command Scenarios
Here are some real-world command formats our AI agent supports:
* `"Hey @monibot send $10 to @jade if Germany wins Curacao ⚽"`
* `"Hey @monibot pay @alice $5 if Nigeria draws Canada"`
* `"Hey @monibot slide $15 to @bob if France beats England 2-1"`
* `"Hey @monibot give @charlie $2.50 if Argentina ties Peru"`

### Getting Started

You can test this out on the next match. 

To set up a reward, reply to any tweet using this syntax:

> [Hey @monibot send $10 to @jade if Germany wins Curacao](https://twitter.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40jade%20if%20Germany%20wins%20Curacao%20%E2%9A%BD)

You can try clicking that link to see the pre-filled tweet format. You can customize the amount, the recipient, and the teams to fit any upcoming World Cup match.

### No Wallet Required for Recipients

We integrated this feature directly with MagicPay. This means the person you are rewarding does not need to have a crypto wallet set up to receive the funds. MoniBot routes the reward directly to their Twitter username. 

The recipient receives a notification, and they can claim their funds at any time by connecting their wallet to MoniPay. It removes all the onboarding friction, making it easy to reward anyone in your community.

Put your predictions to the test and start rewarding your followers.
