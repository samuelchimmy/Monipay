---
title: MoniBot Social Payment Fee Model — Fee-on-Top for Clean Receipts
description: MoniBot uses a fee-on-top model for social payments. The recipient receives the full requested amount; the sender pays amount + 1% platform fee. Gas is fully sponsored by MoniPay's executor wallet across Base, BSC, Celo, Tempo and Solana.
keywords: monibot fees, fee on top model, social payment fees, gasless intent execution fees, crypto intent fees, monibot 1 percent fee, sponsored gas crypto, monipay platform fee, social receipt amount
canonical: https://docs.monipay.xyz/monibot/fees
---

# MoniBot fee model

MoniBot social payments use a **fee-on-top** model. This is intentionally different from MoniPay's in-app sends, and the reason matters: social receipts must read cleanly.

## How it works

- Sender types `$5` → the contract debits `$5.05` from the sender
- Recipient receives `$5.00` exactly
- Platform takes `$0.05` (1%)
- Gas is **fully sponsored** by MoniPay's executor wallet — sender pays zero gas regardless of chain

## Why fee-on-top, not fee-split

In-app MoniPay payments use a **split** model: a single `$5` payment becomes a `$4.95` transfer to the recipient and a `$0.05` transfer to the platform treasury. That works inside the app where the UI can show "you paid $5, recipient received $4.95" without ambiguity.

Social replies cannot afford that ambiguity. A public confirmation that reads "you received $4.95" when the sender said "send $5" looks broken on Twitter, Discord, and Telegram. The fee-on-top model exists so the reply, the on-chain log, and the recipient's notification all agree: **received = amount typed**.

## Worked examples

| Sender command | Debited from sender | Recipient receives | Platform fee | Gas paid by sender |
|----------------|---------------------|--------------------|--------------|--------------------|
| `send $5 to @alice` | $5.05 | $5.00 | $0.05 | $0.00 |
| `send $100 to @bob` | $101.00 | $100.00 | $1.00 | $0.00 |
| `airdrop $1 to 50 people` | $50.50 | $1.00 each | $0.50 total | $0.00 |
| `tip $0.25 to @carol` | $0.2525 | $0.2500 | $0.0025 | $0.00 |

## Gas sponsorship by chain

- **Base / BSC / Celo / Ink** — MoniBot's executor wallet holds the native gas token (ETH, BNB, CELO, ETH) and pays at submission time. The user signs an EIP-712 authorization off-chain; the executor submits.
- **Tempo** — fees are paid by a `feePayer` field on the native EIP-2718 type 0x76 transaction. No relayer trick required; the protocol supports sponsorship as a first-class primitive.
- **Solana** — the `feePayer` field of the transaction is set to MoniPay's sponsor wallet; the user is a signer on the transfer instruction only.

In every case the user holds **only** the stablecoin. They never need to acquire the chain's native gas token.

## Fee transparency

- The exact debit (`amount + 1%`) is always shown in the sender's MoniPay app receipt before confirmation.
- The 1% rate is fixed across chains and tokens for MoniBot social payments. It is not the same rate as MoniPay's merchant gateway, which may differ — see [merchant pricing](/merchant) for that surface.
- The platform treasury address is published per chain in [contract addresses](/contracts).

## Why 1%

1% is the rate that lets MoniBot:

- Sponsor gas on every supported chain without subsidy from outside revenue
- Fund the Smart Feedback AI evaluation (Gemini calls cost real money per reply)
- Keep the MoniBot executor wallets topped up under campaign-burst load
- Operate the fallback infrastructure (multi-RPC, retry queues, reply bot)

It is the smallest rate that makes the sponsored-gas model sustainable. It is not the cheapest per-transaction option on any individual chain, and it is not meant to be — paying gas in stablecoin terms always carries the operator's gas cost plus margin.

## Read next

- [MoniBot for Twitter](/monibot/twitter)
- [Multi-recipient payments](/monibot/multi-recipient)
- [Tempo routing](/monibot/tempo-routing)
