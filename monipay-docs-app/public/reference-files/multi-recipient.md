---
title: MoniBot Social Payment Fee Model
description: MoniBot uses a fee-on-top model. The recipient receives the full amount; the sender pays amount + 1% platform fee.
canonical: https://docs.monipay.xyz/monibot/fees
---

# MoniBot fee model

MoniBot social payments use a **fee-on-top** model:

- Sender types `$5` → contract debits `$5.05` from sender
- Recipient receives `$5.00`
- Platform takes `$0.05` (1%)
- Gas is **fully sponsored** by MoniPay's executor wallet

This differs from in-app sends, where the fee is split from a single transfer amount. The fee-on-top model exists so social receipts (replies, DMs) can confirm "you received $5" without fractional artifacts.
