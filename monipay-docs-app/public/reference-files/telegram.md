---
title: MoniBot — AI Agent for Social Crypto Payments
description: MoniBot is MoniPay's autonomous AI agent. Send stablecoins, run airdrops, and process payments via natural language on Twitter/X, Bluesky, Discord and Telegram.
keywords: monibot, ai crypto agent, twitter crypto payments, bluesky payments, discord airdrop bot, telegram payment bot, agentic commerce, social payments, magicpay
canonical: https://docs.monipay.xyz/monibot/
---

# MoniBot — agentic crypto payments

**MoniBot** is MoniPay's autonomous AI agent. It listens on Twitter/X, Bluesky, Discord and Telegram, parses natural-language payment commands, and executes them on-chain — gaslessly.

> "@monibot send $1 to @alice and @bob on base"
>
> → MoniBot resolves both MoniTags (or issues MagicPay claim links if they don't have a MoniPay account yet), executes the payment, replies with the explorer link.

## What MoniBot can do

- **P2P payments:** "send $5 to @alice"
- **Multi-recipient P2P:** "send $1 to @alice, @bob, @charlie"
- **Campaign airdrops:** drop $X to anyone who replies with a keyword
- **Smart Feedback:** AI-evaluated replies for quality-gated grants
- **Cross-chain routing:** "send on tempo" / "on bsc" / "on base"
- **Social identity linking:** OAuth-bind your X / Bluesky / Discord / Telegram to your MoniTag™

## Channels

- [Discord bot](/monibot/discord) — **the reference implementation**
- [Twitter / X bot](/monibot/twitter) — public, polled, gas-sponsored
- [Telegram bot](/monibot/telegram) — DM-based and group-friendly
- **Bluesky bot** — public AT Protocol replies, same parser surface as Twitter/X

## Sender-only linking + MagicPay for recipients

Only the **sender** needs to have linked the relevant social platform to their MoniTag™. Recipients do **not** need a MoniPay account — MoniPay's **MagicPay** innovation issues a secure, claimable receipt the recipient can redeem at any time. Funds are held safely until claimed; if unclaimed, they remain recoverable by the sender.

## Command parsing (evolving)

MoniBot's natural-language parser is advancing gradually:

- **Today:** regex-first matching, with Gemini 2.0-flash fallback for disambiguation. Standard forms work best (`send $5 to @alice`, `tip @bob $1 on base`).
- **Coming:** broader natural-language coverage and **multi-language support** (currently English-first).

If a command isn't recognised, MoniBot stays silent rather than guess. Re-phrase using a standard form and try again.

## Architecture

- **Worker bot:** polls each social platform, parses commands, executes via the on-chain router
- **Reply bot:** posts confirmations with explorer links and human-readable receipts
- **Executor wallet:** sponsors gas for social campaigns
- **AI:** regex first, Gemini 2.0-flash fallback for natural language disambiguation

## Read next

- [Tempo P2P keywords](/monibot/tempo-routing)
- [Multi-recipient parsing](/monibot/multi-recipient)
- [Social fee model](/monibot/fees)
