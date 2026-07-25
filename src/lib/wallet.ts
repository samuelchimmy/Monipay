import { 
  generatePrivateKey, 
  privateKeyToAccount,
  type PrivateKeyAccount 
} from 'viem/accounts';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { celo } from 'viem/chains';
import { CHAIN_CONFIGS, type SupportedNetwork, type EvmNetwork } from '@/config/chains';
import { getActiveRpc } from '@/components/monibot/SystemTab';
import { getCeloUsdtBalance, getCeloTokenBalance } from '@/lib/celoWallet';

// Celo USDT (MoniPay's settlement token) + core contract addresses.
const USDC_ADDRESS = CHAIN_CONFIGS.celo.token;
const PLATFORM_ADDRESS = '0xfa2B8eD012f756E22E780B772d604af4575d5fcf' as const; // MoniPay Treasury
const MONIPAY_ROUTER_ADDRESS = CHAIN_CONFIGS.celo.monipayRouter as `0x${string}`;

// AES-GCM encryption constants
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

// Derive AES key from PIN using PBKDF2
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  
  // Import PIN as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Encrypt private key using AES-GCM
export async function encryptPrivateKeyAsync(privateKey: string, pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive key from PIN
  const key = await deriveKey(pin, salt);
  
  // Encrypt data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Return as base64 with version prefix for future compatibility
  return 'v2:' + bufferToBase64(combined.buffer);
}

// Decrypt private key using AES-GCM
export async function decryptPrivateKeyAsync(encrypted: string, pin: string): Promise<string> {
  // Check for version prefix
  if (encrypted.startsWith('v2:')) {
    // New AES-GCM format
    const data = base64ToBuffer(encrypted.slice(3));
    
    // Extract salt, iv, and encrypted data
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encryptedData = data.slice(SALT_LENGTH + IV_LENGTH);
    
    // Derive key from PIN
    const key = await deriveKey(pin, salt);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } else {
    // Legacy XOR format - for backwards compatibility
    return decryptPrivateKeyLegacy(encrypted, pin);
  }
}

// Legacy XOR decryption for backwards compatibility
const LEGACY_ENCRYPTION_KEY = 'MoniPay2024BaseChain';

function decryptPrivateKeyLegacy(encrypted: string, pin: string): string {
  const combined = LEGACY_ENCRYPTION_KEY + pin;
  const decoded = atob(encrypted);
  let decrypted = '';
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i) ^ combined.charCodeAt(i % combined.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

// Synchronous wrapper for encrypt (for backwards compatibility during transition)
export function encryptPrivateKey(privateKey: string, pin: string): string {
  // For new encryptions, we'll use a synchronous approach that still provides
  // better security than XOR, but the async version should be preferred
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Simple but more secure synchronous encryption using crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  const pinData = encoder.encode(pin);
  
  // Create a simple key derivation
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = salt[i % salt.length] ^ pinData[i % pinData.length] ^ (i * 17);
  }
  
  // XOR with derived key (better than simple XOR with pin)
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
  }
  
  // Combine salt + iv + encrypted
  const combined = new Uint8Array(salt.length + iv.length + encrypted.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(encrypted, salt.length + iv.length);
  
  return 'v1:' + bufferToBase64(combined.buffer);
}

// Synchronous wrapper for decrypt (handles both v1 and legacy formats)
export function decryptPrivateKey(encrypted: string, pin: string): string {
  if (encrypted.startsWith('v2:')) {
    // v2 requires async - this shouldn't happen in sync context
    throw new Error('v2 encryption requires async decryption');
  }
  
  if (encrypted.startsWith('v1:')) {
    // v1 format with salt + iv
    const data = base64ToBuffer(encrypted.slice(3));
    
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encryptedData = data.slice(SALT_LENGTH + IV_LENGTH);
    
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    
    // Recreate key derivation
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      keyBytes[i] = salt[i % salt.length] ^ pinData[i % pinData.length] ^ (i * 17);
    }
    
    // Decrypt
    const decrypted = new Uint8Array(encryptedData.length);
    for (let i = 0; i < encryptedData.length; i++) {
      decrypted[i] = encryptedData[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
    }
    
    return new TextDecoder().decode(decrypted);
  }
  
  // Legacy format
  return decryptPrivateKeyLegacy(encrypted, pin);
}

export function generateWallet(): { privateKey: `0x${string}`; address: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
  };
}

export function getAccountFromPrivateKey(privateKey: `0x${string}`): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}

// EIP-712 Typed Data for Payment Authorization
export const PAYMENT_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'fee', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function getDomain(network: SupportedNetwork = 'celo', verifyingContractOverride?: `0x${string}`) {
  const config = CHAIN_CONFIGS[network as EvmNetwork];
  return {
    name: 'MoniPay Router',
    version: '1',
    chainId: config.id,
    verifyingContract: verifyingContractOverride || (config.monipayRouter as `0x${string}`),
  };
}

export const DOMAIN = getDomain('celo');

export interface PaymentMessage {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  fee: bigint;
  nonce: bigint;
  deadline: bigint;
}

// Abstract signer used by the unified write-path. Implemented by both the
// legacy `privateKeyToAccount` path and wagmi `walletClient` for wallet-only
// (Path B/C) sessions. Lets callers sign payment authorizations without
// holding a decrypted private key.
export interface TypedDataSigner {
  address: `0x${string}`;
  signTypedData: (args: {
    domain: any;
    types: any;
    primaryType: any;
    message: any;
  }) => Promise<`0x${string}`>;
}

export async function signPaymentAuthorizationWithSigner(
  signer: TypedDataSigner,
  merchantAddress: `0x${string}`,
  amountUsdc: number,
  feeUsdc: number,
  nonce: bigint,
  network: SupportedNetwork = 'celo',
  decimalsOverride?: number,
  verifyingContractOverride?: `0x${string}`
): Promise<{ signature: string; message: PaymentMessage }> {
  const config = CHAIN_CONFIGS[network as EvmNetwork];
  const decimals = decimalsOverride !== undefined ? decimalsOverride : config.decimals;

  const amountRaw = parseUnits(amountUsdc.toFixed(decimals), decimals);
  const explicitFeeRaw = parseUnits(feeUsdc.toFixed(decimals), decimals);
  const feeRaw = explicitFeeRaw > 0n ? explicitFeeRaw : amountRaw / 100n;

  const message: PaymentMessage = {
    from: signer.address,
    to: merchantAddress,
    amount: amountRaw,
    fee: feeRaw,
    nonce,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };

  const domain = getDomain(network, verifyingContractOverride);
  const signature = await signer.signTypedData({
    domain,
    types: { PaymentAuthorization: PAYMENT_TYPES.PaymentAuthorization },
    primaryType: 'PaymentAuthorization',
    message,
  });

  return { signature, message };
}

export async function signPaymentAuthorization(
  privateKey: `0x${string}`,
  merchantAddress: `0x${string}`,
  amountUsdc: number,
  feeUsdc: number,
  nonce: bigint,
  network: SupportedNetwork = 'celo',
  decimalsOverride?: number,
  verifyingContractOverride?: `0x${string}`
): Promise<{ signature: string; message: PaymentMessage }> {
  const account = privateKeyToAccount(privateKey);
  return signPaymentAuthorizationWithSigner(
    {
      address: account.address,
      signTypedData: (args) => account.signTypedData(args as any),
    },
    merchantAddress,
    amountUsdc,
    feeUsdc,
    nonce,
    network,
    decimalsOverride,
    verifyingContractOverride
  );
}

// Fetch the next available nonce for a user from the relay-payment edge function
export async function getPaymentNonce(walletAddress: string, network: SupportedNetwork = 'celo'): Promise<bigint> {
  const functionName = 'relay-payment-celo';
  const response = await fetch(
    `https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getNonce',
        message: { walletAddress },
        network,
      }),
    }
  );
  
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error(`[getPaymentNonce] ${network} failed (${response.status}):`, errBody);
    throw new Error(`Failed to fetch payment nonce on ${network}`);
  }
  
  const data = await response.json();
  console.log(`[getPaymentNonce] ${network} nonce for ${walletAddress}:`, data.nonce);
  return BigInt(data.nonce);
}

// Check token approval status for the MoniPayRouter
export async function checkUsdcApproval(
  walletAddress: string,
  network: SupportedNetwork = 'celo',
  tokenAddress?: string,
  routerAddress?: string,
  decimals?: number,
  tokenSymbol?: string
): Promise<{
  allowance: bigint;
  balance: bigint;
  hasUnlimitedApproval: boolean;
  routerAddress: string;
}> {
  // Celo uses its own dedicated relay function
  const functionName = 'relay-payment-celo';
  try {
    const response = await fetch(
      `https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkApproval',
          message: { walletAddress },
          network,
          tokenAddress,
          routerAddress,
          decimals,
          tokenSymbol,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to check approval');
    }
    
    const data = await response.json();
    return {
      allowance: BigInt(data.allowance),
      balance: BigInt(data.balance),
      hasUnlimitedApproval: data.hasUnlimitedApproval,
      routerAddress: data.routerAddress,
    };
  } catch (error) {
    console.error('Failed to check approval:', error);
    return {
      allowance: BigInt(0),
      balance: BigInt(0),
      hasUnlimitedApproval: false,
      routerAddress: routerAddress || MONIPAY_ROUTER_ADDRESS,
    };
  }
}

// Create Base client for reading blockchain data
export const baseClient = createPublicClient({
  chain: celo,
  transport: http(),
});

const BALANCE_CACHE_PREFIX = 'monipay_usdc_balance:';
const RPC_HEALTH_KEY = 'monipay_rpc_health';
const RPC_OVERRIDE_KEY = 'monipay_rpc_override';

// Default RPC endpoints in order of preference (Celo)
const DEFAULT_RPC_ENDPOINTS = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://1rpc.io/celo',
] as const;

// Get the current RPC endpoints for Celo (may include admin override)
function getRpcEndpoints(): readonly string[] {
  const adminRpc = getActiveRpc('celo');
  const override = getRpcOverride();
  const baseUrls = [...CHAIN_CONFIGS.celo.rpcUrls];

  // Admin RPC takes priority, then override, then defaults
  const priority = adminRpc || override;
  if (priority) {
    return [priority, ...baseUrls.filter(ep => ep !== priority)];
  }
  return baseUrls;
}

// RPC Override management (for admin control)
export function getRpcOverride(): string | null {
  try {
    return localStorage.getItem(RPC_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function setRpcOverride(endpoint: string | null): void {
  try {
    if (endpoint) {
      localStorage.setItem(RPC_OVERRIDE_KEY, endpoint);
    } else {
      localStorage.removeItem(RPC_OVERRIDE_KEY);
    }
    // Clear health tracking when override changes
    localStorage.removeItem(RPC_HEALTH_KEY);
  } catch {
    // ignore
  }
}

export function getAvailableRpcEndpoints(): readonly string[] {
  return DEFAULT_RPC_ENDPOINTS;
}

type BalanceCache = {
  balance: number;
  updatedAt: number;
};

type RpcHealth = {
  failedEndpoints: Record<string, number>; // endpoint -> failure timestamp
  lastHealthyEndpoint: string | null;
};

function getRpcHealth(): RpcHealth {
  try {
    const raw = localStorage.getItem(RPC_HEALTH_KEY);
    if (!raw) return { failedEndpoints: {}, lastHealthyEndpoint: null };
    return JSON.parse(raw) as RpcHealth;
  } catch {
    return { failedEndpoints: {}, lastHealthyEndpoint: null };
  }
}

function setRpcHealth(health: RpcHealth) {
  try {
    localStorage.setItem(RPC_HEALTH_KEY, JSON.stringify(health));
  } catch {
    // ignore
  }
}

function markEndpointFailed(endpoint: string) {
  const health = getRpcHealth();
  health.failedEndpoints[endpoint] = Date.now();
  setRpcHealth(health);
}

function markEndpointHealthy(endpoint: string) {
  const health = getRpcHealth();
  delete health.failedEndpoints[endpoint];
  health.lastHealthyEndpoint = endpoint;
  setRpcHealth(health);
}

function getOrderedEndpoints(): readonly string[] {
  const endpoints = getRpcEndpoints();
  const health = getRpcHealth();
  const now = Date.now();
  const COOLDOWN_MS = 60_000; // 1 minute cooldown for failed endpoints

  // Filter out endpoints that failed recently
  const available = endpoints.filter((ep) => {
    const failedAt = health.failedEndpoints[ep];
    return !failedAt || now - failedAt > COOLDOWN_MS;
  });

  // If we have a known healthy endpoint, try it first
  if (
    health.lastHealthyEndpoint &&
    available.includes(health.lastHealthyEndpoint)
  ) {
    const rest = available.filter((ep) => ep !== health.lastHealthyEndpoint);
    return [health.lastHealthyEndpoint, ...rest];
  }

  return available.length > 0 ? available : [...endpoints]; // fallback to all if all are on cooldown
}

function getCachedBalance(address: string): number | null {
  try {
    const raw = localStorage.getItem(`${BALANCE_CACHE_PREFIX}${address.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BalanceCache;
    if (typeof parsed?.balance !== 'number') return null;
    return parsed.balance;
  } catch {
    return null;
  }
}

function setCachedBalance(address: string, balance: number) {
  try {
    const payload: BalanceCache = { balance, updatedAt: Date.now() };
    localStorage.setItem(`${BALANCE_CACHE_PREFIX}${address.toLowerCase()}`, JSON.stringify(payload));
  } catch {
    // ignore cache failures
  }
}

async function fetchTokenBalanceFromEndpoint(
  endpoint: string,
  address: `0x${string}`,
  tokenAddress: `0x${string}`,
  decimals: number
): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data: `0x70a08231000000000000000000000000${address.slice(2)}`,
          },
          'latest',
        ],
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data?.error) {
      throw new Error(`RPC error: ${data.error?.message || 'unknown'}`);
    }

    if (typeof data?.result !== 'string') {
      throw new Error('RPC missing result');
    }

    const raw = data.result === '0x' ? '0x0' : data.result;
    const balance = BigInt(raw);
    return parseFloat(formatUnits(balance, decimals));
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function fetchBalanceFromEndpoint(endpoint: string, address: `0x${string}`): Promise<number> {
  return fetchTokenBalanceFromEndpoint(endpoint, address, USDC_ADDRESS, 6);
}

/**
 * Returns the USDC balance with automatic RPC failover (Celo).
 */
export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  const endpoints = getOrderedEndpoints();

  for (const endpoint of endpoints) {
    try {
      const balance = await fetchBalanceFromEndpoint(endpoint, address);

      // Success - mark healthy and cache
      markEndpointHealthy(endpoint);
      if (Number.isFinite(balance)) setCachedBalance(address, balance);

      return balance;
    } catch (error) {
      console.warn(`RPC ${endpoint} failed:`, error);
      markEndpointFailed(endpoint);
      // Continue to next endpoint
    }
  }

  // All endpoints failed - return cached or NaN
  console.error('All RPC endpoints failed for balance fetch');
  const cached = getCachedBalance(address);
  return cached ?? Number.NaN;
}

const BALANCE_CACHE_TTL = 30_000;
const balanceCache = new Map<string, { value: number; timestamp: number }>();

export async function getTokenBalance(
  address: `0x${string}`,
  network: SupportedNetwork = 'celo'
): Promise<number> {
  const cacheKey = `${network}:${address.toLowerCase()}`;
  const cached = balanceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
    return cached.value;
  }

  let balance: number;
  try {
    const [usdt, usdc, usdm, g$] = await Promise.all([
      getCeloTokenBalance(address, '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', 6),
      getCeloTokenBalance(address, '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', 6),
      getCeloTokenBalance(address, '0x765DE816845861e75A25fCA122bb6898B8B1282a', 18),
      getCeloTokenBalance(address, '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', 18),
    ]);

    let g$Price = 0.00018;
    try {
      const res = await fetch("https://api.coingecko.com/v3/simple/price?ids=gooddollar&vs_currencies=usd");
      if (res.ok) {
        const json = await res.json();
        const price = json.gooddollar?.usd;
        if (Number.isFinite(price) && price > 0) {
          g$Price = price;
        }
      }
    } catch (e) {
      console.warn('[Celo] Failed to fetch G$ price for portfolio balance:', e);
    }

    const usdtVal = Number.isFinite(usdt) ? usdt : 0;
    const usdcVal = Number.isFinite(usdc) ? usdc : 0;
    const usdmVal = Number.isFinite(usdm) ? usdm : 0;
    const g$Val = Number.isFinite(g$) ? g$ : 0;

    balance = usdtVal + usdcVal + usdmVal + (g$Val * g$Price);
  } catch (e) {
    console.warn('[Celo] Failed to calculate aggregate Celo portfolio balance:', e);
    balance = await getCeloUsdtBalance(address);
  }

  if (Number.isFinite(balance)) {
    balanceCache.set(cacheKey, { value: balance, timestamp: Date.now() });
  }

  return balance;
}

/** Invalidate balance cache for a specific address/network (call after payments) */
export function invalidateBalanceCache(address?: string, network?: string) {
  if (address && network) {
    balanceCache.delete(`${network}:${address.toLowerCase()}`);
  } else {
    balanceCache.clear();
  }
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Returns the ETH balance for an address (for checking activation funding).
 * Uses the first available RPC endpoint.
 */
export async function getEthBalance(address: `0x${string}`): Promise<number> {
  const endpoints = getOrderedEndpoints();

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json();
      if (data?.error || typeof data?.result !== 'string') continue;

      const raw = data.result === '0x' ? '0x0' : data.result;
      const balance = BigInt(raw);
      return parseFloat(formatUnits(balance, 18)); // ETH has 18 decimals
    } catch {
      continue;
    }
  }

  return 0;
}

/**
 * Check token approval (allowance) for a specific network via direct RPC call.
 * Works for both Base (USDC) and BSC (USDT).
 */
export async function checkApprovalForNetwork(
  walletAddress: string,
  network: SupportedNetwork = 'celo'
): Promise<{ allowance: bigint; isActivated: boolean }> {
  // Celo — direct RPC with Celo endpoints
  if (network === 'celo') {
    const config = CHAIN_CONFIGS[network as EvmNetwork];
    const tokenAddress = config.token;
    const routerAddress = config.monipayRouter;

    if (!routerAddress) {
      return { allowance: BigInt(0), isActivated: false };
    }

    const ownerPadded = walletAddress.slice(2).toLowerCase().padStart(64, '0');
    const spenderPadded = routerAddress.slice(2).toLowerCase().padStart(64, '0');
    const callData = `0xdd62ed3e${ownerPadded}${spenderPadded}`;

    for (const endpoint of config.rpcUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: tokenAddress, data: callData }, 'latest'],
            id: 1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.error || typeof data?.result !== 'string') continue;

        const raw = data.result === '0x' ? '0x0' : data.result;
        const allowance = BigInt(raw);
        return { allowance, isActivated: allowance > BigInt(0) };
      } catch {
        continue;
      }
    }
    return { allowance: BigInt(0), isActivated: false };
  }

  const config = CHAIN_CONFIGS[network as EvmNetwork];
  const tokenAddress = config.token;
  const routerAddress = config.monipayRouter;

  if (!routerAddress) {
    return { allowance: BigInt(0), isActivated: false };
  }

  // ERC20 allowance(address owner, address spender) selector = 0xdd62ed3e
  const ownerPadded = walletAddress.slice(2).toLowerCase().padStart(64, '0');
  const spenderPadded = routerAddress.slice(2).toLowerCase().padStart(64, '0');
  const callData = `0xdd62ed3e${ownerPadded}${spenderPadded}`;

  const endpoints = config.rpcUrls;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: tokenAddress, data: callData }, 'latest'],
          id: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) continue;

      const data = await response.json();
      if (data?.error || typeof data?.result !== 'string') continue;

      const raw = data.result === '0x' ? '0x0' : data.result;
      const allowance = BigInt(raw);
      return { allowance, isActivated: allowance > BigInt(0) };
    } catch {
      continue;
    }
  }

  return { allowance: BigInt(0), isActivated: false };
}

export { USDC_ADDRESS, PLATFORM_ADDRESS, MONIPAY_ROUTER_ADDRESS };
