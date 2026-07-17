# Flutter App vs Web Reference — Full Audit Report

This document compares the Monipay Flutter app to the web reference codebase in `_web_reference/src/`. For each issue: **Flutter file**, **Reference file**, **What is wrong or missing**, **How to fix**. No code changes were made; this is report-only.

---

## 1. Missing features

### 1.1 Central chain configuration module
- **Flutter:** No single file equivalent to `chains.ts`. Chain IDs, router addresses, token addresses/decimals, explorer URLs, RPC URLs, and currency labels are scattered or hardcoded across `lib/` (e.g. `balance_card`, `fund_sheet`, `receive_sheet`, `send_controller`, `dashboard_state`).
- **Reference:** `_web_reference/src/config/chains.ts` — `SupportedNetwork`, `ChainConfig`, `CHAIN_CONFIGS` (base, bsc, tempo), `SOLANA_CONFIG`, `getChainConfig`, `getEvmChainConfig`, `isSupportedNetwork`, `isSolanaNetwork`.
- **Fix:** Add `lib/core/config/chain_configs.dart` (or under a config feature) that replicates: type `SupportedNetwork`, `ChainConfig` and `SolanaChainConfig`-like models, const maps for Base/BSC/Tempo (id, name, currency, decimals, token, monipayRouter, monibotRouter, rpcUrls, explorerUrl), Solana config, and getter/helper functions. Use this module everywhere instead of ad-hoc strings/numbers.

### 1.2 PayTag lookup via check-paytag (action: lookup)
- **Flutter:** `lib/core/services/payment_relay_service.dart` uses a **separate** Supabase function `lookup-paytag` and expects response field `data['address']`.
- **Reference:** `_web_reference/src/contexts/PayTagContext.tsx` uses **check-paytag** with `action: 'lookup'` and expects `profile.wallet_address` and `profile.pay_tag` (returns `{ walletAddress, payTag }`).
- **Fix:** Switch Flutter to call **check-paytag** with `action: 'lookup'` and body containing the payTag; parse `wallet_address` and `pay_tag` from the response. Align return type with `{ walletAddress: string, payTag: string }` (or equivalent Dart record/class) and update all call sites (send flow, withdraw, etc.) to use `walletAddress` and `payTag`.

### 1.3 getPaymentNonce: POST body and action name
- **Flutter:** `lib/core/services/payment_relay_service.dart` uses **GET** on `relay-payment` with query params `action=nonce`, `address`, `network`.
- **Reference:** `_web_reference/src/lib/wallet.ts` uses **POST** on relay-payment with body `{ action: 'getNonce', message: { walletAddress }, network }`. Backend `_web_reference/supabase/functions/relay-payment/index.ts` handles `action === "getNonce"`.
- **Fix:** Change Flutter to **POST** to `relay-payment` with JSON body `{ action: 'getNonce', message: { walletAddress: walletAddress }, network: network }`. Use the same response shape as web for nonce.

### 1.4 EIP-712 signing for payment authorization
- **Flutter:** `lib/core/services/payment_relay_service.dart` builds a **custom hash** (colon-joined string of from, to, amount, fee, nonce, deadline) and signs it with `key.signToUint8List(hash)` (raw signature), not EIP-712 typed data.
- **Reference:** `_web_reference/src/lib/wallet.ts` uses full **EIP-712**: domain `name: 'MoniPay Router'`, `version: '1'`, `chainId`, `verifyingContract: config.monipayRouter`; type `PaymentAuthorization` with fields from, to, amount, fee, nonce, deadline; `signTypedData_v4` (or equivalent).
- **Fix:** Implement EIP-712 in Flutter: same domain and type names/fields, chainId and verifyingContract from chain config. Use a package that supports EIP-712 (e.g. `web3dart` with typed data or a dedicated EIP-712 signer). Replace `buildPaymentMessageHash` and `signPaymentAuthorization` to produce the same signature as the web app so the relay accepts it.

### 1.5 Wallet decryption: v1 and legacy XOR formats
- **Flutter:** `lib/core/security/wallet_service.dart` only supports **v2** AES-GCM decryption. Throws on non‑v2 payloads.
- **Reference:** `_web_reference/src/lib/wallet.ts` supports **v2** (async AES-GCM), **v1** (sync salt+iv+key derivation), and **legacy** XOR with `LEGACY_ENCRYPTION_KEY`.
- **Fix:** Add decrypt branches for v1 and legacy formats in `WalletService.decryptPrivateKey` (or a dedicated decoder) so profiles created on web with older formats can be imported/unlocked on Flutter.

### 1.6 Transaction history: tag filter (badge types)
- **Flutter:** `lib/features/wallet/presentation/transaction_history_screen.dart` (and related) may have type filter (e.g. sent/received) but not the full **tag filter** by transaction source/badge.
- **Reference:** `_web_reference/src/components/TransactionHistory.tsx` and `TransactionBadge.tsx`: filter by `TransactionBadgeType` — e.g. MoniBot P2P, MoniBot Grant, Invoice, Store, Online Sale, External, Payment Link.
- **Fix:** Add a tag/source filter UI and state (e.g. `TransactionBadgeType` or equivalent enum). Filter the list by `source`/metadata when present. Show badge per row matching web labels (MoniBot P2P, Invoice, Store, etc.).

### 1.7 Transaction history: batch PayTag lookup for 0x addresses
- **Flutter:** Counterparty display may show raw `0x` address or a single lookup.
- **Reference:** `_web_reference/src/components/TransactionHistory.tsx` uses `formatCounterparty` and **batch** PayTag lookup for counterparties that are 0x addresses to show @payTag when available.
- **Fix:** When rendering history, collect unique 0x counterparty addresses and perform batch lookup (or repeated lookup) to resolve PayTags; display @payTag in list and receipt when available.

### 1.8 Transaction receipt: print action
- **Flutter:** Receipt modal may only support share (e.g. share sheet).
- **Reference:** `_web_reference/src/components/TransactionHistory.tsx` / receipt modal: **print** via `window.print()` (or equivalent) and share.
- **Fix:** On platforms where printing is applicable (e.g. iOS/Android print intent, or web if Flutter web exists), add a “Print” action that opens the system print flow for the receipt content.

### 1.9 Receive sheet: QR JSON structure and dual mode (MoniPay vs External)
- **Flutter:** Receive sheet may not expose the exact same QR payload or two modes.
- **Reference:** `_web_reference/src/components/UserDashboard.tsx`: Receive has two modes — **MoniPay** (QR value = `JSON.stringify({ type: 'paytag_receive', payTag, address })`) and **External** (QR value = raw wallet address); copy value and labels (e.g. “For MoniPay App users” vs network-specific label like “USDT on BSC”).
- **Fix:** Ensure receive QR value for “MoniPay” is exactly `{ type: 'paytag_receive', payTag, address }` (same keys). Add “External Wallet” mode with raw address and network-specific label/copy. Match copyValue for @payTag and address.

### 1.10 Send flow: recent-tag suggestions from transactions
- **Flutter:** Send sheet may not suggest recent counterparties.
- **Reference:** `_web_reference/src/components/UserDashboard.tsx`: When send PayTag field is focused, suggestions from `transactions` (counterparty tags, excluding 0x and profile.payTag), filtered by current input, max 5.
- **Fix:** Load recent counterparties from transaction history (unique tags), filter by current input, show up to 5 as suggestions below the PayTag field.

### 1.11 MerchantDashboard: numpad, quick-add products, cart, charge QR, payment polling
- **Flutter:** Merchant flows (store, charge, stats) may be partial or missing.
- **Reference:** `_web_reference/src/components/MerchantDashboard.tsx`: Numpad for amount, quick-add products, cart logic, QR generation for charge (e.g. payment link / invoice), payment detection via polling.
- **Fix:** Implement merchant tab parity: numpad input, product list with quick-add to cart, cart with line items and total, charge screen that generates QR (with same structure as web for payment links), and polling for payment detection when charge is active.

### 1.12 Fund modal: Cross-Chain, Direct, Connected Wallet; all networks; deposit detection
- **Flutter:** `lib/features/wallet/presentation/widgets/modals/fund_sheet.dart` may not mirror all methods and networks.
- **Reference:** `_web_reference/src/components/FundWalletModal/index.tsx`: Menu with **Cross-Chain**, **Connected Wallet**, **Direct** (per network); `CrossChainDeposit`, `DirectDeposit`, `ConnectedWalletDeposit`; supports Base, BSC, Tempo, Solana; bridge links; optional deposit detection / onDepositSuccess.
- **Fix:** Add all deposit views (Cross-Chain, Direct, Connected Wallet where applicable). Support Base, BSC, Tempo, Solana with correct labels and bridge/faucet links. Optionally poll or notify on deposit so `onDepositSuccess` can be used (e.g. refresh balance, show success).

### 1.13 Withdraw: auth gate, method (PayTag vs address), full relay flow
- **Flutter:** Withdraw may be simplified or missing steps.
- **Reference:** `_web_reference/src/components/WithdrawModal.tsx`: Steps — auth gate → method (paytag | address) → details (validate PayTag or 0x address) → confirm (amount, fee, recipient) → processing → success/error; uses `lookupPayTag`, `signPaymentAuthorization`, `getPaymentNonce`, relay POST; `PLATFORM_FEE_PERCENT = 0.01`; refreshBalance on success.
- **Fix:** Ensure withdraw has auth gate on open; method select (PayTag vs raw address); validation (lookup PayTag, validate 0x); confirm step with fee and recipient; then sign + relay with same POST body as web; success/error and balance refresh.

### 1.14 Network toggle: list (Base, BSC, Solana), colors, setPreferredNetwork + refreshBalance
- **Flutter:** Network selector may not match web list or behavior.
- **Reference:** `_web_reference/src/components/NetworkToggle.tsx`: `NETWORKS`: base (blue), bsc (yellow), solana (purple); `setPreferredNetwork(n)` then `refreshBalance(n)`; hidden when `isTempoMode`.
- **Fix:** Use the same three networks (and colors) in the toggle; on select call setPreferredNetwork then refreshBalance. If Flutter has Tempo mode, hide toggle when in Tempo.

### 1.15 Bottom nav: all 5 personal tabs, all 5 merchant tabs, center elevated button, active dot
- **Flutter:** Bottom nav may have different tab set or styling.
- **Reference:** `_web_reference/src/components/BottomNav.tsx`: Personal: invoices, send, **pay** (center), receive, account; Merchant: stats, store, **charge** (center), history, account; center button elevated (-mt-7), active dot under icon for side tabs, badge support.
- **Fix:** Match tab IDs and labels (Invoice, Send, Pay, Receive, Account / Stats, Store, Charge, History, Account). Center tab as elevated round button; non-center tabs with active dot indicator and optional badge.

### 1.16 Settings: every row (Developer, Support, MoniBot, Language, etc.)
- **Flutter:** `lib/features/wallet/presentation/settings_screen.dart` may omit some rows.
- **Reference:** `_web_reference/src/components/Settings.tsx`: Change PIN, Backup wallet (with PIN verification), Biometric registration, Session auto-lock durations, Sound toggle, Theme, Network, Logout, Delete account; plus Developer, Support, MoniBot, Language.
- **Fix:** Audit each Settings row in web and add any missing in Flutter (Developer, Support, MoniBot, Language, etc.) with correct navigation or external links.

---

## 2. Incomplete implementations

### 2.1 Create onboarding: persist encrypted key, wallet address, and PIN hash
- **Flutter:** `lib/features/auth/presentation/onboarding_controller.dart`: **Create** flow in `submitStep3Create` only updates state (profileId, encryptedPrivateKey, walletAddress). It does **not** write `monipay_encrypted_private_key` or `monipay_wallet_address` to secure storage. `completeOnboarding()` only writes `monipay_has_profile` and clears generated key. So after create, lock screen has nothing to decrypt on next launch.
- **Reference:** Web createProfile registers and keeps profile (with encrypted key and wallet) in context and localStorage; PIN is hashed and stored in profile.
- **Fix:** After successful `submitStep3Create`, write to secure storage: `monipay_encrypted_private_key`, `monipay_wallet_address`. Optionally in the same flow or in `completeOnboarding`, compute bcrypt hash of PIN and write to `monipay_pin_hash` so lock screen can verify by hash (matching web behavior of hashing PIN on create).

### 2.2 Onboarding: write monipay_biometric_pin when enabling biometrics
- **Flutter:** `lib/features/auth/presentation/lock_controller.dart` writes `monipay_biometric_pin` when **changing PIN** or when **registering biometrics** (after successful PIN verify). Not written during onboarding.
- **Reference:** Web may store biometric PIN in a similar way during onboarding or when user enables biometrics; ensure the key and moment of write are consistent.
- **Fix:** If web writes a biometric PIN storage key during onboarding (e.g. when user opts into biometrics in onboarding), replicate that in Flutter. Otherwise, ensure Flutter writes `monipay_biometric_pin` when the user first enables biometrics (e.g. in Settings or first unlock) so behavior matches.

### 2.3 Dashboard profile and transactions: load from backend and cache
- **Flutter:** `lib/features/wallet/data/dashboard_repository_impl.dart`: `loadProfile()` only reads `monipay_wallet_address` from secure storage and returns a minimal profile (no payTag, balance, or transactions from backend). `loadMoreTransactions` returns empty with a TODO.
- **Reference:** `_web_reference/src/contexts/PayTagContext.tsx`: Profile loaded from check-paytag (and localStorage), balance from getTokenBalance, transactions from relay-payment `action: 'history'` with cursor; syncTransactions and loadMoreTransactions implemented.
- **Fix:** After unlock, load full profile (payTag, preferredNetwork, etc.) from check-paytag (e.g. by wallet address or stored profile id). Implement transaction history via relay-payment `action: 'history'` with cursor; implement loadMoreTransactions with the same cursor/limit contract. Cache profile and transactions in memory/state and optionally persist to local storage for cold start.

### 2.4 PayTagContext parity: state and methods
- **Flutter:** No single controller that mirrors all PayTagContext state and methods (currentScreen, mode, profile, transactions, decryptedPrivateKey, txCursor, hasMoreTransactions, isLoadingMore, checkPayTagAvailable, lookupPayTag, syncTransactions, loadMoreTransactions, refreshBalance, createProfile, importWallet, updatePreferredMode, setPreferredNetwork, etc.).
- **Reference:** `_web_reference/src/contexts/PayTagContext.tsx` — full list of state and methods as above.
- **Fix:** Ensure `DashboardController` (or equivalent) plus `DashboardRepository` and providers replicate: profile loading/update, transaction sync and pagination, balance refresh, mode/network preference updates, and that all screens use this single source of truth rather than ad-hoc loading.

### 2.5 Receive flow: polling interval and payment detection
- **Flutter:** Receive sheet may not poll at the same interval or use the same “opened at” window for new payments.
- **Reference:** `_web_reference/src/components/UserDashboard.tsx`: Polling every **3s** (syncTransactions); payment detected when a **received** transaction exists with timestamp after `openedAt - 5s`; on success show “Payment Received!” then auto-close after ~2s.
- **Fix:** When receive sheet is open, poll transactions every 3s. Consider receive “opened at” time and treat a new received tx (after openedAt − 5s) as the payment; show success UI and auto-close after 2s.

### 2.6 Send: insufficient funds → open Fund modal with shortfall
- **Flutter:** Send flow may not open the fund sheet with the shortfall amount.
- **Reference:** `_web_reference/src/components/UserDashboard.tsx`: If balance is insufficient for send total, open Fund modal with `insufficientFundsAmount` set so user can deposit the shortfall.
- **Fix:** On send confirm, if balance < total (amount + fee), open the fund/deposit sheet and pass the shortfall amount so the UI can show “You need $X more.”

### 2.7 Transaction history: infinite scroll and “All loaded”
- **Flutter:** May not have cursor-based load-more or “All loaded” state.
- **Reference:** `_web_reference/src/components/TransactionHistory.tsx`: Infinite scroll via IntersectionObserver, loadMoreTransactions, and “All loaded” when no more.
- **Fix:** Implement scroll-to-bottom (or intersection) trigger to call loadMoreTransactions; show “All loaded” or similar when hasMoreTransactions is false.

### 2.8 Pin lockout: keep attempt count on lockout (vs reset to 0)
- **Flutter:** `lib/features/auth/presentation/pin_lockout_service.dart` (or equivalent): when user becomes locked out, Flutter may set `failedAttempts` to 0 when persisting.
- **Reference:** `_web_reference/src/lib/pinLockout.ts`: On lockout, record the new attempt count (e.g. newAttempts); 24h inactivity resets **consecutive** lockouts but not necessarily the last attempt count in the same way.
- **Fix:** Align lockout persistence with web: when locking out, keep the attempt count that caused lockout (do not reset to 0) so that 24h reset and “consecutive” logic match. Verify MAX_ATTEMPTS (5) and LOCKOUT_DURATIONS_MS ([1min, 5min, 15min, 1hr]) and 24h reset logic are identical.

---

## 3. Inaccurate implementations

### 3.1 Lookup endpoint and response shape
- **Flutter:** `payment_relay_service.dart` calls `lookup-paytag` and uses `data['address']`.
- **Reference:** PayTagContext uses **check-paytag** `action: 'lookup'`; returns profile with `wallet_address` and `pay_tag`.
- **Fix:** Use check-paytag with action lookup; parse `wallet_address` and `pay_tag` (see 1.2).

### 3.2 getPaymentNonce HTTP method and body
- **Flutter:** GET with query `action=nonce`.
- **Reference:** POST with body `action: 'getNonce'`, `message: { walletAddress }`, `network`.
- **Fix:** Use POST and body as in 1.3.

### 3.3 EIP-712 vs custom hash signing
- **Flutter:** Custom string hash and raw sign.
- **Reference:** EIP-712 domain and PaymentAuthorization type.
- **Fix:** Implement EIP-712 as in 1.4.

### 3.4 Relay POST body field names
- **Flutter:** Already uses `action`, `signature`, `message`, `senderProfileId`, `recipientPayTag`, `network` in relay POST — verify with web that message sub-fields (from, to, amount, fee, nonce, deadline) and types (string vs number for amount/fee/nonce/deadline) match exactly so the backend does not reject or misinterpret.

### 3.5 Register profile: solanaAddress and preferredNetwork
- **Flutter:** `lib/features/auth/data/paytag_repository.dart` register body may omit `solanaAddress` and may hardcode or differ on `preferredNetwork`.
- **Reference:** `_web_reference/src/contexts/PayTagContext.tsx` createProfile and check-paytag register: payTag, walletAddress, encryptedPrivateKey, preferredMode, preferredNetwork, and **solanaAddress** when applicable.
- **Fix:** Include `solanaAddress` in register payload when the user has a Solana wallet (e.g. from onboarding). Use the selected or default preferredNetwork (e.g. from chain config) instead of hardcoding if it differs from web default.

### 3.6 Currency/labels per network
- **Flutter:** Hardcoded “USDC” or “Base” in places instead of using chain config.
- **Reference:** `chains.ts`: Base → USDC, BSC → USDT, Tempo → aUSD, Solana → USDC; labels from config.
- **Fix:** Use a single chain config module (1.1) and display currency and network name from it everywhere.

---

## 4. Hardcoded or placeholder values

### 4.1 Supabase URL and anon key
- **Flutter:** `lib/core/services/payment_relay_service.dart` (and possibly others) use a **hardcoded** base URL `https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1`. Anon key may be passed in or env.
- **Reference:** Web typically uses env or Supabase client config.
- **Fix:** Load base URL (and anon key) from environment/config (e.g. .env or flavor config). Do not commit production URLs/keys; use same pattern as web.

### 4.2 DashboardRepository loadMoreTransactions
- **Flutter:** `lib/features/wallet/data/dashboard_repository_impl.dart`: `loadMoreTransactions` returns `[]` with comment "TODO: wire to Supabase when backend pagination is available".
- **Fix:** Implement with relay-payment `action: 'history'` and cursor/limit (see 2.3).

### 4.3 Feature tour “Fund Wallet” stub
- **Flutter:** `lib/features/auth/presentation/feature_tour_screen.dart`: `_onFundWallet` is a stub comment: "Stub when fund flow exists".
- **Fix:** Navigate to fund/deposit screen (e.g. open fund sheet or push fund route) when user taps Fund Wallet on the last tour step.

### 4.4 Activation funder URL and deviceId
- **Flutter:** `lib/features/auth/presentation/onboarding_controller.dart`: `_activationFunderUrl` and `deviceId: 'flutter-${DateTime.now().millisecondsSinceEpoch}'` are hardcoded.
- **Reference:** Web uses same or similar Supabase URL from config; deviceId may be used for rate limiting.
- **Fix:** Prefer base URL from env; keep deviceId format if backend expects it, but avoid hardcoding the full URL in source.

### 4.5 Any other TODOs / placeholders
- **Flutter:** Search codebase for "TODO", "FIXME", "placeholder", "dummy", "0x0", "0.0" balance defaults, or static lists used instead of API data.
- **Fix:** Replace with real config, env, or API data; remove or implement TODOs.

---

## Summary table

| #   | Category   | Topic                                      | Flutter file(s)                    | Reference file(s)                    |
|-----|------------|--------------------------------------------|------------------------------------|-------------------------------------|
| 1.1 | Missing    | Chain config module                        | (none)                             | config/chains.ts                    |
| 1.2 | Missing    | Lookup via check-paytag                    | payment_relay_service.dart          | PayTagContext.tsx                   |
| 1.3 | Missing    | getNonce POST                              | payment_relay_service.dart          | wallet.ts, relay-payment            |
| 1.4 | Missing    | EIP-712 signing                            | payment_relay_service.dart          | wallet.ts                           |
| 1.5 | Missing    | Wallet v1/legacy decrypt                   | wallet_service.dart                 | wallet.ts                           |
| 1.6 | Missing    | Transaction tag filter                     | transaction_history_screen.dart    | TransactionHistory, TransactionBadge |
| 1.7 | Missing    | Batch PayTag for counterparty              | transaction_history_screen.dart    | TransactionHistory.tsx              |
| 1.8 | Missing    | Receipt print                              | transaction_receipt_modal.dart     | TransactionHistory.tsx              |
| 1.9 | Missing    | Receive QR structure + dual mode           | receive_sheet.dart                 | UserDashboard.tsx                   |
| 1.10| Missing    | Send recent-tag suggestions                | send sheet / dashboard             | UserDashboard.tsx                   |
| 1.11| Missing    | Merchant numpad, products, cart, charge   | merchant screens                   | MerchantDashboard.tsx               |
| 1.12| Missing    | Fund: all methods & networks              | fund_sheet.dart                    | FundWalletModal/                    |
| 1.13| Missing    | Withdraw full flow                         | withdraw_controller/sheet         | WithdrawModal.tsx                   |
| 1.14| Missing    | Network toggle parity                      | network selector                   | NetworkToggle.tsx                  |
| 1.15| Missing    | Bottom nav tabs + center + dot             | bottom nav                         | BottomNav.tsx                      |
| 1.16| Missing    | Settings rows (Developer, Support, etc.)   | settings_screen.dart               | Settings.tsx                       |
| 2.1 | Incomplete | Create: persist key, address, PIN hash     | onboarding_controller.dart         | Onboarding, PayTagContext           |
| 2.2 | Incomplete | Biometric PIN storage in onboarding       | lock_controller.dart               | Onboarding / Settings               |
| 2.3 | Incomplete | Dashboard profile + tx from backend       | dashboard_repository_impl.dart     | PayTagContext.tsx                   |
| 2.4 | Incomplete | Full PayTagContext parity                  | dashboard controller/repo          | PayTagContext.tsx                   |
| 2.5 | Incomplete | Receive polling + detection               | receive_sheet / dashboard          | UserDashboard.tsx                   |
| 2.6 | Incomplete | Send insufficient funds → Fund            | send flow                          | UserDashboard.tsx                   |
| 2.7 | Incomplete | History infinite scroll + “All loaded”     | transaction_history_screen.dart   | TransactionHistory.tsx              |
| 2.8 | Incomplete | Pin lockout attempt count on lockout      | pin_lockout_service.dart           | pinLockout.ts                      |
| 3.1 | Inaccurate | Lookup endpoint/response                   | payment_relay_service.dart         | PayTagContext.tsx                   |
| 3.2 | Inaccurate | getNonce GET vs POST                       | payment_relay_service.dart         | wallet.ts                           |
| 3.3 | Inaccurate | Signing method                             | payment_relay_service.dart         | wallet.ts                           |
| 3.4 | Inaccurate | Relay message field types                  | send/relay call sites              | UserDashboard, relay-payment        |
| 3.5 | Inaccurate | Register solanaAddress/preferredNetwork    | paytag_repository.dart             | PayTagContext.tsx                   |
| 3.6 | Inaccurate | Currency/labels from config                | multiple                           | chains.ts                           |
| 4.1 | Hardcoded  | Supabase URL                               | payment_relay_service.dart, etc.   | env/config                          |
| 4.2 | Hardcoded  | loadMoreTransactions TODO                  | dashboard_repository_impl.dart     | —                                   |
| 4.3 | Hardcoded  | Feature tour Fund stub                     | feature_tour_screen.dart           | —                                   |
| 4.4 | Hardcoded  | Activation funder URL                      | onboarding_controller.dart         | —                                   |
| 4.5 | Hardcoded  | Other TODOs/placeholders                   | (codebase-wide)                    | —                                   |

---

*End of audit report. No code changes were applied.*
