# MoniPay Flutter App — Comprehensive Fix & Feature Parity Prompt

## PROJECT CONTEXT
This is the MoniPay Flutter mobile app (Riverpod + GoRouter + DM Sans/Montserrat typography).
The web app (React/Vite/Tailwind) is the source of truth in `_web_reference/` folder.
The Flutter codebase lives in `monipay-mobile/`.

### Key Architectural Rules
- **State Management:** Riverpod (StateNotifier + Provider)
- **Navigation:** GoRouter
- **Secure Storage:** flutter_secure_storage for PIN/keys; shared_preferences for non-sensitive
- **EVM:** web3dart for signing; Supabase Edge Functions for relay
- **Animations:** flutter_animate or manual AnimationControllers
- **Typography:** DM Sans (body), Montserrat (display/headings)
- **Colors:** Defined in `monipay-mobile/lib/app/theme/app_theme.dart` — MonipayColors class

### Supabase Config
- **URL:** `https://vdaeojxonqmzejwiioaq.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYWVvanhvbnFtemVqd2lpb2FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Mzk0NjksImV4cCI6MjA4NDMxNTQ2OX0.mzda_ZFMjtOybd47jTIwHlwWpDtv0LCdh4X5WaqjDKM`
- **All data access is through Edge Functions** (RLS blocks direct client access on most tables)

### Chain Configuration (from `monipay-mobile/lib/core/config/chain_configs.dart`)
| Chain | ID | Currency | Decimals | Token Address | Router |
|-------|-----|----------|----------|--------------|--------|
| Base | 8453 | USDC | 6 | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 0x4048d18F71E723647f83B61202362425C5a7D2c0 |
| BSC | 56 | USDT | 18 | 0x55d398326f99059fF775485246999027B3197955 | 0x557285AbC46038E898d90eB00943Ff42c4Fbcb54 |
| Tempo | 42431 | aUSD | 6 | 0x20c0000000000000000000000000000000000001 | 0xa39C3B7e02686cf7F226337525515c694318BDb9 |
| Solana | 0 | USDC | 6 | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v | N/A |

### Database: profiles table columns
`id, pay_tag, wallet_address, encrypted_private_key, preferred_network, preferred_mode, solana_address, tempo_address, bot_allowance_amount, x_username, x_verified, discord_id, discord_username, telegram_id, telegram_username, farcaster_fid, farcaster_username`

### Edge Functions used by mobile app
- `relay-payment` — actions: `sign-and-relay`, `history`, `balance`, `nonce`, `allowance`, `activate`
- `profile` — actions: `get`, `create`, `update`, `update-network`
- `products` — actions: `list`, `create`, `update`, `delete`
- `api-keys` — actions: `get`, `generate`, `update-webhook`
- `invoices` — actions: `list`, `create`, `pay`
- `social-identity` — social account linking
- `support-tickets` — actions: `create`, `list`, `get`, `reply`
- `feedback` — submit feedback

---

## ISSUE 1: Feature Tour Card Widths & Receipt Paper-Cut

**Problem:** The 3 feature tour cards are wider than the web version. The receipt card's paper-cut bottom edge has a different color from the card body.

**File:** `monipay-mobile/lib/features/auth/presentation/feature_tour_screen.dart`

**Web Reference:** `src/components/FeatureTour.tsx`

**Web card widths:**
- SendMoneyCard: `w-[260px]` (260px)
- PaymentTerminalCard: `w-[220px]` (220px)
- MoniBotCard: `w-[270px]` (270px)

**Fix Requirements:**
1. Constrain each card to its exact web width equivalent (use `SizedBox(width: 260)`, `220`, `270` respectively inside their builder, not the `maxWidth: 320` ConstrainedBox that currently wraps all cards).
2. **Receipt torn edge fix:** The web version uses an SVG with `fill="currentColor"` set to `text-card` (the card background color). The Flutter `_PaperCutClipper` clips the container but the teeth area below the card gets the blue background color. **Solution:** Don't use ClipPath on the card Container directly. Instead, build the card without clip, then place a separate widget below it that draws the torn-edge teeth using `CustomPaint` filled with `cardBg` color (same as card). This ensures the torn teeth match the card color exactly, not the blue background.

**Web torn edge implementation (copy this approach):**
```dart
// After the card Container, add:
CustomPaint(
  size: Size(cardWidth, 10),
  painter: _TornEdgePainter(color: cardBg),
)
```
Where `_TornEdgePainter` draws the jagged zigzag path filled with `cardBg`.

---

## ISSUE 2: Mode Switch Animation Missing

**Problem:** The merchant/personal mode toggle has no sliding pill animation like the web version.

**File:** `monipay-mobile/lib/features/wallet/presentation/dashboard_screen.dart` — `_ModeChip` class (line 361-396)

**Web Reference:** `src/components/ModeToggle.tsx` — Uses `framer-motion` with a `motion.div` background pill that slides between merchant/personal using `animate={{ left, right }}` with spring physics.

**Fix Requirements:**
1. Replace the static `_ModeChip` pair with an `AnimatedPositioned` or `AnimatedContainer` background pill that slides behind the active mode.
2. Use a `Stack` with the sliding pill behind two text buttons.
3. The pill should be `MonipayColors.primaryBlue` when merchant is active, and `fg` (foreground color) when personal is active (matching web's `bg-foreground`).
4. Text color: active = `Colors.white` (or background), inactive = `muted`.
5. Spring-like animation: `Curves.easeOutBack`, duration ~300ms.
6. Include Store and User icons like web (`Store`, `User` from lucide_icons).

**Web code reference:**
```tsx
// ModeToggle.tsx
<motion.div
  className="absolute top-0.5 bottom-0.5 rounded-full bg-foreground"
  animate={{
    left: mode === 'merchant' ? 2 : '50%',
    right: mode === 'merchant' ? '50%' : 2,
  }}
  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
/>
```

---

## ISSUE 3: Balance Card Dent Size + Network Dropdown Text Invisible

**Problem:** (a) The dent/notch at the top of the balance card doesn't match the web version's size/shape. (b) When the network selector dropdown opens in personal mode (light theme), the dropdown text is invisible because it uses `onSurface` color which is same as the dark balance card background.

**Files:**
- `monipay-mobile/lib/features/wallet/presentation/widgets/balance_card.dart` — `_NotchedCardPainter`
- `monipay-mobile/lib/features/wallet/presentation/widgets/network_toggle_widget.dart`

**Web Reference:** `src/components/DentedCard.tsx` — The notch is 140px wide × 45px tall, using `bg-background rounded-b-3xl`.

**Fix Requirements:**

### 3a — Dent sizing
The current Flutter `_NotchedCardPainter` uses `notchWidth: 100, notchDepth: 12`. Change to:
- `notchWidth: 140` (matching web's 140px)
- `notchDepth: 45` (matching web's 45px height)
- Use `rounded-b-3xl` equivalent: bottom corners of the notch cutout should have `Radius.circular(24)`.
- The notch overlay div should be the **page background color** (not transparent), positioned above the card but behind the NetworkToggle pill.

### 3b — Network dropdown text visibility
In `network_toggle_widget.dart`, the expanded options text at line 180-188 uses:
```dart
color: muted, // which is Theme.of(context).colorScheme.onSurface.withOpacity(0.5)
```
This is invisible against the dark balance card in light mode. **Fix:** The dropdown should always use **high-contrast colors**. When expanded, the dropdown sits on a `_pillBg` which is semi-transparent. The text should use:
- For the dropdown options: use a fixed color that contrasts with the pill background. Since the pill has `BackdropFilter` blur, use `Colors.white` for dark mode and `MonipayColors.foregroundLight` for light mode, NOT the card surface color.
- Better approach: make the pill background more opaque when expanded. Change `_pillBg` to be more opaque, e.g., `isDark ? Color(0xDD1A1A1F) : Color(0xDDFFFFFF)` when expanded.

---

## ISSUE 4: Transaction History Modal Not Functional

**Problem:** Transaction history modal/screen is not wired up to real data properly.

**Files:**
- `monipay-mobile/lib/features/wallet/presentation/widgets/modals/history_sheet.dart`
- `monipay-mobile/lib/features/wallet/presentation/transaction_history_screen.dart`

**Edge Function:** `relay-payment` with action `history`

**Request format:**
```json
{
  "action": "history",
  "message": {
    "profileId": "uuid",
    "limit": 50,
    "cursor": "optional-last-tx-id"
  }
}
```

**Response format:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "sent" | "received",
      "counterparty": "@paytag or 0xaddress",
      "amount": 5.00,
      "fee": 0.05,
      "created_at": "ISO timestamp",
      "tx_hash": "0x...",
      "status": "completed",
      "source": "p2p" | "payment_link" | "invoice" | "monibot_p2p" | "monibot_grant",
      "payer_pay_tag": "@tag",
      "invoice_id": "uuid or null",
      "items": [] | null,
      "metadata": {} | null
    }
  ],
  "hasMore": true,
  "nextCursor": "last-tx-id"
}
```

**Fix Requirements:**
1. Wire the history sheet to display paginated transaction list from `dashboardControllerProvider` state.
2. Support infinite scroll (load more via `loadMoreTransactions()`).
3. Tapping a transaction should open a receipt/detail modal showing: counterparty, amount, fee, tx_hash (with explorer link), timestamp, source badge, status.
4. Explorer links: Base → `https://basescan.org/tx/{hash}`, BSC → `https://bscscan.com/tx/{hash}`, Tempo → `https://explore.tempo.xyz/tx/{hash}`, Solana → `https://solscan.io/tx/{hash}`.

---

## ISSUE 5: MoniTag Not Displayed in Key Places

**Problem:** User's payTag (`@monitag`) is not shown in Balance Card, Receive Modal, Settings, PIN page and other places where it should appear.

**Root Cause:** The `dashboard.payTag` may be null on initial load before the profile Edge Function returns. The `moniTagProvider` (from `wallet_controller.dart`) reads from secure storage but may also be empty.

**Fix Requirements:**
1. **Ensure payTag is loaded on app start:** In `dashboard_controller.dart → _loadInitial()`, payTag is loaded from `repository.loadProfile()`. Verify the profile Edge Function returns `pay_tag` and it's mapped to `profile.payTag`.
2. **Fallback chain:** Always use `dashboard.payTag ?? storedTag ?? ''` pattern (already done in dashboard_screen but missing in sub-components).
3. **Pass payTag explicitly** to: ReceiveSheet, SendSheet (for display), SettingsScreen profile card, LockScreen, FundSheet header, InvoiceSheet.
4. **Balance Card:** Already shows payTag at line 146-155 — verify `dashboard.payTag` is populated from profile load.

---

## ISSUE 6: Dashboard "Wallet activated for gasless" text

**Problem:** Shows "Wallet activated for gasless" instead of "{NetworkName} Activated" based on selected network.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/balance_card.dart` — line 234

**Fix:**
```dart
// Replace line 234:
'Wallet activated for gasless'
// With:
'${getChainConfig(preferredNetwork).name} Activated'
```

---

## ISSUE 7: MoniBot Modal — Social Icons Too Large, No Colors, No Auto-Swipe

**Problem:** Social platform icons (X, Discord, Telegram) are oversized, centered instead of inline, don't have their platform brand colors, and there's no auto-swipe animation between platforms.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/modals/monibot_sheet.dart`

**Web Reference:** `src/components/MoniBotSetupModal.tsx` — Platform icons are small (~20px), each with their brand color background, and auto-cycle with a progress bar timer.

**Fix Requirements:**
1. **Icon sizes:** Reduce `_PlatformIconButton` from `width: 44, height: 44` to `width: 32, height: 32`, icon `size: 16`.
2. **Brand colors on individual icons:**
   - X/Twitter: Black background (dark mode: white bg), white icon
   - Discord: `Color(0xFF5865F2)` background, white icon
   - Telegram: `Color(0xFF229ED9)` background, white icon
   - Active state: slightly brighter/elevated
3. **Auto-swipe animation:** Add a Timer that cycles `_activePlatform` every 4 seconds with a linear progress indicator bar under the icons. When user manually taps, reset the timer.
4. **Layout:** Icons should be in a `Row` with `MainAxisAlignment.start` or small spacing, NOT centered with large padding.

---

## ISSUE 8: Invoice Modal Not Wired to Real Invoice Data

**Problem:** InvoiceSheet currently derives "invoices" from transaction history, not from the actual `invoices` table.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/modals/invoice_sheet.dart`

**Edge Function:** `invoices` with action `list`

**Request:**
```json
{
  "action": "list",
  "profileId": "uuid"
}
```

**Response:**
```json
{
  "sent": [
    {
      "id": "uuid",
      "amount": 10.00,
      "recipient_pay_tag": "@bob",
      "status": "pending" | "paid" | "expired",
      "created_at": "ISO",
      "paid_at": "ISO | null",
      "memo": "text | null",
      "items": [] | null,
      "tx_hash": "0x... | null"
    }
  ],
  "received": [...]
}
```

**Fix:** Replace the current `_fetchInvoices()` method to call `Supabase.instance.client.functions.invoke('invoices', body: {'action': 'list', 'profileId': profileId})` and map the response to `_InvoiceItem` objects with proper status colors (paid=green, pending=amber, expired=red).

---

## ISSUE 9: Send Modal — Input Field Shows "@username" Instead of "monitag"

**Problem:** The recipient input field hint says `@username` and has a `prefixText: '@ '`. We want the hint to say `monitag` (without @) since the @ prefix is already shown.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/modals/send_sheet.dart` — line 173

**Fix:**
```dart
// Change line 173:
hintText: '@username',
// To:
hintText: 'monitag',
```

---

## ISSUE 10: Send, Payment, Receive Logic Not Wired

**Problem:** Core payment flows need full implementation.

### Send Flow (partially wired in send_controller.dart)
The send controller at `send_controller.dart` already implements:
1. PayTag lookup via `lookupPayTag()` → calls `profiles_public` view
2. Nonce fetch via `getPaymentNonce()`
3. EIP-712 signature via `signPaymentAuthorization()`
4. Relay via `relayPayment()` → calls `relay-payment` Edge Function

**Verify these functions exist in `monipay-mobile/lib/core/services/payment_relay_service.dart`:**
- `lookupPayTag(tag, anonKey)` → GET `profiles_public?pay_tag=eq.{tag}&select=wallet_address`
- `getPaymentNonce(address, network, anonKey)` → POST `relay-payment` with `{action: 'nonce', message: {address, network}}`
- `getAllowance(network, owner)` → POST `relay-payment` with `{action: 'allowance', message: {owner, network}}`
- `signPaymentAuthorization(...)` → EIP-712 typed data signing with web3dart
- `relayPayment(...)` → POST `relay-payment` with `{action: 'sign-and-relay', signature, message, senderProfileId, recipientPayTag, network}`

### Receive Flow (partially wired)
Already polls for new transactions. Verify polling works end-to-end.

### Payment/Charge Flow (QR scan → pay)
When user scans a QR code, it should:
1. Parse QR payload (JSON with `type`, `payTag`, `amount`, `address`)
2. Open PaySheet/PaymentConfirmSheet with pre-filled data
3. Follow same sign-and-relay flow as Send

---

## ISSUE 11: Receive Modal Copy Button Copies Address Instead of MoniTag

**Problem:** In receive_sheet.dart `_MoniPayTab`, the copy button calls `onCopyTag` which copies `@$payTag` — but looking at line 263-264:
```dart
onCopyTag: () {
  if (payTag.isEmpty) return;
  Clipboard.setData(ClipboardData(text: '@$payTag'));
```
This actually copies the payTag correctly. **But the share button** shares `'@$payTag on MoniPay — monipay.xyz'` — verify this works.

**ACTUALLY:** Re-reading the user's complaint — they say the copy button copies the **address** instead of the monitag. Check if `payTag` is empty/null at runtime, causing a fallback to address. This ties back to **Issue 5** — ensure payTag is loaded before ReceiveSheet opens.

**Fix:** In `_MoniPayTab`, add a fallback display: if `payTag` is empty, show "Loading..." or pull from secure storage directly.

---

## ISSUE 12: Header Logo & Theme Toggle Too Large

**Problem:** The M logo (size 40) and theme toggle button are too large compared to web.

**File:** `monipay-mobile/lib/features/wallet/presentation/dashboard_screen.dart` — `_Header` (line 277-358)

**Web Reference:** `src/components/Dashboard.tsx` — Logo is ~28px, theme toggle is small icon button.

**Fix:**
1. Change `AnimatedMonipayLogo` size from `40` to `28`.
2. Change theme toggle padding from `EdgeInsets.all(10)` to `EdgeInsets.all(8)`, icon size from `20` to `16`.
3. The mode toggle should also be slightly smaller: chip padding from `EdgeInsets.symmetric(horizontal: 16, vertical: 8)` to `EdgeInsets.symmetric(horizontal: 12, vertical: 6)`, font size from `13` to `11`.

---

## ISSUE 13: Backup Wallet Shows Address Instead of PIN → Private Key

**Problem:** Backup wallet dialog shows the wallet address. Should prompt for PIN first, then show the decrypted private key.

**File:** `monipay-mobile/lib/features/wallet/presentation/settings_screen.dart` — `_showBackupDialog` method

**Fix Flow:**
1. Show PIN input dialog (4-digit)
2. Verify PIN against stored encrypted private key using `lockControllerProvider.notifier.verifyAndDecryptForSigning(pin)`
3. If PIN correct, show the decrypted private key with a copy button and warning text
4. If PIN wrong, show error
5. Never show wallet address in this flow
6. Add "⚠️ Never share your private key" warning text

---

## ISSUE 14: Google Drive Backup Not Wired Correctly

**Problem:** Google Drive backup feature needs correct implementation across settings and other screens.

**File:** `monipay-mobile/lib/core/security/drive_backup_service.dart`

**Implementation Requirements:**
1. Use `google_sign_in` package for OAuth
2. Use Google Drive REST API to access `appDataFolder`
3. Before uploading:
   - Prompt for PIN
   - Decrypt private key
   - Re-encrypt with PBKDF2-derived AES-256-GCM key (using PIN as password)
   - Upload encrypted blob to Drive `appDataFolder`
4. On restore:
   - Sign in with Google
   - Search `appDataFolder` for existing backup file
   - Download and decrypt with user's PIN
   - Store in secure storage
5. Conflict detection: if backup already exists, ask user to restore or overwrite
6. Available from: Settings > Backup Wallet section, and Login screen (restore option)

---

## ISSUE 15: Biometric Unlock Slow/Not Implemented Correctly

**Problem:** Biometric authentication is slow and possibly not using the optimal native approach.

**File:** `monipay-mobile/lib/core/security/biometrics_service.dart`

**Correct Implementation:**
```dart
import 'package:local_auth/local_auth.dart';

class LocalAuthBiometricsService {
  final _auth = LocalAuthentication();

  Future<bool> canCheckBiometrics() async {
    try {
      final canAuth = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canAuth || isDeviceSupported;
    } catch (_) {
      return false;
    }
  }

  Future<bool> authenticate({String localizedReason = 'Authenticate'}) async {
    try {
      return await _auth.authenticate(
        localizedReason: localizedReason,
        options: const AuthenticationOptions(
          stickyAuth: true,       // Don't cancel on app pause
          biometricOnly: false,   // Allow PIN/pattern fallback
          useErrorDialogs: true,  // Show system error dialogs
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
```

**Key points:**
- Use `stickyAuth: true` to prevent cancellation on app lifecycle changes
- Use `biometricOnly: false` to allow device PIN/pattern as fallback
- Don't call `getAvailableBiometrics()` unless needed — it's slow on some devices
- Cache `canCheckBiometrics()` result for the session

**Android:** Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

**iOS:** Add to `Info.plist`:
```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access your wallet</string>
```

---

## ISSUE 16: Auto-Lock & High Value Protection Not Wired

**Problem:** Settings UI exists but functionality isn't connected to actual app behavior.

**Files:**
- `settings_screen.dart` — UI exists (lines 352-402)
- `dashboard_screen.dart` — Only checks 3-minute hardcoded timeout (line 82)

**Fix Requirements:**

### Auto-Lock
1. Read `_kAutoLockMinutesKey` and `_kAutoLockEnabledKey` from secure storage in `DashboardScreen.didChangeAppLifecycleState`
2. Replace hardcoded `elapsed.inMinutes >= 3` with the user's configured timeout
3. If auto-lock disabled, don't lock on background return (but still refresh data)

### High Value Protection
1. When `_kHighValueProtectionKey` is enabled, require PIN/biometric for transactions above a threshold (e.g., $100)
2. Add check in `SendController.submit()` before signing:
```dart
if (highValueProtection && amount > 100) {
  // Require biometric or PIN verification
}
```

---

## ISSUE 17: Notifications Not Wired

**Problem:** Notification settings exist in UI but aren't connected to push notifications.

**Cross-Platform Implementation:**
1. Use `firebase_messaging` for push notifications
2. Use `flutter_local_notifications` for local notifications
3. On toggle enable:
   - Request notification permission
   - Get FCM token
   - Store token in Supabase profile or a separate `device_tokens` table
4. On toggle disable:
   - Unsubscribe from topics
   - Remove FCM token from server
5. Notification types: payment received, payment sent, invoice received, security alert

**Note:** This requires Firebase setup. For MVP, implement permission request and store preference locally. Add a TODO comment for FCM integration.

---

## ISSUE 18: Language Not Implemented Like Web Version

**Problem:** Language selection exists in settings but doesn't change app language.

**Web Reference:** Uses `i18next` with 8 languages (en, fr, es, pt, sw, ar, zh, hi).

**Flutter Implementation:**
1. Use `flutter_localizations` + `intl` package
2. Create ARB files in `lib/l10n/` for each language
3. In settings, when language changes:
   - Save to secure storage
   - Update app locale via Riverpod state
4. Wrap `MaterialApp.router` with locale override from stored preference
5. Minimum languages for parity: en, fr, es, pt, sw

---

## ISSUE 19: MoniBot AI Settings Not Wired

**Problem:** MoniBot settings panel in the settings screen shows UI but doesn't connect to real data.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/monibot_settings_panel.dart`

**Edge Functions needed:**
- `social-identity` — for linking X/Discord/Telegram accounts
- `profile` with action `update` — for bot_allowance_amount

**Wiring Requirements:**
1. **Social linking cards:** Each platform card (X, Discord, Telegram) should:
   - Show linked status from profile data (x_username, discord_username, telegram_username)
   - "Link" button opens OAuth flow or verification flow
   - X: POST to `social-identity` with `{action: 'x-generate-code', profileId}`, show verification code, user tweets it, then verify
   - Discord: OAuth redirect flow via `social-identity` with `{action: 'discord-link', code, profileId}`
   - Telegram: Deep link to bot with state parameter
2. **Add to Server card:** Should open Discord bot invite URL (already wired per user)

---

## ISSUE 20: Bot Allowance Not Wired + Add Network Toggle

**Problem:** Bot allowance amount setting isn't saved to Supabase. Also needs a network-aware toggle.

**Fix Requirements:**
1. When user changes bot allowance amount, call `profile` Edge Function:
```json
{
  "action": "update",
  "profileId": "uuid",
  "walletAddress": "0x...",
  "updates": {
    "bot_allowance_amount": 50.00
  }
}
```
2. Add a network selector chip/toggle within the bot allowance card showing which chain the allowance applies to (uses `preferred_network`).
3. Display current allowance from `dashboardControllerProvider.state` profile data.

---

## ISSUE 21: Developer Mode Not Wired

**Problem:** API keys, webhook URL, and developer settings aren't functional.

**File:** `settings_screen.dart` — Developer section (partially implemented with `_loadApiKeys`, `_generateApiKeys`, `_saveWebhook`)

**These methods already call the correct Edge Functions.** Verify they work:
1. `_loadApiKeys` → `api-keys` with `{action: 'get', profileId}`
2. `_generateApiKeys` → `api-keys` with `{action: 'generate', profileId}`
3. `_saveWebhook` → `api-keys` with `{action: 'update-webhook', profileId, webhookUrl}`

**Fix:** Ensure the developer section is visible when `_showDeveloper` is toggled, and that `_loadApiKeys` is called when section opens. Add a toggle to expand/collapse the section.

---

## ISSUE 22: Help & Support Page Not Designed/Wired

**Problem:** Help screen only shows an email text, needs full design matching web.

**File:** `monipay-mobile/lib/features/wallet/presentation/help_support_screen.dart`

**Web Reference:** `src/components/HelpSupportPage.tsx` — Has:
- FAQ accordion section
- Support ticket creation form (subject + message)
- Ticket history list with status badges
- Live chat-like message thread per ticket

**Edge Functions:**
- `support-tickets` with actions: `create`, `list`, `get`, `reply`
- `feedback` for general feedback

**Design Requirements:**
1. **Header:** Back button + "Help & Support" title
2. **Quick Actions:** Email support link, FAQ section
3. **Create Ticket:** Subject field + message textarea + submit button
4. **Ticket History:** List of user's tickets with status (open/in_progress/resolved), tap to view thread
5. **Ticket Detail:** Chat-like UI showing messages between user and support, with reply input at bottom

**Create ticket request:**
```json
{
  "action": "create",
  "payTag": "@user",
  "subject": "text",
  "message": "text",
  "profileId": "uuid"
}
```

**List tickets request:**
```json
{
  "action": "list",
  "profileId": "uuid"
}
```

---

## ISSUE 23: Merchant Tab — Stats, Store, Charge Not Designed/Wired

**Problem:** Merchant dashboard features (stats page, store management, charge modal) are incomplete.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/merchant_dashboard.dart`

### Merchant Stats Page (Bottom Nav: "Stats" tab)
Should show:
- Total revenue (sum of received transactions)
- Total transactions count
- Average transaction value
- Revenue chart (daily/weekly/monthly)
- Top customers list

### Store Management (Bottom Nav: "Store" tab)
Edge Function: `products`
- List products with name, price, image, category
- Add/edit/delete products
- Toggle visibility on storefront
- Drag to reorder (sort_order)

### Charge Flow Fix
**Current bugs:**
1. Number keypad is skewed left — fix padding/alignment
2. Charge button takes too much space — add Invoice button alongside
3. Charge modal appears skewed/transparent at top-left instead of centered

**Fix for keypad alignment:** Ensure each `_NumKey` has `Expanded` wrapper and equal flex. Current code at lines 417-436 looks correct but verify `_NumKey` widget uses proper center alignment.

**Fix for charge modal:** The `_showQR` state shows a QR overlay but it's rendered as part of the Stack. It should be a proper modal/dialog positioned center with the correct background and border radius.

**Add Invoice button:** Next to the Charge button, add an "Invoice" pill button that opens InvoiceSheet for creating invoices.

---

## ISSUE 24: Withdraw Modal Not Created/Wired

**Problem:** WithdrawSheet exists but may not be fully implemented.

**File:** `monipay-mobile/lib/features/wallet/presentation/widgets/modals/withdraw_sheet.dart`

**Implementation Requirements:**
1. **Input:** Destination wallet address (0x... or ENS) + amount
2. **PIN verification** before signing
3. **Direct on-chain transfer** (not through router — no fee split needed for withdrawals)
4. Use web3dart to create and sign a standard ERC-20 transfer transaction
5. Submit via RPC or relay Edge Function
6. Show success with tx hash and explorer link
7. For Solana: use SPL token transfer (different signing)

---

## ISSUE 25: Pull-to-Refresh Not Working

**Problem:** RefreshIndicator exists in dashboard but drag doesn't trigger refresh.

**File:** `monipay-mobile/lib/features/wallet/presentation/dashboard_screen.dart` — line 120-126

**Current code looks correct:**
```dart
RefreshIndicator(
  onRefresh: () => ref.read(dashboardControllerProvider.notifier).refresh(),
  child: SingleChildScrollView(
    physics: const AlwaysScrollableScrollPhysics(),
```

**Possible fixes:**
1. Ensure `SingleChildScrollView` has enough content to scroll (add `SizedBox(height: 120)` at bottom — already there at line 172)
2. The `Column` wrapping may prevent scroll physics. Try wrapping content in `SliverList` with `CustomScrollView` instead.
3. Alternative: Use `RefreshIndicator` with a `ListView` instead of `SingleChildScrollView + Column`:
```dart
RefreshIndicator(
  onRefresh: () => ref.read(dashboardControllerProvider.notifier).refresh(),
  child: ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    children: [
      balanceCard,
      dashboard content,
      SizedBox(height: 120),
    ],
  ),
)
```

---

## PRIORITY ORDER

### Phase 1 — Critical UX (Do first)
1. Issue 3a,3b — Balance card dent + network dropdown visibility
2. Issue 2 — Mode switch animation
3. Issue 5 — MoniTag display everywhere
4. Issue 6 — Network name in activation text
5. Issue 9 — Send modal hint text
6. Issue 12 — Header sizing
7. Issue 25 — Pull-to-refresh

### Phase 2 — Core Functionality
8. Issue 10 — Send/Receive/Payment wiring
9. Issue 4 — Transaction history wiring
10. Issue 8 — Invoice history wiring
11. Issue 11 — Receive copy/share fix
12. Issue 13 — Backup wallet PIN flow
13. Issue 24 — Withdraw modal

### Phase 3 — Settings & Features
14. Issue 15 — Biometric unlock
15. Issue 16 — Auto-lock + high value protection
16. Issue 14 — Google Drive backup
17. Issue 20 — Bot allowance wiring
18. Issue 21 — Developer mode
19. Issue 19 — MoniBot settings

### Phase 4 — Design & Polish
20. Issue 1 — Feature tour card widths + receipt
21. Issue 7 — MoniBot modal icons + auto-swipe
22. Issue 23 — Merchant stats/store/charge
23. Issue 22 — Help & support page
24. Issue 17 — Notifications
25. Issue 18 — Language support

---

## KEY FILES REFERENCE MAP

| Component | Flutter File | Web Reference |
|-----------|-------------|---------------|
| Dashboard | `lib/features/wallet/presentation/dashboard_screen.dart` | `src/components/Dashboard.tsx` |
| Balance Card | `lib/features/wallet/presentation/widgets/balance_card.dart` | `src/components/Dashboard.tsx` (BalanceCard section) |
| Network Toggle | `lib/features/wallet/presentation/widgets/network_toggle_widget.dart` | `src/components/NetworkToggle.tsx` |
| Mode Toggle | `dashboard_screen.dart` (_ModeChip) | `src/components/ModeToggle.tsx` |
| Dented Card | `balance_card.dart` (_NotchedCardPainter) | `src/components/DentedCard.tsx` |
| Feature Tour | `lib/features/auth/presentation/feature_tour_screen.dart` | `src/components/FeatureTour.tsx` |
| Send Sheet | `lib/features/wallet/presentation/widgets/modals/send_sheet.dart` | `src/components/SendModal.tsx` |
| Receive Sheet | `lib/features/wallet/presentation/widgets/modals/receive_sheet.dart` | `src/components/ReceiveModal.tsx` |
| MoniBot Sheet | `lib/features/wallet/presentation/widgets/modals/monibot_sheet.dart` | `src/components/MoniBotSetupModal.tsx` |
| Invoice Sheet | `lib/features/wallet/presentation/widgets/modals/invoice_sheet.dart` | `src/components/InvoiceModal.tsx` |
| Settings | `lib/features/wallet/presentation/settings_screen.dart` | `src/components/SettingsPage.tsx` |
| Merchant | `lib/features/wallet/presentation/widgets/merchant_dashboard.dart` | `src/components/MerchantDashboard.tsx` |
| Help/Support | `lib/features/wallet/presentation/help_support_screen.dart` | `src/components/HelpSupportPage.tsx` |
| Bottom Nav | `lib/features/wallet/presentation/widgets/bottom_nav.dart` | `src/components/BottomNav.tsx` |
| Theme | `lib/app/theme/app_theme.dart` | `src/index.css` (CSS variables) |
| Chain Config | `lib/core/config/chain_configs.dart` | `src/config/chains.ts` |
| Send Logic | `lib/features/wallet/presentation/send_controller.dart` | `src/contexts/PayTagContext.tsx` (sendPayment) |
| Payment Relay | `lib/core/services/payment_relay_service.dart` | `src/lib/wallet.ts` |
| Wallet Crypto | `lib/core/security/wallet_crypto_service.dart` | `src/lib/wallet.ts` |
| Biometrics | `lib/core/security/biometrics_service.dart` | N/A (mobile only) |
| Drive Backup | `lib/core/security/drive_backup_service.dart` | `src/lib/googleDriveBackup.ts` |
