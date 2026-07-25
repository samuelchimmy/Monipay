---
title: "MagicPay is live: Tip & Pay anyone on X, Discord, or Telegram with no wallet required"
seoTitle: "MagicPay: Send Crypto to Anyone on X, Discord, Telegram"
seoDescription: "MoniBot's MagicPay lets you send, pay and tip stablecoins to anyone on X, Discord, or Telegram. No wallet needed. Funds held on-chain for 180 days."
datePublished: 2026-04-24T02:12:43.933Z
cuid: cmoc9zqc500041qia1ruaddte
slug: magicpay-is-live-tip-pay-anyone-on-x-discord-or-telegram-with-no-wallet-required
cover: https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/49287161-61c9-43fb-b14c-d62a44d62a19.png
ogImage: https://cdn.hashnode.com/uploads/og-images/6572eb4aa09b3311fdb7ba14/c5f6e98b-4d44-4881-888b-cc5da07aad57.png
tags: payments, monipay, x-tipping-bot, discord-tipping-bot, telegram-tipping-bot, discord-subscription-manager, telegram-subscription-manager, monibot-ai

---

# MagicPay is live: send stablecoins to anyone on X, Discord, or Telegram with no wallet required

Two days ago, a Discord user named @test17 received $838 USDT on Celo. They had no crypto wallet. They had no Monipay account. Someone typed a command in a Discord server and the money appeared, waiting.

That is MagicPay. And it is now live on Discord, X (Twitter), and Telegram.

## What actually happened

[![](https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/53a3d734-32eb-4405-bb4d-f9e97d2c56a6.png align="center")](https://monipay.xyz/monibot)

When someone sends a MagicPay payment through [MoniBot](https://monipay.xyz/monibot), it does not look up a wallet address. There is no address to look up. Instead, it resolves the recipient's permanent platform user ID: a stable numeric identifier that does not change when someone edits their display name or username.

That user ID gets hashed: `keccak256("discord:123456789")` produces a unique `bytes32` value called a `recipientId`. This string is what gets written to the blockchain. The funds are escrowed in Monipay's `IOURegistry` smart contract, locked to that identity. No wallet. No registration. Just a hash of a social account that only the real owner can prove they control.

The recipient gets a notification. They have 180 days to create a Monipay account, authenticate their social profile via OAuth, and claim their funds gaslessly. If they never do, the contract automatically refunds the sender after the window closes. No support ticket. No manual intervention. The contract enforces it.

The identity itself never appears on-chain in plaintext. A `bytes32` hash is one-way: anyone can verify that a given user ID maps to a given `recipientId`, but nobody can reverse-engineer the social identity from what is written on the ledger.

## The commands

[![Monibot tipping on X, Discord & Telegram](https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/9fb6a226-b38b-4fab-b13c-a667ee31ea74.png align="center")](https://monipay.xyz/monibot)

On Discord:

```plaintext
!monibot bless @gogorama with $5
```

On X (Twitter):

```plaintext
@monibot send $10 to @alice
```

On Telegram:

```plaintext
@monipaybot send $20 to @alice
```

That is the entire sender experience. One line on any of the three platforms. The recipient does not need to be present, registered, or aware of crypto at all.

You can start right now:

*   [Add MoniBot to your Discord server](https://discord.com/oauth2/authorize?client_id=1473815294022520964)
    
*   [Mention @monibot on X to send a payment](https://twitter.com/intent/tweet?text=%40monibot)
    
*   [Start MoniBot on Telegram](https://t.me/monipaybot?startgroup=new)
    

## Where it runs today

[![Monibot supports base, bsc, celo and solana](https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/0471d2d3-ae08-43fa-aba3-cf5350e9e1f5.png align="center")](https://monipay.xyz/monibot)

MagicPay launched across four chains simultaneously: Base, BSC, Celo, and Ink. The contract address differs per chain but the logic is identical, and the fee structure and 180-day expiry window are consistent across all of them.

All integration batches multiple transfers into a single claimable amount, so a recipient who received three separate payments sees one consolidated claim screen rather than three separate flows.

Solana support is coming next.

## Why these three platforms

Discord has a structural advantage for this kind of payment primitive. Its bot permission model is mature, its user ID system is stable and long-standing, and communities on Discord already have an established tipping and gifting culture through bots like MEE6 and tip.cc. MoniBot slots into that existing behaviour without asking users to change how they think about their server.

X reaches a different population: the crypto-adjacent audience that talks about stablecoins, follows founders, and participates in giveaway threads but has never set up a wallet. A reply-to-win campaign on X that actually sends real money on-chain, gaslessly, to anyone who quotes a tweet, is not possible with any other tool. With MagicPay it is a single MoniBot command.

Telegram completes the surface area. Crypto projects have run on Telegram for years. Group admins, DAO contributors, and community managers already coordinate payments through informal agreements. MagicPay turns those agreements into on-chain transfers without requiring group members to leave the app.

The Discord, X, and Telegram user bases share one important characteristic for MagicPay adoption: they contain large numbers of people who are curious about crypto but have not crossed the wallet-setup threshold. The friction of creating a wallet, funding it with native token for gas, and figuring out how to send a stablecoin is real. MagicPay removes that friction entirely for the recipient. The sender still needs a Monipay account, but the recipient needs nothing until they are ready to claim.

## The claim screen

[![Monibot Tip claiming](https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/82d88bdb-67c4-49cd-854a-8a2f731d50df.png align="center")](https://monipay.xyz/monibot)

The UI for claiming a MagicPay payment shows the chain, the amount, the token, the originating platform, and the expiry date. On Celo, the card uses the chain's signature yellow-green. On Ink, it uses a deep purple that matches the chain's own branding.

The claim button triggers the on-chain `batchClaim` through Monipay's vault, with gas sponsored so the recipient pays nothing.

A recipient who received three separate Discord payments on Ink sees a single aggregated claim: $6.75 USDT from 3 transfers. The contract handles the batching.

## What this is not

MagicPay is not a custodial service. Monipay never holds funds in a company wallet. The `IOURegistry` contract holds the escrow, and its code is public and verified on all supported chains. The vault key that triggers claims is a hot wallet that can only call `batchClaim` after verifying, at the edge function level, that the requesting wallet controls the social identity tied to the `recipientId`. Monipay cannot redirect funds. The contract does not allow it.

It is chain-agnostic in practice: the same payment command works regardless of which chain the sender's account is configured for, and the recipient claims on whatever chain the payment was settled on. The user never chooses a chain.

###   
What comes next

![Discord and Telegram onchain subscription manager](https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/27f699a0-475b-4ab0-b1e3-a90538fa1119.png align="center")

MagicPay is the first piece of a larger picture for how MoniBot manages money inside communities. The next feature in the pipeline is subscription management, and it is coming to both Discord and Telegram.

For Discord, the model works like this: a server admin sets a subscription fee, token, chain, and billing period directly inside their server. Members pay with a single command. MoniBot registers the subscription on-chain, assigns a verified subscriber role automatically, and handles the full lifecycle from there. It sends DM warnings seven days, three days, and twenty-four hours before a subscription expires. If a member does not renew, MoniBot revokes their role and, if the admin has configured it, removes them from the server after a grace period of one to seven days. Admins get a live dashboard showing active subscribers, total revenue, and an expiry calendar.

Telegram follows the same logic adapted for groups. The admin locks a subscription tier with a fee, token, and chain. Members type "subscribe" and MoniBot generates a payment link. Confirmation registers them on-chain instantly. Warnings arrive via bot DM. Expired members are removed automatically. Revenue reports are available to the admin on demand.

Both systems run entirely through MoniBot. No third-party subscription tool. No manual role management. No chasing members for payments. The contract handles enforcement so the admin does not have to.

If you run a paid Discord community, a DAO, or a Telegram group with a membership fee, this is the feature to watch. Follow [@monipay\_xyz](https://twitter.com/intent/tweet?text=%40monibot) on X for the launch announcement.

## Get started

[MoniBot](https://monipay.xyz/monibot) is available now on [Discord](https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=6829344014687335&integration_type=0&scope=bot), [X](https://twitter.com/intent/tweet?text=%40monibot), and [Telegram](https://t.me/monipaybot?startgroup=new). Add it to your server, follow it on X, or start it in your Telegram group. Fund your Monipay wallet with USDT on any supported chain and send your first payment.

The recipient can wait. The contract will not forget.

* * *

## Frequently asked questions

### What is Monipay?

[Monipay](https://monipay.xyz/) is a non-custodial stablecoin payment platform powered by AI, built on Base, BSC, Celo, Ink, and Solana. It lets users send and receive stablecoins gaslessly across multiple chains without paying gas fees. Monipay is built around MoniTag, a cross-chain identity layer, and MoniBot, an autonomous AI agent that processes payments through natural language commands on X, Discord, and Telegram.

### What is MoniBot?

[MoniBot](https://monipay.xyz/monibot) is Monipay's autonomous AI payment agent. It reads natural language commands on X (Twitter), Discord, and Telegram and executes on-chain stablecoin transfers without the sender or recipient needing to interact with a wallet interface. MoniBot handles peer-to-peer transfers, multi-send, campaign grants, scheduled payments, balance checks, and MagicPay escrow. It routes payments across five chains automatically. Learn more at [monipay.xyz/monibot](https://monipay.xyz/monibot).

### What is MagicPay?

MagicPay is a feature inside MoniBot that lets you send stablecoins to someone who has no crypto wallet and no Monipay account. The funds are locked in an on-chain escrow contract tied to the recipient's social identity on X, Discord, or Telegram. The recipient has 180 days to create a Monipay account, verify their social profile, and claim the funds gaslessly. If they never claim, the contract refunds the sender automatically.

### How does MagicPay work technically?

MoniBot resolves the recipient's permanent platform user ID and hashes it using `keccak256` to produce a `bytes32` value called a `recipientId`. This identifier is stored in Monipay's `IOURegistry` smart contract along with the escrowed funds. The social identity never appears on-chain in plaintext. When the recipient claims, they authenticate their social account via OAuth, and the contract verifies ownership before releasing funds.

### Do recipients need a crypto wallet to receive a MagicPay payment?

No. Recipients need no wallet, no Monipay account, and no knowledge of crypto to receive a MagicPay payment. They only need to create a Monipay account and link their social profile when they are ready to claim. The claim itself is gasless.

### Which blockchains does MagicPay support?

MagicPay currently runs on Base, BSC, Celo, and Ink. Solana support is coming next. The sender's chain is determined by their Monipay account configuration. The recipient claims on whatever chain the payment was settled on.

### Which platforms can I use to send a MagicPay payment?

MagicPay payments can be sent from Discord, X (Twitter), and Telegram using MoniBot commands. The recipient can be on any of these platforms regardless of which one the sender uses.

### How long does the recipient have to claim?

180 days from the time of the payment. After that window, the smart contract automatically refunds the sender. No support request is needed.

### Is MagicPay custodial?

No. Monipay never holds funds in a company-controlled wallet. The `IOURegistry` smart contract holds all escrowed funds. Monipay cannot redirect or confiscate them. The contract code is public and verified on Basescan.

### How do I add MoniBot to my Discord server?

Use this link to authorize MoniBot: [Add Monibot to your server](https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=6829344014687335&integration_type=0&scope=bot) . Once added, you can immediately start using MagicPay commands in any channel where MoniBot has permission.

### How do I use MoniBot on X (Twitter)?

Mention @monibot in a tweet with a payment command, for example: `@monibot send $5 to @alice`. You can also start from this link: [Tweet a command at @Monibot](http://twitter.com/intent/tweet?text=@monibot.)

### How do I start MoniBot on Telegram?

Add MoniBot to your group using this link: [Add monibot to your group](https://t.me/monipaybot?startgroup=new). You can also message the bot directly to send individual payments.

### What stablecoins does MagicPay support?

MagicPay supports USDT and USDC depending on the chain. Celo uses USDT. Base uses USDC and Ink uses USDT0. BSC uses USDT. Solana uses USDC. The token is determined automatically based on the sender's chain configuration.

### Does MagicPay charge fees?

Yes. MagicPay charges a 2% escrow fee at the time of sending. Gas fees for the claim are fully sponsored by Monipay, meaning the recipient pays nothing to receive their funds.

### Can I send MagicPay payments to multiple people at once?

Yes. MoniBot's multi-send feature lets you send to multiple recipients in a single command. Each recipient gets an individual escrow entry. On Ink, multiple payments to the same recipient are batched into a single claim.

### Does MoniBot support subscription payments?

Subscription management is coming soon for both Discord and Telegram. Server and group admins will be able to set a recurring fee, token, and billing period directly inside their community. MoniBot will handle payment collection, on-chain registration, role assignment, renewal warnings, and automatic removal of expired members. No third-party tools required.

### How will Discord subscriptions work with MoniBot?

The admin sets a subscription fee, token, chain, and duration inside the Discord server. Members pay with a single MoniBot command. MoniBot assigns a verified subscriber role on-chain instantly, sends DM reminders seven days, three days, and twenty-four hours before expiry, and revokes access after a configurable grace period if the member does not renew. Admins get a dashboard with active subscriber counts, total revenue, and an expiry calendar.

### How will Telegram subscriptions work with MoniBot?

The group admin locks a subscription tier with a fee, token, and chain. Members type "subscribe" and receive a payment link from MoniBot. Confirmation registers them on-chain. MoniBot sends private DM warnings before expiry and removes expired members automatically. Admins can request revenue reports from the bot at any time.

### What is a MoniTag?

MoniTag is Monipay's cross-chain identity layer. It assigns a username-style identifier to a user's wallet that works across Base, BSC, Celo, Ink, and Solana. MoniBot uses MoniTag to resolve payment destinations without requiring the sender to know the recipient's wallet address. You can create a MoniTag at [monipay.xyz](https://monipay.xyz).

### Is MoniBot really AI?

Yes. MoniBot uses large language model inference to parse natural language payment commands. You do not need to use a rigid command syntax. Phrases like "slide 10 bucks to jade" and "send $10 to @jade" are treated identically. The AI layer handles intent resolution before passing structured payment data to the on-chain execution layer.