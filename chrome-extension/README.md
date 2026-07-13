# MoniPay Chrome Extension v2.0

A full-featured browser extension for gasless crypto payments on Base, BSC & Tempo. Includes account creation, wallet import, MoniBot AI allowance management, and merchant payment approval.

## Features

- **Create Account** — Choose a MoniTag, set a PIN, generate a wallet
- **Import Wallet** — Sign in with your existing MoniTag + PIN
- **Multi-Chain Dashboard** — View balances on Base (USDC), BSC (USDT), and Tempo (aUSD)
- **Send Payments** — P2P transfers to any @monitag, gasless via relay
- **Receive** — Share your MoniTag or wallet address
- **MoniBot AI** — View/update spending allowance, see linked social accounts
- **Merchant Payments** — Websites can trigger `window.monipay.requestPayment()` for seamless checkout
- **Settings** — Export encrypted key, lock wallet, disconnect

## Installation (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder

## Create Account Flow

1. Click **Create Account**
2. Choose your **MoniTag** (checked for availability)
3. Set a **4-digit PIN**
4. Select your mode: **Personal** or **Merchant**
5. **Backup your private key** — copy and save it securely
6. You're in! Dashboard shows your balance

## Import / Sign In Flow

1. Click **Import Existing Wallet**
2. Enter your **MoniTag** and **PIN**
3. The extension fetches your encrypted key from Supabase and verifies your PIN
4. You're in!

## MoniBot Features

- **Spending Allowance** — Set how much MoniBot can spend on your behalf via Twitter, Discord, and Telegram commands
- **Social Account Status** — See which accounts (X, Discord, Telegram) are linked
- **Usage Guide** — Quick reference for MoniBot commands on each platform

## Merchant Integration

Websites can trigger payments using the injected `window.monipay` API:

```javascript
window.addEventListener('monipay:ready', async () => {
  const result = await window.monipay.requestPayment({
    amount: 25.00,
    merchant: 'My Store',
    callbackUrl: 'https://mystore.com/success',
    metadata: { orderId: 'ORD-123' },
  });
  console.log('Payment TX:', result.txHash);
});
```

## Security

- Private keys encrypted with AES-256-GCM (PBKDF2 key derivation)
- PIN hashed with SHA-256 before storage
- Keys stored locally in `chrome.storage.local`
- Supports v1 (XOR+salt) and v2 (AES-GCM) encryption formats
- All relay communication uses HTTPS

## Icons

Place your icons in `chrome-extension/icons/`:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)
