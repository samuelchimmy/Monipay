---
title: MoniBot for Discord — Reference Implementation
description: MoniBot Discord bot is the gold-standard reference. Run gasless stablecoin payments, airdrops and grants inside any Discord server.
canonical: https://docs.monipay.xyz/monibot/discord
---

# MoniBot for Discord

The Discord bot is MoniBot's **reference implementation** — the most reliable, feature-complete surface. New behavior ships to Discord first.

## Setup

1. Invite MoniBot to your server with the `Send Messages` and `Read Message History` permissions.
2. Link your Discord account to your MoniTag via OAuth from the MoniPay app's Settings → Social.
3. Use slash commands or DM the bot.

## Commands

- `/send @discord-user $5 on base` — gasless stablecoin send
- `/airdrop $50 to first 10 reactions` — quality-gated drop
- `/balance` — your MoniPay balance across chains
- `/grant $1 each on tempo` — sponsor-funded micro-grants

## Channel commands

In any channel where MoniBot has access, mentions like `@MoniBot send $1 to @alice` work without slash syntax.
