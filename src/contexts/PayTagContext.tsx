import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generateWallet, encryptPrivateKey, decryptPrivateKey, getTokenBalance, getAccountFromPrivateKey, invalidateBalanceCache } from '@/lib/wallet';
import type { SupportedNetwork } from '@/config/chains';

// MoniPay is Celo-only. Solana wallet generation was removed; these dead
// code paths (isSolanaMode is always false) keep a local no-op stub so they
// still type-check without the deleted wallet helper.
function generateSolanaWallet(): { solanaSecretKey: string; solanaAddress: string } {
  return { solanaSecretKey: '', solanaAddress: '' };
}
import { supabase } from '@/integrations/supabase/client';
import { notifyPaymentReceived } from '@/lib/notifications';
import { hashPin, verifyPinHash, isPinHashed } from '@/lib/pinHash';
import { useAccount } from 'wagmi';

export type AppMode = 'merchant' | 'user';
export type AppScreen = 'lock' | 'onboarding' | 'dashboard';

interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  solanaAddress?: string;
  encryptedSolanaKey?: string;
}

export interface UserProfile {
  id?: string; // Supabase profile ID
  payTag: string;
  pin: string;
  preferredMode: AppMode;
  preferredNetwork: SupportedNetwork;
  balance: number;
  merchantBalance: number;
  wallet: WalletData;
}

export interface TransactionMetadata {
  monibot_type?: 'p2p' | 'grant';
  tweet_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  network?: SupportedNetwork;
}

export interface Transaction {
  id: string;
  type: 'sent' | 'received';
  amount: number;
  fee: number;
  counterparty: string;
  timestamp: number;
  txHash?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  invoiceId?: string;
  payerPayTag?: string;
  source?: 'p2p' | 'payment_link' | 'online_order' | 'invoice' | 'external' | 'withdrawal' | 'monibot_p2p' | 'monibot_grant';
  metadata?: TransactionMetadata;
}

interface PayTagContextType {
  // App State
  currentScreen: AppScreen;
  setCurrentScreen: (screen: AppScreen) => void;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  updatePreferredMode: (mode: AppMode) => Promise<void>;
  setPreferredNetwork: (network: SupportedNetwork) => Promise<void>;
  isUnlocked: boolean;
  setIsUnlocked: (unlocked: boolean) => void;
  isTempoMode: boolean;
  isCeloMode: boolean;
  isSolanaMode: boolean;
  /** True when the active session is wallet-only (Path B/C) — no PIN, no
   *  encrypted key. `profile` is synthesized from `wallet_profiles`.
   *  Write paths (send, withdraw, invoice create) MUST self-gate on this
   *  and route signing through the injected wallet, not `decryptedPrivateKey`. */
  isWalletOnly: boolean;
  
  // User Profile
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  
  // Wallet readiness flags
  /** EVM wallet has both address + encrypted private key */
  evmReady: boolean;
  /** Solana wallet has both solanaAddress + encryptedSolanaKey */
  solanaReady: boolean;
  /** Whether the active network's wallet is ready for signing */
  activeNetworkReady: boolean;
  /** Repair a broken Solana wallet (address-only, no key) by generating fresh keys */
  repairSolanaWallet: (pin: string) => Promise<boolean>;
  
  // Wallet
  decryptedPrivateKey: `0x${string}` | null;
  decryptedSolanaKey: string | null;
  generatedPrivateKey: string | null;
  clearGeneratedKey: () => void;
  refreshBalance: (networkOverride?: SupportedNetwork) => Promise<void>;
  /** Returns the active wallet address for the current network (Solana Base58 or EVM 0x) */
  getActiveAddress: () => string;
  /** Decrypt Solana key on-demand with raw PIN (for lazy unlock) */
  unlockSolanaKey: (rawPin: string) => boolean;
  
  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'timestamp'>) => void;
  syncTransactions: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  hasMoreTransactions: boolean;
  isLoadingMore: boolean;
  
  // Actions
  verifyPin: (pin: string) => Promise<boolean>;
  createProfile: (payTag: string, pin: string, preferredMode: AppMode) => Promise<boolean>;
  importWallet: (privateKey: string, pin: string) => Promise<{ success: boolean; error?: string; profileId?: string; walletAddress?: string }>;
  updateBalance: (amount: number, type: 'deduct' | 'add', isMerchant?: boolean) => void;
  
  // Supabase sync
  checkPayTagAvailable: (payTag: string) => Promise<{ available: boolean; reserved: boolean }>;
  lookupPayTag: (payTag: string) => Promise<{ walletAddress: string; solanaAddress?: string; payTag: string } | null>;
}

const PayTagContext = createContext<PayTagContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROFILE: 'paytag_profile',
  TRANSACTIONS: 'paytag_transactions',
};

const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

interface PayTagProviderProps {
  children: ReactNode;
  defaultNetwork?: SupportedNetwork;
}

export function PayTagProvider({ children, defaultNetwork }: PayTagProviderProps) {
  const isCeloMode = defaultNetwork === 'celo';
  // Celo-only: these remain exposed for API compatibility but are always false.
  const isTempoMode = false;
  const isSolanaMode = false;
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('lock');
  const [mode, setMode] = useState<AppMode>('user');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isWalletOnly, setIsWalletOnly] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState<`0x${string}` | null>(null);
  const [decryptedSolanaKey, setDecryptedSolanaKey] = useState<string | null>(null);
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(null);
  const [txCursor, setTxCursor] = useState<string | null>(null);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const clearGeneratedKey = () => {
    setGeneratedPrivateKey(null);
  };

  const hydrateSolanaWalletData = async (walletAddress: string): Promise<{
    solanaAddress: string | null;
    encryptedSolanaKey: string | null;
  }> => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', walletAddress }),
      });

        if (!response.ok) {
          return { solanaAddress: null, encryptedSolanaKey: null };
        }

        const data = await response.json();
        return {
          solanaAddress: data?.profile?.solanaAddress || null,
          encryptedSolanaKey: data?.profile?.encryptedSolanaKey || null,
        };
    } catch (error) {
      console.error('Failed to hydrate Solana wallet data:', error);
      return { solanaAddress: null, encryptedSolanaKey: null };
    }
  };

  // persistEncryptedSolanaKey removed — Solana key is localStorage-only (Option B)

  // Load from localStorage on mount (fallback for offline)
  useEffect(() => {
    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    const savedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      const normalizedProfile = {
        ...parsed,
        preferredNetwork: (
          isCeloMode ? 'celo'
          : (parsed?.preferredNetwork || 'celo')
        ) as SupportedNetwork,
      } as UserProfile;

      setProfile(normalizedProfile);
      setMode(normalizedProfile.preferredMode);
      setCurrentScreen('lock');
    } else {
      setCurrentScreen('onboarding');
      setIsUnlocked(true);
    }
    
    if (savedTx) {
      setTransactions(JSON.parse(savedTx));
    }
  }, []);

  // ── Wallet-only bridge (Path B/C) ───────────────────────────────────────
  // When wagmi reports a connected wallet and there's no legacy profile in
  // localStorage, synthesize a read-only `profile` from `wallet_profiles` so
  // existing screens (TransactionHistory, Profile views, Storefront viewer,
  // ReceiveQR, etc.) work without a PIN or encrypted key.
  //
  // Write paths still gate on `evmReady` (which stays false here because
  // `encryptedPrivateKey` is empty) and/or the new `isWalletOnly` flag.
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  useEffect(() => {
    const hasLegacy = !!localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (hasLegacy) return;
    if (!wagmiConnected || !wagmiAddress) return;
    if (profile) return; // already hydrated (e.g. by legacy load)

    let cancelled = false;
    (async () => {
      try {
        const lower = wagmiAddress.toLowerCase();
        const upsert = await supabase.functions.invoke('wallet-session', {
          body: { action: 'upsert', walletAddress: lower, source: 'external_wallet' },
        });
        if (upsert.error) throw upsert.error;
        const data = upsert.data as {
          profileId: string;
          payTag: string | null;
          walletAddress: string;
          isLegacy: boolean;
          preferredNetwork: SupportedNetwork;
          preferredName?: string | null;
        };
        if (cancelled) return;

        const synthesized: UserProfile = {
          id: data.profileId,
          payTag: data.payTag || data.preferredName || lower.slice(0, 8),
          pin: '', // unused in wallet-only mode
          preferredMode: 'user',
          preferredNetwork: data.preferredNetwork ?? 'celo',
          balance: 0,
          merchantBalance: 0,
          wallet: {
            address: lower,
            encryptedPrivateKey: '', // signing routes through injected wallet
          },
        };

        setProfile(synthesized);
        setIsWalletOnly(!data.isLegacy);
        setIsUnlocked(true);
        setCurrentScreen('dashboard');
      } catch (err) {
        console.error('[PayTagContext] wallet-only bridge failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [wagmiAddress, wagmiConnected, profile]);

  // Persist profile changes locally
  useEffect(() => {
    if (profile) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    }
  }, [profile]);

  // Hydrate solana ADDRESS (not key) from DB on login — key stays localStorage-only
  useEffect(() => {
    if (!profile?.wallet?.address) return;
    if (profile.wallet.solanaAddress) return; // already have address

    void (async () => {
      const hydrated = await hydrateSolanaWalletData(profile.wallet.address);
      if (!hydrated.solanaAddress) return;

      setProfile((prev) => {
        if (!prev || prev.wallet.solanaAddress) return prev;
        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            solanaAddress: hydrated.solanaAddress || undefined,
            // DO NOT hydrate encryptedSolanaKey from DB — localStorage only
          },
        };
      });
    })();
  }, [profile?.wallet?.address, profile?.wallet?.solanaAddress]);

  // Persist transactions locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  // Check PayTag availability via edge function
  const checkPayTagAvailable = async (payTag: string): Promise<{ available: boolean; reserved: boolean }> => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', payTag: payTag.toLowerCase() }),
      });
      
      if (!response.ok) return { available: false, reserved: false };
      const data = await response.json();
      return { available: data.available === true, reserved: data.reserved === true };
    } catch (error) {
      console.error('Failed to check PayTag:', error);
      return { available: false, reserved: false };
    }
  };

  // Lookup PayTag to get wallet address
  const lookupPayTag = async (payTag: string): Promise<{ walletAddress: string; solanaAddress?: string; payTag: string } | null> => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', payTag: payTag.toLowerCase() }),
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      if (data.profile) {
        return {
          walletAddress: data.profile.wallet_address,
          solanaAddress: data.profile.solana_address || undefined,
          payTag: data.profile.pay_tag,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to lookup PayTag:', error);
      return null;
    }
  };

  // Sync transactions from Supabase (server-side merge with cursor pagination)
  const syncTransactions = async () => {
    if (!profile?.id) return;

    const normalizeItems = (raw: any): Transaction['items'] | undefined => {
      if (!raw) return undefined;
      if (Array.isArray(raw)) return raw as Transaction['items'];

      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed as Transaction['items'];
          if (parsed && Array.isArray((parsed as any).items)) return (parsed as any).items as Transaction['items'];
        } catch {
          return undefined;
        }
      }

      if (typeof raw === 'object') {
        if (Array.isArray((raw as any).items)) return (raw as any).items as Transaction['items'];
      }

      return undefined;
    };

    const normalizeSource = (raw: unknown): Transaction['source'] | undefined => {
      if (typeof raw !== 'string') return undefined;
      const normalized = raw.trim().toLowerCase();
      if (!normalized) return undefined;
      return normalized as Transaction['source'];
    };

    const normalizeMetadata = (raw: unknown): Transaction['metadata'] | undefined => {
      if (!raw) return undefined;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as Transaction['metadata'];
        } catch {
          return undefined;
        }
      }
      if (typeof raw === 'object') return raw as Transaction['metadata'];
      return undefined;
    };

    try {
      // Server-side merge: edge function now merges transactions + monibot_transactions
      // Solana transactions are stored in the same `transactions` table with metadata.network='solana',
      // so relay-payment's history action already returns them.
      const syncFunctionName = profile.preferredNetwork === 'celo' ? 'relay-payment-celo' : 'relay-payment';
      const { data: responseData } = await supabase.functions.invoke(syncFunctionName, {
        body: { action: 'history', message: { profileId: profile.id, limit: 50 } },
      });

      const mergedTxs = (responseData as any)?.transactions || [];
      const nextCursor = (responseData as any)?.nextCursor || null;
      const hasMore = (responseData as any)?.hasMore || false;

      // Map unified response to Transaction type
      const allTransactions: Transaction[] = Array.isArray(mergedTxs)
        ? mergedTxs.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            fee: parseFloat(tx.fee || 0),
            counterparty: tx.counterparty,
            timestamp: new Date(tx.created_at).getTime(),
            txHash: tx.tx_hash,
            items: normalizeItems(tx.items),
            invoiceId: tx.invoice_id || undefined,
            payerPayTag: tx.payer_pay_tag || undefined,
            source: normalizeSource(tx.source),
            metadata: normalizeMetadata(tx.metadata),
          }))
        : [];

      // Sort by timestamp descending
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);

      setTransactions(allTransactions);
      setTxCursor(nextCursor);
      setHasMoreTransactions(hasMore);
    } catch (err) {
      console.error('Failed to sync transactions:', err);
    }
  };

  // Load more transactions using cursor pagination
  const loadMoreTransactions = async () => {
    if (!profile?.id || !txCursor || isLoadingMore || !hasMoreTransactions) return;

    setIsLoadingMore(true);
    try {
      const loadMoreFunctionName = profile.preferredNetwork === 'celo' ? 'relay-payment-celo' : 'relay-payment';
      const { data: responseData } = await supabase.functions.invoke(loadMoreFunctionName, {
        body: { action: 'history', message: { profileId: profile.id, limit: 50, cursor: txCursor } },
      });

      const moreTxs = (responseData as any)?.transactions || [];
      const nextCursor = (responseData as any)?.nextCursor || null;
      const hasMore = (responseData as any)?.hasMore || false;

      const normalizeItems = (raw: any): Transaction['items'] | undefined => {
        if (!raw) return undefined;
        if (Array.isArray(raw)) return raw as Transaction['items'];
        if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; if (p && Array.isArray(p.items)) return p.items; } catch { return undefined; } }
        if (typeof raw === 'object' && Array.isArray((raw as any).items)) return (raw as any).items;
        return undefined;
      };
      const normalizeSource = (raw: unknown): Transaction['source'] | undefined => {
        if (typeof raw !== 'string') return undefined;
        const n = raw.trim().toLowerCase();
        return n ? n as Transaction['source'] : undefined;
      };
      const normalizeMetadata = (raw: unknown): Transaction['metadata'] | undefined => {
        if (!raw) return undefined;
        if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return undefined; } }
        if (typeof raw === 'object') return raw as Transaction['metadata'];
        return undefined;
      };

      const mapped: Transaction[] = Array.isArray(moreTxs)
        ? moreTxs.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            fee: parseFloat(tx.fee || 0),
            counterparty: tx.counterparty,
            timestamp: new Date(tx.created_at).getTime(),
            txHash: tx.tx_hash,
            items: normalizeItems(tx.items),
            invoiceId: tx.invoice_id || undefined,
            payerPayTag: tx.payer_pay_tag || undefined,
            source: normalizeSource(tx.source),
            metadata: normalizeMetadata(tx.metadata),
          }))
        : [];

      setTransactions(prev => [...prev, ...mapped]);
      setTxCursor(nextCursor);
      setHasMoreTransactions(hasMore);
    } catch (err) {
      console.error('Failed to load more transactions:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Refresh on-chain balance - with retry logic for faster updates
  const refreshBalance = async (networkOverride?: SupportedNetwork | number, delayMs = 1000) => {
    if (!profile?.wallet?.address) return;
    // Support old call signature refreshBalance(retries, delay) and new refreshBalance(network)
    let retries = 3;
    let effectiveNetwork: SupportedNetwork;
    const isNetworkSwitch = typeof networkOverride === 'string';
    if (typeof networkOverride === 'number') {
      retries = networkOverride;
      effectiveNetwork = (profile.preferredNetwork || 'celo') as SupportedNetwork;
    } else {
      effectiveNetwork = networkOverride || (profile.preferredNetwork || 'celo') as SupportedNetwork;
    }

    console.log('[refreshBalance] network:', effectiveNetwork, 'isSwitch:', isNetworkSwitch);

    // Invalidate cache so we get fresh on-chain data
    invalidateBalanceCache(profile.wallet.address, effectiveNetwork);

    const attemptRefresh = async (): Promise<number | null> => {
      try {
        // For Solana, use the solanaAddress (Base58) instead of EVM address
        const balanceAddress = profile.wallet.address as `0x${string}`;
        const onChainBalance = await getTokenBalance(balanceAddress, effectiveNetwork);
        console.log('[refreshBalance] onChainBalance:', onChainBalance, 'isFinite:', Number.isFinite(onChainBalance));
        if (!Number.isFinite(onChainBalance)) return null;
        return onChainBalance;
      } catch (err) {
        console.error('[refreshBalance] error:', err);
        return null;
      }
    };

    // Try immediately first
    let onChainBalance = await attemptRefresh();
    
    if (!isNetworkSwitch) {
      // If failed or same as current, retry with delays
      let attempt = 0;
      while ((onChainBalance === null || Math.abs(onChainBalance - (profile.balance ?? 0)) < 0.000001) && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        onChainBalance = await attemptRefresh();
        attempt++;
      }
    }

    // For network switches, accept 0 as valid (unfunded wallet)
    if (onChainBalance === null) {
      if (isNetworkSwitch) {
        onChainBalance = 0;
      } else {
        return;
      }
    }

    console.log('[refreshBalance] Setting balance to:', onChainBalance);
    // Always update from on-chain source of truth
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            balance: onChainBalance,
            merchantBalance: onChainBalance,
          }
        : prev
    );
  };

  // Async PIN verification with hash support
  const verifyPinAsync = async (pin: string): Promise<boolean> => {
    if (!profile) return false;
    
    let isValid = false;
    
    // Check if stored PIN is hashed or plain text (migration support)
    if (isPinHashed(profile.pin)) {
      isValid = await verifyPinHash(pin, profile.pin);
    } else {
      // Legacy plain text comparison - migrate to hash on successful verify
      isValid = profile.pin === pin;
      if (isValid) {
        // Migrate to hashed PIN
        const hashedPin = await hashPin(pin);
        setProfile(prev => prev ? { ...prev, pin: hashedPin } : prev);
      }
    }
    
    if (isValid) {
      let solanaAddress = profile.wallet.solanaAddress || null;
      let encryptedSolanaKey = profile.wallet.encryptedSolanaKey || null;

      // Hydrate solana ADDRESS from DB (not the key — key is localStorage only)
      if (!solanaAddress) {
        const hydrated = await hydrateSolanaWalletData(profile.wallet.address);
        solanaAddress = hydrated.solanaAddress;

        if (solanaAddress) {
          setProfile(prev => prev ? {
            ...prev,
            wallet: {
              ...prev.wallet,
              solanaAddress: solanaAddress || undefined,
            },
          } : prev);
        }
      }

      try {
        // Always use the raw PIN for decryption (private key was encrypted with raw PIN)
        const privateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, pin) as `0x${string}`;
        setDecryptedPrivateKey(privateKey);
      } catch (error) {
        console.error('Failed to decrypt private key:', error);
      }

      setDecryptedSolanaKey(null);

      // Also decrypt Solana key at unlock time (same raw PIN)
      if (encryptedSolanaKey) {
        try {
          const solanaKey = decryptPrivateKey(encryptedSolanaKey, pin);
          setDecryptedSolanaKey(solanaKey);
        } catch (error) {
          console.error('Failed to decrypt Solana key:', error);
        }
      }
      
      setIsUnlocked(true);
      setCurrentScreen('dashboard');
      
      // Sync transactions after unlock
      if (profile.id) {
        syncTransactions();
      }
    }
    return isValid;
  };

  // Sync wrapper for backwards compatibility
  const verifyPin = async (pin: string): Promise<boolean> => verifyPinAsync(pin);

  const createProfile = async (payTag: string, pin: string, preferredMode: AppMode): Promise<boolean> => {
    // Generate EVM wallet
    const { privateKey, address } = generateWallet();
    const encrypted = encryptPrivateKey(privateKey, pin);

    // Generate Solana wallet (Twin-Key architecture)
    const { solanaSecretKey, solanaAddress } = generateSolanaWallet();
    const encryptedSolanaKey = encryptPrivateKey(solanaSecretKey, pin);

    const normalizedTag = payTag.toLowerCase();

    // Hash PIN for secure storage
    const hashedPin = await hashPin(pin);

    // Store the generated private key for backup display
    setGeneratedPrivateKey(privateKey);

    // Register in Supabase
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          payTag: normalizedTag,
          walletAddress: address,
          encryptedPrivateKey: encrypted,
          encryptedSolanaKey,
          preferredMode,
          solanaAddress,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to register profile:', error);
        setGeneratedPrivateKey(null);
        return false;
      }
      
      const data = await response.json();
      
      const newProfile: UserProfile = {
        id: data.profileId,
        payTag: normalizedTag,
        pin: hashedPin,
        preferredMode,
        preferredNetwork: defaultNetwork || 'celo',
        balance: 0,
        merchantBalance: 0,
        wallet: {
          address,
          encryptedPrivateKey: encrypted,
          solanaAddress,
          encryptedSolanaKey,
        },
      };
      
      setProfile(newProfile);
      setDecryptedPrivateKey(privateKey);
      setDecryptedSolanaKey(solanaSecretKey);
      setMode(preferredMode);
      
      return true;
    } catch (error) {
      console.error('Failed to create profile:', error);
      return false;
    }
  };

  // Import wallet using private key
  const importWallet = async (privateKey: string, pin: string): Promise<{ success: boolean; error?: string; profileId?: string; walletAddress?: string }> => {
    try {
      // Validate and format private key
      let formattedKey = privateKey.trim();
      if (!formattedKey.startsWith('0x')) {
        formattedKey = '0x' + formattedKey;
      }
      
      // Derive address from private key
      const account = getAccountFromPrivateKey(formattedKey as `0x${string}`);
      const walletAddress = account.address;
      
      // Look up profile in Supabase by wallet address
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', walletAddress }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 404) {
          return { success: false, error: 'No account found for this wallet. Please create a new account.' };
        }
        return { success: false, error: error.error || 'Failed to import wallet' };
      }
      
      const data = await response.json();
      const profileData = data.profile;
      
      // Re-encrypt the private key with the new PIN
      const newEncrypted = encryptPrivateKey(formattedKey, pin);
      
      // Hash PIN for secure storage
      const hashedPin = await hashPin(pin);
      
      const importedProfile: UserProfile = {
        id: profileData.id,
        payTag: profileData.payTag,
        pin: hashedPin, // Store hashed PIN
        preferredMode: profileData.preferredMode || 'user',
        preferredNetwork: (
          isCeloMode ? 'celo'
          : (profileData.preferredNetwork || 'celo')
        ) as SupportedNetwork,
        balance: 0,
        merchantBalance: 0,
        wallet: {
          address: walletAddress,
          encryptedPrivateKey: newEncrypted,
          solanaAddress: profileData.solanaAddress || undefined,
          // Solana key is NOT imported from DB — user must import separately in Settings
        },
      };
      
      setProfile(importedProfile);
      setDecryptedPrivateKey(formattedKey as `0x${string}`);
      // Solana key stays null — user must import it manually in Settings
      setDecryptedSolanaKey(null);
      setMode(importedProfile.preferredMode);
      setIsUnlocked(true);
      setCurrentScreen('dashboard');
      
      // Refresh balance after import
      setTimeout(() => refreshBalance(), 100);
      
      return { success: true, profileId: profileData.id, walletAddress };
    } catch (error) {
      console.error('Failed to import wallet:', error);
      return { success: false, error: 'Invalid private key format' };
    }
  };

  // Update preferred mode in Supabase
  const updatePreferredMode = async (newMode: AppMode) => {
    if (!profile?.id) return;
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePreferredMode',
          profileId: profile.id,
          walletAddress: profile.wallet.address,
          preferredMode: newMode,
        }),
      });
      
      if (response.ok) {
        // Update local profile
        setProfile(prev => prev ? { ...prev, preferredMode: newMode } : prev);
      }
    } catch (error) {
      console.error('Failed to update preferred mode:', error);
    }
  };

  const setPreferredNetwork = async (network: SupportedNetwork) => {
    if (!profile?.id) return;

    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePreferredNetwork',
          profileId: profile.id,
          walletAddress: profile.wallet.address,
          preferredNetwork: network,
        }),
      });

      if (response.ok) {
        setProfile(prev => (prev ? { ...prev, preferredNetwork: network } : prev));
      }
    } catch (error) {
      console.error('Failed to update preferred network:', error);
    }
  };

  const updateBalance = (amount: number, type: 'deduct' | 'add', isMerchant = false) => {
    if (!profile) return;
    
    setProfile(prev => {
      if (!prev) return prev;
      if (isMerchant) {
        return {
          ...prev,
          merchantBalance: type === 'add' 
            ? prev.merchantBalance + amount 
            : prev.merchantBalance - amount,
        };
      }
      return {
        ...prev,
        balance: type === 'add' ? prev.balance + amount : prev.balance - amount,
      };
    });
  };

  const addTransaction = (tx: Omit<Transaction, 'id' | 'timestamp'>) => {
    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setTransactions(prev => [newTx, ...prev]);
    
    // Trigger local notification for received payments
    if (tx.type === 'received') {
      notifyPaymentReceived(tx.amount, tx.counterparty);
    }
  };

  /** Returns the active wallet address for the current network */
  const getActiveAddress = (): string => {
    if (!profile) return '';
    return profile.wallet.address;
  };

  /** Decrypt Solana key on-demand using raw PIN */
  const unlockSolanaKey = (rawPin: string): boolean => {
    if (decryptedSolanaKey) return true; // already unlocked
    const encKey = profile?.wallet?.encryptedSolanaKey;
    if (!encKey) return false;
    try {
      const key = decryptPrivateKey(encKey, rawPin);
      setDecryptedSolanaKey(key);
      return true;
    } catch (err) {
      console.error('[unlockSolanaKey] decrypt failed:', err);
      return false;
    }
  };

  // ─── Wallet readiness flags ──────────────────────────────────────
  const evmReady = !!(profile?.wallet?.address && profile?.wallet?.encryptedPrivateKey);
  const solanaReady = !!(profile?.wallet?.solanaAddress && profile?.wallet?.encryptedSolanaKey);
  const activeNetworkReady = (() => {
    if (!profile) return false;
    return evmReady; // Celo uses EVM key
  })();

  /** Repair a broken Solana wallet (address-only without key) by generating fresh keys */
  const repairSolanaWallet = async (pin: string): Promise<boolean> => {
    if (!profile) return false;
    try {
      const { solanaSecretKey, solanaAddress } = generateSolanaWallet();
      const encrypted = encryptPrivateKey(solanaSecretKey, pin);

      // Persist to Supabase
      await fetch(`${SUPABASE_FUNCTIONS_URL}/check-paytag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-solana',
          payTag: profile.payTag,
          solanaAddress,
          encryptedSolanaKey: encrypted,
        }),
      });

      // Update local profile
      setProfile(prev => prev ? {
        ...prev,
        wallet: {
          ...prev.wallet,
          solanaAddress,
          encryptedSolanaKey: encrypted,
        },
      } : prev);

      // Decrypt immediately
      setDecryptedSolanaKey(solanaSecretKey);
      return true;
    } catch (err) {
      console.error('[repairSolanaWallet] failed:', err);
      return false;
    }
  };

  return (
    <PayTagContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        mode,
        setMode,
        updatePreferredMode,
        setPreferredNetwork,
        isTempoMode,
        isCeloMode,
        isSolanaMode,
        isUnlocked,
        setIsUnlocked,
        isWalletOnly,
        profile,
        setProfile,
        evmReady,
        solanaReady,
        activeNetworkReady,
        repairSolanaWallet,
        decryptedPrivateKey,
        decryptedSolanaKey,
        generatedPrivateKey,
        clearGeneratedKey,
        refreshBalance,
        getActiveAddress,
        unlockSolanaKey,
        transactions,
        addTransaction,
        syncTransactions,
        loadMoreTransactions,
        hasMoreTransactions,
        isLoadingMore,
        verifyPin,
        createProfile,
        importWallet,
        updateBalance,
        checkPayTagAvailable,
        lookupPayTag,
      }}
    >
      {children}
    </PayTagContext.Provider>
  );
}

export function usePayTag() {
  const context = useContext(PayTagContext);
  if (!context) {
    throw new Error('usePayTag must be used within a PayTagProvider');
  }
  return context;
}
