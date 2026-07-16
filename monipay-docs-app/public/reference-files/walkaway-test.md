---
title: MoniPay FAQ
description: Frequently asked questions about MoniPay, MoniTag, MoniBot, gasless payments, supported chains, security and merchant features.
keywords: monipay faq, monipay help, monitag faq, monibot faq, magicpay
canonical: https://docs.monipay.xyz/reference/faq
---

# Frequently asked questions

### Is MoniPay free to use?

Yes for users. Gas is fully sponsored. The platform takes a flat **1% fee** on every payment, deducted atomically by the smart contract.

### Is MoniPay custodial?

No. Your private key is generated and encrypted on your device with your PIN. MoniPay never has access to your funds.

### What happens if I forget my PIN?

There is no PIN reset. Restore from your Google Drive backup or recovery phrase. Without either, the wallet is permanently inaccessible. This is true self-custody.

### Which chains does MoniPay support?

Base (USDC), BSC (USDT), Solana (USDC SPL), Tempo (AlphaUSD). Ink and Celo (MiniPay) integrations are live or in progress.

### Can I use MoniPay without a smartphone?

Yes. The web app at monipay.xyz works on any modern browser. The PWA installs to desktop too.

### How do MoniBot social payments work?

MoniBot polls Twitter/X, Bluesky, Discord and Telegram every 30–60 seconds, parses commands like `send $5 to @alice`, and executes them on-chain — gaslessly. Only the **sender** needs to have linked the relevant social platform to their MoniTag™. Recipients do **not** need a MoniPay account — MoniPay's **MagicPay** innovation issues a secure, claimable receipt the recipient can redeem at any time. Command parsing is advancing gradually and will soon cover broader natural language and additional languages. See [MoniBot docs](/monibot/).

### Does MoniPay have a token?

No. MoniPay does not have its own token and has no plans to issue one. The platform moves regulated stablecoins.

### How do I accept payments as a merchant?

Generate a [payment link](/integrations/payment-links), set up a [storefront](/merchant/storefront), or use the [Chrome extension SDK](/integrations/chrome-extension). All gasless, all non-custodial, with HMAC-signed [webhooks](/integrations/webhooks).

### Where can I get support?

Email [support@monipay.xyz](mailto:support@monipay.xyz) or visit the [support page](https://monipay.xyz/support). Security disclosures: security@monipay.xyz.
