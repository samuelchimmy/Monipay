# MoniPay Technical Documentation

## Complete Architecture, Security, and Implementation Guide

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Design](#3-architecture-design)
4. [Security Architecture](#4-security-architecture)
5. [Wallet & Cryptography](#5-wallet--cryptography)
6. [Payment Infrastructure](#6-payment-infrastructure)
7. [Database Design](#7-database-design)
8. [Edge Functions](#8-edge-functions)
9. [Frontend Components](#9-frontend-components)
10. [Mobile-First Design](#10-mobile-first-design)
11. [Payment Gateway](#11-payment-gateway)
12. [Design Philosophy](#12-design-philosophy)

---

## 1. Project Overview

### What is MoniPay?

MoniPay is a **non-custodial, gasless Point-of-Sale (POS) payment system** built on Base Chain. It enables merchants and users to send and receive USDC payments without paying gas fees, while maintaining full control over their private keys.

### Core Philosophy

```text
+-------------------------------------------+
|         "The Invisible Wallet"            |
|-------------------------------------------|
| Users never see blockchain complexity.    |
| No gas fees. No wallet extensions.        |
| Just PayTags, PINs, and instant payments. |
+-------------------------------------------+
```

### Key Features

- **Gasless Transactions**: Users sign, platform pays gas via meta-transactions
- **Non-Custodial**: Private keys stored locally, encrypted with user's PIN
- **Dual Persona**: Merchant POS mode and Personal wallet mode
- **Payment Gateway**: Stripe-like hosted checkout for online payments
- **Cross-Platform**: PWA with CapacitorJS for native mobile deployment

---

## 2. Technology Stack

### Frontend

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **React 18** | UI Framework | Component-based, large ecosystem |
| **TypeScript** | Type Safety | Catch errors at compile time |
| **Vite** | Build Tool | Fast HMR, optimized production builds |
| **TailwindCSS** | Styling | Utility-first, consistent design system |
| **Framer Motion** | Animations | Declarative, performant animations |
| **React Router** | Navigation | Client-side routing |
| **TanStack Query** | Server State | Caching, background updates |
| **Radix UI** | Components | Accessible, unstyled primitives |

### Blockchain

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Base Chain** | L2 Network | Low fees, Coinbase ecosystem |
| **USDC** | Currency | Stable, widely adopted |
| **viem** | Ethereum Library | Modern, type-safe, tree-shakeable |
| **wagmi** | React Hooks | Best-in-class wallet connection |
| **EIP-712** | Typed Signing | Human-readable transaction signing |
| **ERC-2771** | Meta-Transactions | Gasless transaction pattern |

### Backend

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Supabase** | BaaS Platform | Auth, Database, Edge Functions |
| **PostgreSQL** | Database | Relational, JSONB support |
| **Deno** | Edge Runtime | Secure, TypeScript-native |
| **RLS Policies** | Security | Row-level access control |

### Mobile

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **CapacitorJS** | Native Bridge | Single codebase, native APIs |
| **PWA** | Progressive Web App | Installable, offline capable |
| **WebAuthn** | Biometrics | Native Face ID/Touch ID |

---

## 3. Architecture Design

### System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├───────────────┬───────────────┬─────────────────────────────────┤
│  MoniPay PWA  │  Native App   │  Merchant Website               │
│  (React)      │  (Capacitor)  │  (API Integration)              │
└───────┬───────┴───────┬───────┴─────────────┬───────────────────┘
        │               │                     │
        ▼               ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTION LAYER                         │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│ check-paytag│relay-payment│  products   │   orders    │api-keys │
│ (Auth/Reg)  │ (Paymaster) │  (CRUD)     │  (Gateway)  │ (Dev)   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
├───────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ profiles  │  trans-  │ products │  orders  │ payment_ │ api_keys│
│           │ actions  │          │          │  links   │         │
└───────────┴────┬─────┴──────────┴──────────┴──────────┴─────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BASE CHAIN (L2)                             │
├─────────────────────────────────────────────────────────────────┤
│  USDC Contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913     │
│  Router Contract: 0x4048d18F71E723647f83B61202362425C5a7D2c0   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow - Payment Transaction

```text
1. User scans QR / enters PayTag
           │
           ▼
2. App signs EIP-712 message with local private key
           │
           ▼
3. Signature sent to relay-payment Edge Function
           │
           ▼
4. Edge Function validates:
   - Signature authenticity
   - USDC balance
   - Router allowance
   - Nonce not used
           │
           ▼
5. Relayer wallet submits tx to MoniPayRouter
           │
           ▼
6. Contract executes:
   - Transfer 99% to Merchant
   - Transfer 1% to Platform
           │
           ▼
7. Transaction recorded in Supabase
           │
           ▼
8. Both parties see instant confirmation
```

---

## 4. Security Architecture

### Gatekeeper Pattern

MoniPay uses a "Gatekeeper" pattern where **all data mutations go through Edge Functions** using the `SERVICE_ROLE_KEY`. Direct client-side access is denied via RLS.

```text
┌──────────────────────────────────────────────┐
│              GATEKEEPER PATTERN              │
├──────────────────────────────────────────────┤
│                                              │
│    Client ──────▶ Edge Function ──────▶ DB  │
│      │              │                   │   │
│      │              ▼                   │   │
│      │         Validates:               │   │
│      │         - Rate Limits            │   │
│      │         - HMAC Signature         │   │
│      │         - Business Logic         │   │
│      │              │                   │   │
│      ▼              ▼                   ▼   │
│   BLOCKED      SERVICE_ROLE_KEY      WRITE  │
│   by RLS       (Full Access)         DATA   │
│                                              │
└──────────────────────────────────────────────┘
```

### RLS Policies

All sensitive tables have restrictive RLS policies:

```sql
-- Example: profiles table
CREATE POLICY "Deny direct SELECT"
ON profiles FOR SELECT
USING (false);

CREATE POLICY "No direct INSERT"
ON profiles FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct UPDATE"
ON profiles FOR UPDATE
USING (false);
```

### HMAC Request Signing

Edge functions verify requests originate from trusted MoniPay clients:

```typescript
// Client-side: Generate signature
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = `${timestamp}.${JSON.stringify(body)}`;
const signature = await hmacSign(message, APP_SIGNING_SECRET);

// Server-side: Verify signature
const expectedSignature = await hmacSign(message, secret);
if (signature !== expectedSignature) {
  return unauthorizedResponse("Invalid signature");
}
```

### Rate Limiting

Protection against brute force and API abuse:

```typescript
const RATE_LIMITS = {
  relay: { windowMs: 60_000, maxRequests: 10 },      // 10 tx/min
  register: { windowMs: 600_000, maxRequests: 3 },   // 3 reg/10min
  check: { windowMs: 60_000, maxRequests: 30 },      // 30 checks/min
  general: { windowMs: 60_000, maxRequests: 100 },   // 100 reads/min
};
```

### PIN Lockout System

Escalating lockout for failed PIN attempts:

```typescript
const LOCKOUT_DURATIONS_MS = [
  60 * 1000,      // 1 minute after 5 failed attempts
  5 * 60 * 1000,  // 5 minutes on second lockout
  15 * 60 * 1000, // 15 minutes on third lockout
  60 * 60 * 1000, // 1 hour on fourth+ lockout
];
```

---

## 5. Wallet & Cryptography

### Private Key Generation

MoniPay generates a random Ethereum private key on signup:

```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export function generateWallet(): { privateKey: `0x${string}`; address: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}
```

### Encryption System (AES-GCM)

Private keys are encrypted with the user's PIN using **AES-256-GCM** with **PBKDF2** key derivation:

```typescript
// Constants
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

// Key derivation from PIN
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: ITERATIONS,  // 100,000 iterations
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encryption
async function encrypt(privateKey: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(pin, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(privateKey)
  );
  
  // Format: "v2:" + base64(salt + iv + ciphertext)
  const combined = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)]);
  return 'v2:' + btoa(String.fromCharCode(...combined));
}
```

### Encryption Format Versions

| Version | Algorithm | Storage |
|---------|-----------|---------|
| Legacy | XOR cipher | `base64(xor(key, pin))` |
| v1 | XOR + salt | `v1:base64(salt+iv+xor)` |
| v2 | AES-256-GCM | `v2:base64(salt+iv+ciphertext)` |

### PIN Hashing

PINs are hashed for secure storage using SHA-256 with a device-specific salt:

```typescript
export async function hashPin(pin: string): Promise<string> {
  const salt = getDeviceSalt(); // 32-byte random, persisted
  const data = new TextEncoder().encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Google Drive Backup

Cloud backup uses PIN-based AES-GCM encryption:

```typescript
// Encrypt for Google Drive
const { encryptedData, iv, salt } = await encryptForBackup(privateKey, pin);

// Upload to Drive's appDataFolder (hidden from user)
const backupContent = {
  encryptedData,
  iv,
  salt,
  timestamp: Date.now(),
  payTag: profile.payTag,
};

await uploadToGoogleDrive(backupContent);
```

---

## 6. Payment Infrastructure

### EIP-712 Typed Data Signing

Payments are authorized via EIP-712 signatures (human-readable):

```typescript
const DOMAIN = {
  name: 'MoniPay Router',
  version: '1',
  chainId: 8453, // Base Mainnet
  verifyingContract: '0x4048d18F71E723647f83B61202362425C5a7D2c0',
};

const PAYMENT_TYPES = {
  PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'fee', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

// Sign the payment
const signature = await account.signTypedData({
  domain: DOMAIN,
  types: { PaymentAuthorization: PAYMENT_TYPES.PaymentAuthorization },
  primaryType: 'PaymentAuthorization',
  message: {
    from: userAddress,
    to: merchantAddress,
    amount: parseUnits(amountUsdc.toString(), 6),
    fee: parseUnits(feeUsdc.toString(), 6),
    nonce: nextNonce,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  },
});
```

### Relay Payment Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    RELAY PAYMENT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. User signs EIP-712 message                                │
│      └─▶ "I authorize $10 to @coffee_shop"                     │
│                                                                 │
│   2. Signature sent to relay-payment Edge Function              │
│      └─▶ { action: 'relay', signature, message, ... }          │
│                                                                 │
│   3. Edge Function validates:                                   │
│      ├─▶ Rate limit check (10 tx/min)                          │
│      ├─▶ HMAC signature verification                           │
│      ├─▶ Nonce not already used                                │
│      ├─▶ User has sufficient USDC balance                      │
│      ├─▶ User has approved Router allowance                    │
│      └─▶ Deadline not expired                                  │
│                                                                 │
│   4. Relayer wallet submits to MoniPayRouter contract          │
│      └─▶ walletClient.writeContract(...)                       │
│                                                                 │
│   5. Contract splits funds:                                     │
│      ├─▶ 99% to Merchant                                       │
│      └─▶ 1% to Platform Treasury                               │
│                                                                 │
│   6. Wait for on-chain confirmation                            │
│      └─▶ publicClient.waitForTransactionReceipt(...)           │
│                                                                 │
│   7. Record transactions in Supabase                           │
│      ├─▶ Sender: type='sent', amount, fee                      │
│      └─▶ Receiver: type='received', amount, fee=0              │
│                                                                 │
│   8. Return success with txHash                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Contract Addresses

| Contract | Address | Purpose |
|----------|---------|---------|
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Stablecoin |
| **MoniPayRouter** | `0x4048d18F71E723647f83B61202362425C5a7D2c0` | Payment relay |
| **Platform Treasury** | `0x742d35Cc6634C0532925a3b844Bc9e7595f1d1E2` | Fee collection |

---

## 7. Database Design

### Core Tables

```text
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   profiles                    transactions                      │
│   ├── id (uuid, PK)          ├── id (uuid, PK)                 │
│   ├── pay_tag (unique)       ├── profile_id (FK)               │
│   ├── wallet_address         ├── type (sent/received)          │
│   ├── encrypted_private_key  ├── amount (numeric)              │
│   ├── preferred_mode         ├── fee (numeric)                 │
│   └── created_at             ├── counterparty                  │
│                              ├── tx_hash                        │
│   products                   ├── source (p2p/payment_link/...)  │
│   ├── id (uuid, PK)          ├── items (jsonb)                 │
│   ├── profile_id (FK)        └── created_at                    │
│   ├── name                                                      │
│   ├── price                   orders                            │
│   ├── icon                   ├── id (uuid, PK)                 │
│   ├── category               ├── order_ref (unique)            │
│   ├── pinned                 ├── merchant_profile_id (FK)      │
│   └── sort_order             ├── payment_link_id (FK)          │
│                              ├── amount / fee                   │
│   payment_links              ├── status (pending/completed)     │
│   ├── id (uuid, PK)          ├── tx_hash                       │
│   ├── profile_id (FK)        ├── callback_url                  │
│   ├── link_code (unique)     ├── webhook_url                   │
│   ├── name / amount          └── metadata (jsonb)              │
│   ├── usage_limit / count                                       │
│   └── expires_at              api_keys                          │
│                              ├── id (uuid, PK)                 │
│   invoices                   ├── profile_id (FK)               │
│   ├── id (uuid, PK)          ├── public_key (pk_live_...)      │
│   ├── sender_profile_id      ├── secret_key_hash               │
│   ├── recipient_pay_tag      ├── secret_key_preview            │
│   ├── amount / items         ├── webhook_url                   │
│   ├── status                 └── is_active                     │
│   └── expires_at                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Transaction Sources

The `source` column distinguishes transaction origins:

| Source | Description |
|--------|-------------|
| `p2p` | Direct person-to-person transfer |
| `payment_link` | Via shareable payment link |
| `online_order` | Via payment gateway API |
| `invoice` | Via invoice payment |
| `external` | From external wallet deposit |
| `withdrawal` | Outbound to external wallet |

---

## 8. Edge Functions

### Overview

| Function | Purpose | Key Actions |
|----------|---------|-------------|
| `check-paytag` | Authentication & Registration | check, register, lookup, import |
| `relay-payment` | Payment Execution | relay, checkApproval, getNonce, history |
| `products` | Product Catalog | list, create, update, delete, reorder |
| `invoices` | Invoice Management | create, list, pay, cancel |
| `orders` | Gateway Orders | create, get, list, complete |
| `api-keys` | Developer Keys | generate, list, revoke, updateWebhook |
| `payment-links` | Payment Links | create, list, get, update, deactivate |
| `activation-funder` | ETH Funding | Fund new wallets with gas for approval |
| `customers` | CRM | list, upsert, update stats |
| `support` | Help Tickets | create, list, addMessage |
| `feedback` | User Feedback | submit, history |

### Common Pattern

All edge functions follow this structure:

```typescript
Deno.serve(async (req) => {
  // 1. CORS handling
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Rate limiting
  const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  // 3. HMAC signature verification (for mutations)
  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    return unauthorizedResponse(signatureResult.error);
  }

  // 4. Supabase client with SERVICE_ROLE_KEY
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 5. Action routing
  const { action } = await req.json();
  
  switch (action) {
    case 'create': return handleCreate(...);
    case 'list': return handleList(...);
    case 'update': return handleUpdate(...);
    default: return errorResponse('Invalid action');
  }
});
```

---

## 9. Frontend Components

### Component Hierarchy

```text
App.tsx
├── ThemeProvider (next-themes)
├── QueryClientProvider (TanStack Query)
├── WagmiWrapper (Wallet Connection)
├── TooltipProvider (Radix)
└── BrowserRouter
    ├── Index.tsx
    │   ├── LockScreen (PIN entry)
    │   ├── Onboarding (New user flow)
    │   └── Dashboard
    │       ├── MerchantDashboard
    │       │   ├── QuickAdd Grid
    │       │   ├── Numeric Keypad
    │       │   ├── Cart Display
    │       │   ├── Recent Sales
    │       │   ├── ProductCatalog (Modal)
    │       │   ├── MerchantAnalytics (Modal)
    │       │   └── ScanToPay QR (Modal)
    │       └── UserDashboard
    │           ├── Balance Display
    │           ├── Action Buttons (Pay, Send, Receive)
    │           ├── QRScanner (Modal)
    │           ├── SendModal (PayTag input)
    │           ├── ReceiveModal (QR display)
    │           └── FundWalletModal
    ├── Pay.tsx (Hosted Checkout)
    ├── Settings.tsx
    │   ├── DeveloperSettings
    │   ├── SecurityGate
    │   └── GoogleDriveBackup
    └── Static Pages (About, Terms, Privacy)
```

### State Management

MoniPay uses **React Context** for global state:

```typescript
interface PayTagContextType {
  // App State
  currentScreen: AppScreen;  // 'lock' | 'onboarding' | 'dashboard'
  mode: AppMode;             // 'merchant' | 'user'
  isUnlocked: boolean;
  
  // User Profile
  profile: UserProfile | null;
  
  // Wallet
  decryptedPrivateKey: `0x${string}` | null;
  generatedPrivateKey: string | null;  // For backup display
  
  // Transactions
  transactions: Transaction[];
  syncTransactions: () => Promise<void>;
  
  // Actions
  verifyPin: (pin: string) => boolean;
  createProfile: (payTag: string, pin: string, mode: AppMode) => Promise<boolean>;
  importWallet: (privateKey: string, pin: string) => Promise<{ success: boolean }>;
  refreshBalance: () => Promise<void>;
}
```

---

## 10. Mobile-First Design

### CapacitorJS Integration

```typescript
// Platform detection
import { Capacitor } from '@capacitor/core';

export function usePlatform() {
  const platform = Capacitor.getPlatform();
  return {
    isNative: platform !== 'web',
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
  };
}
```

### Safe Area Support

```css
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}

.app-container {
  padding-top: var(--safe-area-top);
  padding-bottom: var(--safe-area-bottom);
}
```

### Hardware Back Button

```typescript
import { App as CapacitorApp } from '@capacitor/app';

useEffect(() => {
  const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (hasOpenModal) {
      closeModal();
    } else if (canGoBack) {
      window.history.back();
    } else {
      CapacitorApp.minimizeApp();
    }
  });
  
  return () => { listener.remove(); };
}, [hasOpenModal]);
```

### Status Bar Theming

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

async function updateStatusBar(mode: 'merchant' | 'user') {
  const backgroundColor = mode === 'merchant' ? '#0052FF' : '#000000';
  
  await StatusBar.setBackgroundColor({ color: backgroundColor });
  await StatusBar.setStyle({ style: Style.Dark }); // White icons
}
```

---

## 11. Payment Gateway

### API Key Generation

```typescript
function generateApiKeys() {
  const publicKey = `pk_live_${generateRandomString(24)}`;
  const secretKey = `sk_live_${generateRandomString(32)}`;
  
  // Hash secret key for storage (SHA-256)
  const secretKeyHash = await sha256(secretKey);
  const secretKeyPreview = `sk_live_...${secretKey.slice(-4)}`;
  
  return { publicKey, secretKey, secretKeyHash, secretKeyPreview };
}
```

### Hosted Checkout Flow

```text
1. Merchant creates Payment Link or Order
   └─▶ Returns: monipay.xyz/pay/pl_abc123

2. Customer visits URL
   └─▶ Pay.tsx loads order/link details

3. Customer selects payment method:
   ├─▶ Scan with MoniPay App (QR)
   ├─▶ Pay with PayTag (login + PIN)
   └─▶ Connect External Wallet (WalletConnect)

4. Payment processed via relay-payment

5. Order marked complete
   ├─▶ Webhook sent to merchant
   └─▶ Customer redirected to callback_url
```

### Webhook Security

```typescript
// Generate HMAC signature for webhook
async function sendWebhook(webhookUrl: string, order: Order, secretKey: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify({
    event: 'payment.completed',
    order: { id, amount, status, tx_hash, ... },
    timestamp,
  });

  const signature = await hmacSign(`${timestamp}.${payload}`, secretKey);

  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MoniPay-Signature': signature,
      'X-MoniPay-Timestamp': timestamp,
    },
    body: payload,
  });
}
```

---

## 12. Design Philosophy

### Visual Design

| Element | Value | Rationale |
|---------|-------|-----------|
| **Primary Color** | `#0052FF` (Base Blue) | Brand alignment with Base chain |
| **Text Colors** | Black / White | High contrast, professional |
| **Border Radius** | 12-16px | Modern, friendly |
| **Shadows** | Minimal | Clean, flat design |
| **Icons** | Lucide React | Consistent, lightweight |

### Layout Principles

```text
MOBILE-FIRST LAYOUT
├── Single column on mobile
├── 3-column grid on desktop
│   ├── Left: Keypad + Quick Add
│   ├── Center: Recent Sales
│   └── Right: Cart
└── Bottom navigation for primary actions
```

### Animation Philosophy

- **Micro-interactions**: Haptic feedback on tap/success/error
- **Transitions**: Smooth 200-300ms with ease curves
- **Modals**: Scale + fade entrance, slide exit
- **Loading**: Subtle skeleton states, not spinners

### Accessibility

- Semantic HTML elements
- Keyboard navigation support
- Screen reader labels
- Sufficient color contrast (WCAG AA)
- Focus indicators on interactive elements

---

## Appendix: Environment Variables

### Frontend (.env)

```env
# Publishable (safe for frontend)
VITE_SUPABASE_URL=https://vdaeojxonqmzejwiioaq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Edge Functions (Supabase Secrets)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access to bypass RLS |
| `RELAYER_PRIVATE_KEY` | Wallet that pays gas fees |
| `APP_SIGNING_SECRET` | HMAC request verification |
| `ACTIVATION_FUNDER_PRIVATE_KEY` | Funds new wallets with ETH |
| `LIFI_API_KEY` | Cross-chain bridge integration |

---

## Summary

MoniPay is built on three core principles:

1. **Non-Custodial Security**: Users control their private keys, encrypted locally with AES-256-GCM

2. **Gasless UX**: Meta-transactions abstract blockchain complexity - users never see gas fees

3. **Gateway Architecture**: Full payment infrastructure enabling online commerce like Stripe/Paystack

The technology choices prioritize **type safety** (TypeScript everywhere), **performance** (Vite, tree-shaking), **security** (RLS, HMAC, rate limiting), and **mobile-first** design (Capacitor, safe areas, PWA).
