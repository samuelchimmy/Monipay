/**
 * MoniPay Extension Popup v2.0
 *
 * Full-featured: Signup, Import, Dashboard, Send, Receive, MoniBot, Settings, Payment approval.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const API = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

// ─── Network Config ───
const NETWORKS = {
  celo: { name: 'Celo', currency: 'cUSD', decimals: 18, token: '0x765DE81E75624D1c647b96F960EE1EFD4024c9e4', rpc: 'https://forno.celo.org', explorer: 'https://celoscan.io' }
};

let activeNetwork = 'celo';

// ─── Screen Management ───
const allScreens = () => $$('.screen');
function showScreen(id) {
  allScreens().forEach((s) => s.classList.add('hidden'));
  const el = typeof id === 'string' ? $(`#${id}`) : id;
  if (el) el.classList.remove('hidden');
}

// Back buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.back-btn');
  if (btn) showScreen(btn.dataset.back);
});

// ─── Init ───
async function init() {
  const stored = await chrome.storage.local.get(['monipay_wallet', 'monipay_unlocked']);

  if (!stored.monipay_wallet) {
    showScreen('welcome-screen');
    return;
  }

  if (!stored.monipay_unlocked) {
    showScreen('lock-screen');
    return;
  }

  // Check for pending payment from merchant
  chrome.runtime.sendMessage({ type: 'GET_PENDING_PAYMENT' }, (resp) => {
    if (resp?.payment) {
      showPayment(resp.payment);
    } else {
      showDashboard(stored.monipay_wallet);
    }
  });
}

// ═══════════════════════════════════════
// CREATE FLOW
// ═══════════════════════════════════════
let createData = { payTag: '', pin: '', mode: '', encKey: '', address: '', profileId: '', privateKey: '' };

$('#welcome-create-btn').addEventListener('click', () => showScreen('create-tag-screen'));
$('#welcome-import-btn').addEventListener('click', () => showScreen('import-screen'));

// Step 1: MoniTag
$('#create-tag-next').addEventListener('click', async () => {
  const tag = $('#create-paytag').value.trim().toLowerCase();
  const errEl = $('#tag-error');
  errEl.classList.add('hidden');

  if (tag.length < 3) { errEl.textContent = 'Must be at least 3 characters'; errEl.classList.remove('hidden'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(tag)) { errEl.textContent = 'Only letters, numbers, underscores'; errEl.classList.remove('hidden'); return; }

  const btn = $('#create-tag-next');
  btn.disabled = true; btn.textContent = 'Checking...';

  try {
    const res = await fetch(`${API}/check-paytag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', payTag: tag }),
    });
    const data = await res.json();
    if (!data.available) {
      errEl.textContent = 'This MoniTag is taken'; errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Continue'; return;
    }
    createData.payTag = tag;
    btn.disabled = false; btn.textContent = 'Continue';
    showScreen('create-pin-screen');
  } catch (e) {
    errEl.textContent = 'Network error. Try again.'; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Continue';
  }
});

// Step 2: PIN
$('#create-pin-next').addEventListener('click', () => {
  const pin = $('#create-pin').value;
  const confirm = $('#create-pin-confirm').value;
  const errEl = $('#pin-error');
  errEl.classList.add('hidden');

  if (pin.length !== 4) { errEl.textContent = 'PIN must be 4 digits'; errEl.classList.remove('hidden'); return; }
  if (pin !== confirm) { errEl.textContent = 'PINs do not match'; errEl.classList.remove('hidden'); return; }

  createData.pin = pin;
  showScreen('create-mode-screen');
});

// Step 3: Mode selection
let selectedMode = null;
$$('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    $$('.mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
    $('#create-finish-btn').disabled = false;
  });
});

$('#create-finish-btn').addEventListener('click', async () => {
  if (!selectedMode) return;
  createData.mode = selectedMode;

  const btn = $('#create-finish-btn');
  const statusEl = $('#create-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating...';
  statusEl.classList.add('hidden');

  try {
    // Generate wallet via background script (uses Web Crypto)
    const wallet = await sendMsg({ type: 'GENERATE_WALLET', payload: { pin: createData.pin } });
    if (!wallet.success) throw new Error(wallet.error || 'Wallet generation failed');

    createData.address = wallet.address;
    createData.encKey = wallet.encryptedKey;
    createData.privateKey = wallet.privateKey;

    // Register profile via edge function
    const res = await fetch(`${API}/check-paytag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        payTag: createData.payTag,
        walletAddress: createData.address,
        encryptedPrivateKey: createData.encKey,
        preferredMode: createData.mode,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    createData.profileId = data.profileId || data.profile?.id || '';

    // Save to extension storage
    await chrome.storage.local.set({
      monipay_wallet: {
        payTag: createData.payTag,
        address: createData.address,
        encryptedPrivateKey: createData.encKey,
        profileId: createData.profileId,
        pinHash: await hashPin(createData.pin),
        preferredMode: createData.mode,
        preferredNetwork: 'base',
      },
      monipay_unlocked: true,
    });

    // Show backup screen
    $('#backup-key').textContent = createData.privateKey;
    showScreen('backup-screen');

  } catch (e) {
    statusEl.className = 'status error';
    statusEl.textContent = '✗ ' + (e.message || 'Failed to create account');
    statusEl.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
  }
});

// Backup Screen
$('#copy-key-btn').addEventListener('click', async () => {
  const key = $('#backup-key').textContent;
  await navigator.clipboard.writeText(key);
  $('#copy-status').classList.remove('hidden');
  $('#backup-done-btn').disabled = false;
});

$('#backup-done-btn').addEventListener('click', async () => {
  createData.privateKey = ''; // Clear from memory
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  showDashboard(stored.monipay_wallet);
});

// ═══════════════════════════════════════
// IMPORT FLOW
// ═══════════════════════════════════════
$('#import-btn').addEventListener('click', async () => {
  const tag = $('#import-paytag').value.trim().toLowerCase();
  const pin = $('#import-pin').value;
  const errEl = $('#import-error');
  errEl.classList.add('hidden');

  if (!tag || tag.length < 3) { errEl.textContent = 'Enter a valid MoniTag'; errEl.classList.remove('hidden'); return; }
  if (pin.length !== 4) { errEl.textContent = 'Enter your 4-digit PIN'; errEl.classList.remove('hidden'); return; }

  const btn = $('#import-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    // Lookup profile by MoniTag
    const res = await fetch(`${API}/check-paytag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', payTag: tag }),
    });
    const data = await res.json();

    if (!data.profile) throw new Error('MoniTag not found');

    const profile = data.profile;
    const encKey = profile.encrypted_private_key || profile.wallet?.encryptedPrivateKey || profile.encryptedPrivateKey;
    if (!encKey) throw new Error('No wallet data found for this MoniTag');

    // Verify PIN by attempting decryption
    const decrypted = await sendMsg({ type: 'DECRYPT_KEY', payload: { encryptedKey: encKey, pin } });
    if (!decrypted.success) throw new Error('Invalid PIN');

    // Save to storage
    await chrome.storage.local.set({
      monipay_wallet: {
        payTag: tag,
        address: profile.wallet_address || profile.wallet?.address,
        encryptedPrivateKey: encKey,
        profileId: profile.id,
        pinHash: await hashPin(pin),
        preferredMode: profile.preferred_mode || 'user',
        preferredNetwork: profile.preferred_network || 'base',
      },
      monipay_unlocked: true,
    });

    const stored = await chrome.storage.local.get(['monipay_wallet']);
    showDashboard(stored.monipay_wallet);

  } catch (e) {
    errEl.textContent = e.message || 'Sign in failed';
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
});

// ═══════════════════════════════════════
// LOCK / UNLOCK
// ═══════════════════════════════════════
$('#unlock-btn').addEventListener('click', async () => {
  const pin = $('#lock-pin').value;
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) return;

  if (!(await verifyPin(pin, stored.monipay_wallet.pinHash))) {
    alert('Invalid PIN'); return;
  }

  await chrome.storage.local.set({ monipay_unlocked: true });
  chrome.runtime.sendMessage({ type: 'GET_PENDING_PAYMENT' }, (resp) => {
    if (resp?.payment) showPayment(resp.payment);
    else showDashboard(stored.monipay_wallet);
  });
});

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function showDashboard(wallet) {
  showScreen('dashboard-screen');

  activeNetwork = wallet.preferredNetwork || 'base';
  updateNetworkUI();

  $('#dash-tag').textContent = `@${wallet.payTag}`;

  // Load balance
  await refreshBalance(wallet);
}

function updateNetworkUI() {
  $$('.net-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.net === activeNetwork);
  });
  const net = NETWORKS[activeNetwork];
  $('#dash-token').textContent = `${net.currency} on ${net.name}`;
  $('#send-currency').textContent = net.currency;
}

$$('.net-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    activeNetwork = btn.dataset.net;
    updateNetworkUI();
    const stored = await chrome.storage.local.get(['monipay_wallet']);
    if (stored.monipay_wallet) {
      // Update preference
      stored.monipay_wallet.preferredNetwork = activeNetwork;
      await chrome.storage.local.set({ monipay_wallet: stored.monipay_wallet });
      await refreshBalance(stored.monipay_wallet);
    }
  });
});

async function refreshBalance(wallet) {
  $('#dash-balance').textContent = '...';
  try {
    const res = await fetch(`${API}/relay-payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkApproval', message: { walletAddress: wallet.address }, network: activeNetwork }),
    });
    const data = await res.json();
    const net = NETWORKS[activeNetwork];
    const bal = Number(data.balance || 0) / (10 ** net.decimals);
    $('#dash-balance').textContent = `$${bal.toFixed(2)}`;
  } catch {
    $('#dash-balance').textContent = '$—';
  }
}

// Quick Actions
$('#action-send').addEventListener('click', () => {
  showScreen('send-screen');
  $('#send-recipient').value = '';
  $('#send-amount').value = '';
  $('#send-pin').value = '';
  $('#send-error').classList.add('hidden');
  $('#send-status').classList.add('hidden');
});

$('#action-receive').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) return;
  $('#receive-tag').textContent = `@${stored.monipay_wallet.payTag}`;
  $('#receive-addr').textContent = stored.monipay_wallet.address;
  showScreen('receive-screen');
});

$('#action-monibot').addEventListener('click', async () => {
  showScreen('monibot-screen');
  await loadMoniBotData();
});

$('#action-open-app').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://monipay.xyz' });
});

$('#refresh-btn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (stored.monipay_wallet) await refreshBalance(stored.monipay_wallet);
});

// Copy address
$('#copy-addr-btn').addEventListener('click', async () => {
  const addr = $('#receive-addr').textContent;
  await navigator.clipboard.writeText(addr);
  $('#addr-copy-status').classList.remove('hidden');
  setTimeout(() => $('#addr-copy-status').classList.add('hidden'), 2000);
});

// ═══════════════════════════════════════
// SEND
// ═══════════════════════════════════════
$('#send-confirm-btn').addEventListener('click', async () => {
  const recipient = $('#send-recipient').value.trim().toLowerCase();
  const amount = parseFloat($('#send-amount').value);
  const pin = $('#send-pin').value;
  const errEl = $('#send-error');
  const statusEl = $('#send-status');
  errEl.classList.add('hidden');
  statusEl.classList.add('hidden');

  if (!recipient) { errEl.textContent = 'Enter recipient MoniTag'; errEl.classList.remove('hidden'); return; }
  if (!amount || amount <= 0) { errEl.textContent = 'Enter a valid amount'; errEl.classList.remove('hidden'); return; }
  if (pin.length !== 4) { errEl.textContent = 'Enter your 4-digit PIN'; errEl.classList.remove('hidden'); return; }

  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!(await verifyPin(pin, stored.monipay_wallet?.pinHash))) {
    errEl.textContent = 'Invalid PIN'; errEl.classList.remove('hidden'); return;
  }

  const btn = $('#send-confirm-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    const result = await sendMsg({
      type: 'SEND_PAYMENT',
      payload: { pin, amount, recipientTag: recipient, network: activeNetwork },
    });

    if (result.success) {
      statusEl.className = 'status success';
      statusEl.textContent = `✓ Sent! TX: ${result.txHash?.slice(0, 14)}...`;
      statusEl.classList.remove('hidden');
      setTimeout(async () => {
        const s = await chrome.storage.local.get(['monipay_wallet']);
        showDashboard(s.monipay_wallet);
      }, 2000);
    } else {
      throw new Error(result.error || 'Payment failed');
    }
  } catch (e) {
    errEl.textContent = e.message; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Send';
  }
});

// ═══════════════════════════════════════
// MONIBOT
// ═══════════════════════════════════════
async function loadMoniBotData() {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) return;
  const w = stored.monipay_wallet;

  $('#allowance-network').textContent = NETWORKS[activeNetwork]?.name || 'Base';

  // Fetch allowance from profile
  try {
    const res = await fetch(`${API}/check-paytag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lookup', payTag: w.payTag }),
    });
    const data = await res.json();
    const allowance = data.profile?.bot_allowance_amount || 0;
    $('#allowance-value').textContent = `$${Number(allowance).toFixed(2)}`;

    // Social accounts
    const p = data.profile || {};
    updateSocialStatus('#social-x', p.x_username, p.x_verified);
    updateSocialStatus('#social-discord', p.discord_username);
    updateSocialStatus('#social-telegram', p.telegram_username);
  } catch {
    $('#allowance-value').textContent = '$—';
  }
}

function updateSocialStatus(selector, username, verified) {
  const el = $(selector);
  if (username) {
    el.textContent = `@${username}` + (verified ? ' ✓' : '');
    el.classList.add('linked');
  } else {
    el.textContent = 'Not linked';
    el.classList.remove('linked');
  }
}

$('#set-allowance-btn').addEventListener('click', async () => {
  const amount = parseFloat($('#allowance-input').value);
  const pin = $('#allowance-pin').value;
  const errEl = $('#allowance-error');
  const statusEl = $('#allowance-status');
  errEl.classList.add('hidden');
  statusEl.classList.add('hidden');

  if (isNaN(amount) || amount < 0) { errEl.textContent = 'Enter a valid amount'; errEl.classList.remove('hidden'); return; }
  if (pin.length !== 4) { errEl.textContent = 'Enter your PIN'; errEl.classList.remove('hidden'); return; }

  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!(await verifyPin(pin, stored.monipay_wallet?.pinHash))) {
    errEl.textContent = 'Invalid PIN'; errEl.classList.remove('hidden'); return;
  }

  const btn = $('#set-allowance-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Updating...';

  try {
    // Update allowance via edge function
    const res = await fetch(`${API}/check-paytag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateAllowance',
        payTag: stored.monipay_wallet.payTag,
        walletAddress: stored.monipay_wallet.address,
        allowanceAmount: amount,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    statusEl.className = 'status success';
    statusEl.textContent = `✓ Allowance updated to $${amount.toFixed(2)}`;
    statusEl.classList.remove('hidden');
    $('#allowance-value').textContent = `$${amount.toFixed(2)}`;
    $('#allowance-input').value = '';
    $('#allowance-pin').value = '';
  } catch (e) {
    errEl.textContent = e.message || 'Failed to update'; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Update Allowance';
  }
});

$('#link-socials-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://monipay.xyz' });
});

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════
$('#settings-btn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet) return;
  const w = stored.monipay_wallet;
  $('#settings-tag').textContent = `@${w.payTag}`;
  $('#settings-mode').textContent = w.preferredMode === 'merchant' ? 'Merchant' : 'Personal';
  $('#settings-network').textContent = NETWORKS[activeNetwork]?.name || 'Base';
  $('#settings-addr').textContent = w.address;
  showScreen('settings-screen');
});

$('#export-key-btn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!stored.monipay_wallet?.encryptedPrivateKey) return;
  await navigator.clipboard.writeText(stored.monipay_wallet.encryptedPrivateKey);
  alert('Encrypted key copied to clipboard.');
});

$('#lock-btn').addEventListener('click', async () => {
  await chrome.storage.local.set({ monipay_unlocked: false });
  $('#lock-pin').value = '';
  showScreen('lock-screen');
});

$('#disconnect-btn').addEventListener('click', async () => {
  if (confirm('Disconnect your wallet? You can import it again later with your MoniTag and PIN.')) {
    await chrome.storage.local.remove(['monipay_wallet', 'monipay_unlocked']);
    showScreen('welcome-screen');
  }
});

// ═══════════════════════════════════════
// PAYMENT CONFIRMATION (merchant-triggered)
// ═══════════════════════════════════════
function showPayment(payment) {
  showScreen('payment-screen');
  $('#pay-amount').textContent = `$${parseFloat(payment.amount).toFixed(2)}`;
  $('#pay-merchant').textContent = payment.merchant || 'Unknown';
  $('#pay-pin').value = '';
  $('#pay-status').classList.add('hidden');
}

$('#approve-btn').addEventListener('click', async () => {
  const pin = $('#pay-pin').value;
  if (pin.length !== 4) { alert('Enter your 4-digit PIN'); return; }

  const stored = await chrome.storage.local.get(['monipay_wallet']);
  if (!(await verifyPin(pin, stored.monipay_wallet?.pinHash))) { alert('Invalid PIN'); return; }

  const btn = $('#approve-btn');
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;
  $('#reject-btn').disabled = true;

  chrome.runtime.sendMessage({
    type: 'APPROVE_PAYMENT',
    payload: {
      pin,
      amount: parseFloat($('#pay-amount').textContent.replace('$', '')),
      recipientTag: $('#pay-merchant').textContent,
    },
  }, (resp) => {
    const status = $('#pay-status');
    status.classList.remove('hidden');
    if (resp?.success) {
      status.className = 'status success';
      status.textContent = `✓ Paid! TX: ${resp.txHash?.slice(0, 14)}...`;
      setTimeout(() => window.close(), 2000);
    } else {
      status.className = 'status error';
      status.textContent = `✗ ${resp?.error || 'Payment failed'}`;
      btn.textContent = 'Pay'; btn.disabled = false; $('#reject-btn').disabled = false;
    }
  });
});

$('#reject-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'REJECT_PAYMENT' });
  window.close();
});

// ═══════════════════════════════════════
// CRYPTO HELPERS
// ═══════════════════════════════════════
async function hashPin(pin) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(pin));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPin(pin, storedHash) {
  return (await hashPin(pin)) === storedHash;
}

// Helper to send messages to background script
function sendMsg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp || { success: false, error: 'No response' }));
  });
}

// ─── Start ───
init();
