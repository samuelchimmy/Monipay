---
title: MoniPay Deep Link Specification
description: MoniPay deep link scheme: monipay://pay?to=@user&amount=5&chain=base. Open the app pre-filled for one-tap payments.
canonical: https://docs.monipay.xyz/mobile/deep-links
---

# Deep links

The `monipay://` scheme triggers the installed MoniPay app on iOS and Android.

```
monipay://pay?to=@alice&amount=5&chain=base&memo=Coffee
```

Parameters:

- `to` — MoniTag (with or without `@`) **required**
- `amount` — decimal amount in the chain's stablecoin
- `chain` — `base` | `bsc` | `solana` | `tempo` | `celo`
- `memo` — optional reference string (Tempo passes this through TIP-20 memo)

Universal links (`https://monipay.xyz/pay?...`) fall back to the web app on devices without MoniPay installed.
