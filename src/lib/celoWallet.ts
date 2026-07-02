/**
 * celoWallet.ts — NEW FILE
 * Location: src/lib/celoWallet.ts
 *
 * All Celo-specific blockchain utilities for the MiniPay integration.
 * Kept completely separate from wallet.ts so Base/BSC/Tempo/Solana
 * flows are never touched.
 *
 * Token: USDT on Celo Mainnet (0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e)
 * Decimals: 6
 * Router: MoniPayRouter on Celo (0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0)
 * Chain ID: 42220
 *
 * MiniPay tx requirements:
 *   - Legacy transaction format (no EIP-1559 fields)
 *   - feeCurrency = USDm (0x765DE816845861e75A25fCA122bb6898B8B1282a)
 *     so users pay gas in stablecoin, not CELO
 */

import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
  type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Celo addresses ───────────────────────────────────────────────────────────

/** USDT on Celo Mainnet — 6 decimals */
export const CELO_USDT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;

const isV2 = import.meta.env.VITE_USE_V2_CONTRACTS === 'true';

/** MoniPayRouter deployed on Celo Mainnet */
export const CELO_MONIPAY_ROUTER = (isV2 
  ? '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' 
  : '0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0') as `0x${string}`;

/** MoniBotRouter deployed on Celo Mainnet */
export const CELO_MONIBOT_ROUTER = (isV2
  ? '0x8768aCE3FCd925e9BD61808b90905a935697e227'
  : '0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e') as `0x${string}`;

/** USDm — used as feeCurrency so users pay gas in stablecoin (MiniPay requirement) */
export const CELO_FEE_CURRENCY = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const;

/** MoniPay platform treasury */
export const CELO_TREASURY = '0xDC9B47551734bE984D7Aa2a365251E002f8FF2D7' as const;

/** Token decimals — USDT on Celo is 6 (same as USDC) */
export const CELO_TOKEN_DECIMALS = 6;

/** Celo chain ID in hex — used for wallet_switchEthereumChain */
export const CELO_CHAIN_ID_HEX = '0xa4ec';

// ─── Public RPC client (read-only) ───────────────────────────────────────────

export const celoPublicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

// ─── EIP-712 domain — must match the deployed MoniPayRouter exactly ───────────

export function getCeloDomain() {
  return {
    name: 'MoniPay Router',
    version: '1',
    chainId: 42220,
    verifyingContract: CELO_MONIPAY_ROUTER,
  };
}

// ─── Balance ─────────────────────────────────────────────────────────────────

/**
 * Fetch USDT balance on Celo for a given address.
 * Returns a human-readable number (e.g. 12.50 for 12.50 USDT).
 * Falls back to localStorage cache on RPC failure.
 */
export async function getCeloUsdtBalance(address: `0x${string}`): Promise<number> {
  const CACHE_KEY = `monipay_celo_usdt_balance:${address.toLowerCase()}`;

  try {
    const raw = await (celoPublicClient as any).readContract({
      address: CELO_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });

    const balance = parseFloat(formatUnits(raw, CELO_TOKEN_DECIMALS));

    // Cache for 30s
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ balance, updatedAt: Date.now() }));
    } catch { /* ignore */ }

    return balance;
  } catch (err) {
    console.warn('[Celo] Balance fetch failed, trying cache:', err);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { balance } = JSON.parse(cached);
        if (typeof balance === 'number') return balance;
      }
    } catch { /* ignore */ }
    return NaN;
  }
}

// ─── Approval ────────────────────────────────────────────────────────────────

/**
 * Check how much USDT the user has approved to the MoniPayRouter on Celo.
 */
export async function getCeloUsdtAllowance(walletAddress: `0x${string}`): Promise<{
  allowance: bigint;
  balance: bigint;
  hasUnlimitedApproval: boolean;
}> {
  const [allowance, balance] = await Promise.all([
    (celoPublicClient as any).readContract({
      address: CELO_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, CELO_MONIPAY_ROUTER],
    }),
    (celoPublicClient as any).readContract({
      address: CELO_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    }),
  ]);

  return {
    allowance,
    balance,
    hasUnlimitedApproval: allowance > BigInt('0xffffffffffffffffffffffff'),
  };
}

/**
 * Build the calldata for approving the MoniPayRouter to spend USDT.
 * Returns the encoded calldata — caller sends it via window.ethereum.
 *
 * Approves the maximum uint256 value (unlimited) so users only need
 * to approve once, same pattern as Base/BSC.
 */
export function buildCeloApprovalCalldata(): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [CELO_MONIPAY_ROUTER, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
  });
}

/**
 * Send an approval transaction for USDT → MoniPayRouter on Celo.
 * Uses MiniPay's injected wallet (window.ethereum).
 * Returns the transaction hash.
 */
export async function approveCeloUsdt(walletAddress: `0x${string}`): Promise<`0x${string}`> {
  const eth = (window as any).ethereum;
  if (!eth?.isMiniPay) throw new Error('Not running inside MiniPay');

  const calldata = buildCeloApprovalCalldata();

  const txHash: `0x${string}` = await eth.request({
    method: 'eth_sendTransaction',
    params: [{
      from:        walletAddress,
      to:          CELO_USDT_ADDRESS,    // calling the USDT token contract
      data:        calldata,
      feeCurrency: CELO_FEE_CURRENCY,   // pay gas in USDm — MiniPay requirement
      // No maxFeePerGas / maxPriorityFeePerGas — legacy tx format required
    }],
  });

  return txHash;
}

/**
 * Send an approval transaction for a given token → router on Celo
 * using a local private key (for the normal app, outside MiniPay).
 */
export async function approveCeloTokenWithKey(
  privateKey: `0x${string}`,
  tokenAddress: `0x${string}`,
  routerAddress: `0x${string}`
): Promise<`0x${string}`> {
  const { createWalletClient } = await import('viem');

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http('https://forno.celo.org'),
  });

  const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [routerAddress, maxApproval],
    chain: celo,
    account,
  });

  return hash;
}

/**
 * Alias for approveCeloTokenWithKey (legacy).
 */
export async function approveCeloUsdtWithKey(privateKey: `0x${string}`): Promise<`0x${string}`> {
  return approveCeloTokenWithKey(privateKey, CELO_USDT_ADDRESS, CELO_MONIPAY_ROUTER);
}

// ─── EIP-712 signing ─────────────────────────────────────────────────────────

const PAYMENT_TYPES = {
  PaymentAuthorization: [
    { name: 'from',     type: 'address' },
    { name: 'to',       type: 'address' },
    { name: 'amount',   type: 'uint256' },
    { name: 'fee',      type: 'uint256' },
    { name: 'nonce',    type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * Sign a PaymentAuthorization for the Celo MoniPayRouter using the
 * user's decrypted private key (same pattern as signPaymentAuthorization
 * in wallet.ts for Base/BSC).
 */
export async function signCeloPaymentAuthorization(
  privateKey: `0x${string}`,
  to: `0x${string}`,
  amountUsdt: number,   // human-readable, e.g. 5.50
  feeUsdt: number,       // human-readable, e.g. 0.055
  nonce: bigint,
): Promise<{ signature: `0x${string}`; message: {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  fee: bigint;
  nonce: bigint;
  deadline: bigint;
}}> {
  const account = privateKeyToAccount(privateKey);

  const message = {
    from:     account.address,
    to,
    amount:   parseUnits(amountUsdt.toFixed(CELO_TOKEN_DECIMALS), CELO_TOKEN_DECIMALS),
    fee:      parseUnits(feeUsdt.toFixed(CELO_TOKEN_DECIMALS),    CELO_TOKEN_DECIMALS),
    nonce,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
  };

  const signature = await account.signTypedData({
    domain: getCeloDomain(),
    types:  PAYMENT_TYPES,
    primaryType: 'PaymentAuthorization',
    message,