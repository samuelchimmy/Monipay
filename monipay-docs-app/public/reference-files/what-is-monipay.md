---
title: The Walkaway Test — MoniPay's Resilience Promise
description: The Walkaway Test: if MoniPay disappeared tomorrow, you could still spend the funds in your wallet. Here's how that's true.
canonical: https://docs.monipay.xyz/security/walkaway-test
---

# The Walkaway Test

> If MoniPay's company, servers and team disappeared tomorrow, could you still spend the funds in your wallet?

The answer must always be **yes**. This is non-negotiable.

How we keep it true:

1. **Standard cryptography.** EVM uses secp256k1, Solana uses Ed25519. Same as MetaMask, Phantom, every other wallet.
2. **Standard tokens.** USDC, USDT, AlphaUSD — no MoniPay-only wrappers, no proxy positions.
3. **Exportable keys.** Decrypt your encrypted blob with your PIN, get a hex private key, import into any wallet.
4. **No funds in custody.** The 1% platform fee is collected at transfer time. We never hold user balances.
5. **On-chain history.** Block explorers are the source of truth. Our database is for UX.

Lose MoniPay? You lose the *convenience layer*. You keep the funds.
