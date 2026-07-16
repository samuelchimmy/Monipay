---
title: MoniPay Payment Links API
description: Generate stablecoin payment links: monipay.xyz/pay?to=@you&amount=10&chain=base. Pre-filled checkout, callback URL, optional memo.
keywords: monipay payment links, stablecoin payment url, accept crypto via link, monipay api
canonical: https://docs.monipay.xyz/integrations/payment-links
---

# Payment links

Generate a one-shot or reusable payment URL. Anyone with the link can pay you.

```
https://monipay.xyz/pay?to=@you&amount=10&chain=base&memo=Order%20123&callback=https://yoursite.com/thanks
```

## Parameters

- `to` — MoniTag of the recipient
- `amount` — decimal amount
- `chain` — `base` | `bsc` | `solana` | `tempo` | `celo`
- `memo` — optional reference (forwarded to TIP-20 memo on Tempo)
- `callback` — URL to redirect after success (your site)
- `pl_[code]` — preset payment link code (server-managed)

## Behavior

- On mobile with the app installed → opens MoniPay via deep link
- On web → renders a hosted checkout modal
- On success → redirect to `callback` (with `?tx=0x...&status=paid`) and POST a [webhook](/integrations/webhooks)
