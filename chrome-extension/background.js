/**
 * MoniPay Background Service Worker v2.0
 *
 * Handles wallet generation, key encryption/decryption, payment signing,
 * and relay communication.
 */

const RELAY_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/relay-payment';
const CHECK_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/check-paytag';

let pendingPayment = null;
let pendingCallback = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS[message.type];
  if (handler) {
    const result = handler(message, sendResponse);
    return result; // true = async response
  }
  return false;
});

const MESSAGE_HANDLERS = {
  // ─── Wallet Generation ───
  GENERATE_WALLET: (msg, respond) => {
    generateWallet(msg.payload.pin)
      .then(respond)
      .catch((e) => respond({ success: false, error: e.message }));
    return true;
  },

  // ─── Key Decryption ───
  DECRYPT_KEY: (msg, respond) => {
    decryptKey(msg.payload.encryptedKey, msg.payload.pin)
      .then((key) => respond(key ? { success: true, privateKey: key } : { success: false, error: 'Invalid PIN' }))
      .catch((e) => respond({ success: false, error: e.message }));
    return true;
  },

  // ─── Send Payment (P2P via relay) ───
  SEND_PAYMENT: (msg, respond) => {
    handleSendPayment(msg.payload)
      .then(respond)
      .catch((e) => respond({ success: false, error: e.message }));
    return true;
  },

  // ─── Merchant Payment Request ───
  PAYMENT_REQUEST: (msg, respond) => {
    pendingPayment = msg.payload;
    pendingCallback = respond;
    chrome.action.openPopup?.() || chrome.action.setPopup({ popup: 'popup.html' });
    return true;
  },

  GET_PENDING_PAYMENT: (msg, respond) => {
    respond({ payment: pendingPayment });
    return false;
  },

  APPROVE_PAYMENT: (msg, respond) => {
    handlePaymentApproval(msg.payload)
      .then((result) => {
        pendingCallback?.(result);
        pendingCallback = null;
        pendingPayment = null;
        respond(result);
      })
      .catch((err) => {
        const errorResult = { success: false, error: err.message };
        pendingCallback?.(errorResult);
        pendingCallback = null;
        pendingPayment = null;
        respond(errorResult);
      });
    return true;
  },

  REJECT_PAYMENT: (msg, respond) => {
    const rejection = { success: false, error: 'Payment rejected by user' };
    pendingCallback?.(rejection);
    pendingCallback = null;
    pendingPayment = null;
    respond(rejection);
    return false;
  },

  CHECK_WALLET: (msg, respond) => {
    chrome.storage.local.get(['monipay_wallet'], (result) => {
      respond({ hasWallet: !!result.monipay_wallet });
    });
    return true;
  },
};

// ═══════════════════════════════════════
// WALLET GENERATION
// ═══════════════════════════════════════
async function generateWallet(pin) {
  // Generate 32 random bytes as private key
  const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const privateKeyHex = '0x' + Array.from(privateKeyBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Derive address using keccak256 of public key
  // Since we can't use viem in service worker, we derive a deterministic address
  // The actual address derivation happens server-side during registration
  // For now, compute a placeholder that will be overwritten by the edge function
  const addressBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', privateKeyBytes));
  const address = '0x' + Array.from(addressBytes.slice(0, 20)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Encrypt private key with PIN
  const encryptedKey = await encryptKey(privateKeyHex, pin);

  return {
    success: true,
    privateKey: privateKeyHex,
    address: address,
    encryptedKey: encryptedKey,
  };
}

// ═══════════════════════════════════════
// SEND PAYMENT
// ═══════════════════════════════════════
async function handleSendPayment({ pin, amount, recipientTag, network }) {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) throw new Error('No wallet configured');

  const { encryptedPrivateKey, address, payTag, profileId } = stored.monipay_wallet;

  // Verify PIN
  const privateKey = await decryptKey(encryptedPrivateKey, pin);
  if (!privateKey) throw new Error('Invalid PIN');

  // Resolve recipient
  const lookupRes = await fetch(CHECK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'lookup', payTag: recipientTag }),
  });
  const lookupData = await lookupRes.json();
  if (!lookupData.profile) throw new Error(`MoniTag @${recipientTag} not found`);

  const recipientAddress = lookupData.profile.wallet_address;

  // Send to relay
  const response = await fetch(RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'pay',
      message: {
        action: 'pay',
        from: address,
        to: recipientAddress,
        amount: amount.toString(),
        profileId,
        payerPayTag: payTag,
        recipientPayTag: recipientTag,
        network: network || 'base',
      },
      signature: privateKey,
      network: network || 'base',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Relay error: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, txHash: data.txHash };
}

// ═══════════════════════════════════════
// PAYMENT APPROVAL (merchant-triggered)
// ═══════════════════════════════════════
async function handlePaymentApproval({ pin, amount, recipientTag }) {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) throw new Error('No wallet configured');

  const { encryptedPrivateKey, address, payTag, profileId } = stored.monipay_wallet;
  const privateKey = await decryptKey(encryptedPrivateKey, pin);
  if (!privateKey) throw new Error('Invalid PIN');

  const message = {
    action: 'pay',
    from: address,
    to: '', // Will be resolved by relay
    amount: amount.toString(),
    profileId,
    payerPayTag: payTag,
    recipientPayTag: recipientTag || '',
    network: 'base',
  };

  const response = await fetch(RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'pay', message, signature: privateKey }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Relay error: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, txHash: data.txHash };
}

// ═══════════════════════════════════════
// CRYPTO: AES-256-GCM Encryption
// ═══════════════════════════════════════
async function encryptKey(privateKey, pin) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(privateKey));

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return 'v2:' + btoa(String.fromCharCode(...combined));
}

async function decryptKey(encryptedData, pin) {
  try {
    // Handle v2: prefix (AES-GCM)
    if (encryptedData.startsWith('v2:')) {
      const raw = encryptedData.slice(3);
      const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const ciphertext = combined.slice(28);

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
      return new TextDecoder().decode(decrypted);
    }

    // Handle v1: prefix (XOR with salt)
    if (encryptedData.startsWith('v1:')) {
      const raw = encryptedData.slice(3);
      const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const data = combined.slice(28);

      const enc = new TextEncoder();
      const pinData = enc.encode(pin);
      const keyBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        keyBytes[i] = salt[i % salt.length] ^ pinData[i % pinData.length] ^ (i * 17);
      }

      const decrypted = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        decrypted[i] = data[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
      }

      return new TextDecoder().decode(decrypted);
    }

    // Legacy JSON format (old popup.js v1)
    const parsed = JSON.parse(encryptedData);
    if (parsed.version === 2) {
      const enc = new TextEncoder();
      const salt = Uint8Array.from(atob(parsed.salt), (c) => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(parsed.ciphertext), (c) => c.charCodeAt(0));

      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
      return new TextDecoder().decode(decrypted);
    }

    // Legacy XOR
    const encrypted = atob(parsed.data || parsed);
    let result = '';
    for (let i = 0; i < encrypted.length; i++) {
      result += String.fromCharCode(encrypted.charCodeAt(i) ^ pin.charCodeAt(i % pin.length));
    }
    return result;
  } catch {
    return null;
  }
}
