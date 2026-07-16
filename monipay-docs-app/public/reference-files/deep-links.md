---
title: MoniPay Deep Link Specification — monipay:// URL Scheme for One-Tap Payments
description: The monipay:// URL scheme opens the installed MoniPay app pre-filled for one-tap payments. Full spec: parameters, fallback to universal link, per-chain handling, memo behavior on TIP-20.
keywords: monipay deep link, monipay url scheme, monipay://pay, universal links monipay, ios deep link monipay, android intent monipay, pay by qr deep link, monipay app link
canonical: https://docs.monipay.xyz/mobile/deep-links
---

# Deep links

MoniPay registers the `monipay://` URL scheme on iOS and Android. Triggering a `monipay://` URL on a device with MoniPay installed opens the app pre-filled and ready to confirm — one tap from intent to signed transaction.

## URL format

```
monipay://pay?to=@alice&amount=5&chain=base&memo=Coffee
```

## Parameters

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `to` | MoniTag (with or without leading `@`) | **yes** | Resolved to the recipient's address on the chosen chain. |
| `amount` | Decimal string | recommended | Denominated in the chain's stablecoin. Omit to let the user enter the amount. |
| `chain` | `base` \| `bsc` \| `solana` \| `tempo` \| `celo` \| `ink` | recommended | If omitted, MoniPay picks the user's default chain. |
| `memo` | URL-encoded string | optional | Forwarded as the TIP-20 on-chain memo on Tempo; stored off-chain as a payment reference on EVM chains. |
| `ref` | Short reference code | optional | Used by payment links (`pl_[code]`) to bind the deep link to a server-managed order. |

All values must be URL-encoded. Spaces become `%20`, the `@` in `to=@alice` is safe to leave un-encoded.

## Universal-link fallback

For devices without MoniPay installed, the equivalent universal link works in any browser:

```
https://monipay.xyz/pay?to=@alice&amount=5&chain=base&memo=Coffee
```

The hosted checkout renders the same payment intent and lets the recipient pay from any compatible wallet that supports the chain.

## QR code encoding

When generating a QR for in-person POS or invoices, MoniPay encodes the universal link, **not** the `monipay://` scheme. This way:

- Cameras that recognise URLs open it in a browser.
- iOS / Android intent handlers route `https://monipay.xyz/pay?...` to the installed MoniPay app when present.
- Other wallets can still parse the address and amount from the hosted checkout.

## Payment-link short codes

Server-managed payment links use the short form `monipay.xyz/pay/pl_[code]` (e.g. `pl_8x9k2m`). The short code resolves server-side to a full intent, so the URL stays copy-paste-safe and the server can revoke or rotate the link without changing the printed QR.

## Security considerations

- Deep links never carry secrets. The user still authenticates with their PIN inside the app before signing.
- The `to`, `amount`, `chain` and `memo` fields are user-visible in the confirmation screen — MoniPay never auto-confirms a deep-linked payment.
- Unknown or unexpected parameters are ignored, not silently passed through.

## Read next

- [PWA install](/mobile/pwa)
- [Payment links](/integrations/payment-links)
- [POS mode](/merchant/pos)
