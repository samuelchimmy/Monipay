import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Wallet, Loader2, ExternalLink, AlertCircle, Search } from 'lucide-react';
import { 
  WalletMetamask, WalletRabby, WalletRainbow, WalletCoinbase, WalletTrust, 
  WalletWalletConnect, WalletPhantom, WalletOkx, WalletZerion, NetworkBase, NetworkBinanceSmartChain 
} from '@web3icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { base, bsc } from 'wagmi/chains';
import { shortenAddress } from '@/lib/wallet';
import { feedback } from '@/lib/feedback';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { SolanaLogo } from '@/components/SolanaLogo';

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const WALLET_ICONS: Record<string, React.ElementType> = {
  'metamask': WalletMetamask,
  'rabby': WalletRabby,
  'rainbow': WalletRainbow,
  'coinbase wallet': WalletCoinbase,
  'trust wallet': WalletTrust,
  'walletconnect': WalletWalletConnect,
  'phantom': WalletPhantom,
  'okx wallet': WalletOkx,
  'zerion': WalletZerion,
};

const WALLET_PRIORITY: Record<string, number> = {
  'metamask': 1, 'rabby': 2, 'phantom': 3, 'rainbow': 4,
  'coinbase wallet': 5, 'trust wallet': 6, 'walletconnect': 7,
  'okx wallet': 8, 'zerion': 9, 'injected': 100,
};

const FEATURED_WALLET_IDS = ['metamask', 'rabby', 'phantom'];

function getWalletIcon(name: string) {
  const key = name.toLowerCase();
  for (const [iconKey, icon] of Object.entries(WALLET_ICONS)) {
    if (key.includes(iconKey) || iconKey.includes(key)) return icon;
  }
  return null;
}

function getWalletPriority(name: string) {
  const key = name.toLowerCase();
  for (const [prioKey, priority] of Object.entries(WALLET_PRIORITY)) {
    if (key.includes(prioKey) || prioKey.includes(key)) return priority;
  }
  return 50;
}

function isFeaturedWallet(connectorId: string, connectorName: string) {
  const id = connectorId.toLowerCase();
  const name = connectorName.toLowerCase();
  return FEATURED_WALLET_IDS.some(f => id.includes(f) || name.includes(f) || f.includes(id) || f.includes(name));
}

interface ConnectedWalletDepositProps {
  walletAddress: string;
  network: SupportedNetwork;
  onBack: () => void;
  onSuccess: (amount: number) => void;
}

export function ConnectedWalletDeposit({
  walletAddress,
  network,
  onBack,
  onSuccess,
}: ConnectedWalletDepositProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const chainConfig = getChainConfig(network);
  const isBase = network === 'base';
  const targetChain = isBase ? base : bsc;
  const tokenAddress = chainConfig.token as `0x${string}`;

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  
  const { data: rawBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: targetChain.id,
  });

  const tokenBalance = rawBalance !== undefined 
    ? parseFloat(formatUnits(rawBalance as bigint, chainConfig.decimals))
    : null;

  const {
    writeContract, 
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed && txHash && !txSuccess) {
      setTxSuccess(true);
      feedback('deposit');
      onSuccess(parseFloat(amount));
    }
  }, [isConfirmed, txHash, txSuccess, amount, onSuccess]);

  useEffect(() => {
    if (writeError) {
      setError(writeError.message.includes('rejected') ? 'Transaction rejected' : 'Transfer failed. Please try again.');
    }
  }, [writeError]);

  const filteredConnectors = useMemo(() => {
    let filtered = connectors.filter(c => {
      if (c.id === 'injected' && connectors.some(other => other.id !== 'injected' && other.name.toLowerCase() !== 'injected')) return false;
      return true;
    });
    filtered.sort((a, b) => getWalletPriority(a.name) - getWalletPriority(b.name));
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query));
    } else {
      filtered = filtered.filter(c => isFeaturedWallet(c.id, c.name));
    }
    return filtered;
  }, [connectors, searchQuery]);

  const handleConnect = (connector: any) => { setError(null); connect({ connector }); };

  const handleDeposit = async () => {
    if (!address || !amount) return;
    setError(null);
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) { setError('Please enter a valid amount'); return; }
    if (tokenBalance !== null && depositAmount > tokenBalance) { setError(`Insufficient ${chainConfig.currency} balance`); return; }
    if (chain?.id !== targetChain.id) { setError(`Please switch to ${chainConfig.name} network`); return; }

    try {
      const amountInWei = parseUnits(amount, chainConfig.decimals);
      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [walletAddress as `0x${string}`, amountInWei],
        account: address,
        chain: targetChain,
      });
    } catch (err) {
      console.error('[Connected Wallet] Transfer error:', err);
      setError('Failed to initiate transfer');
    }
  };

  const handleMaxAmount = () => { if (tokenBalance !== null) setAmount(tokenBalance.toFixed(chainConfig.decimals)); };

  const isProcessing = isWriting || isConfirming;
  const accentClass = isBase ? 'text-base-blue' : 'text-yellow-600';
  const accentBgClass = isBase ? 'bg-base-blue' : 'bg-yellow-500';
  const explorerUrl = chainConfig.explorerUrl;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing} className="rounded-full h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-lg font-semibold text-foreground truncate">Connected Wallet</h3>
        {network === 'solana' ? <SolanaLogo size={20} /> : isBase ? <NetworkBase size={20} variant="branded" /> : <NetworkBinanceSmartChain size={20} variant="branded" />}
      </div>

      <div className="p-5 space-y-5">
        {!isConnected ? (
          <>
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Wallet className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Connect an external wallet to deposit {chainConfig.currency}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder="Search wallets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-11 rounded-xl" />
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {filteredConnectors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{searchQuery ? 'No wallets found' : 'No wallets available'}</p>
              ) : (
                filteredConnectors.map((connector) => {
                  const IconComponent = getWalletIcon(connector.name);
                  return (
                    <motion.button key={connector.uid} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => handleConnect(connector)} disabled={isConnecting} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left disabled:opacity-50">
                      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0 border border-border overflow-hidden">
                        {IconComponent ? <IconComponent size={24} variant="branded" /> : <Wallet className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <span className="font-medium text-foreground text-sm truncate flex-1">{connector.name}</span>
                      {isConnecting && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />}
                    </motion.button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-center text-muted-foreground">{searchQuery ? 'Temporary connection for depositing only.' : 'Search to find more wallet options.'}</p>
          </>
        ) : (
          <>
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full ${isBase ? 'bg-base-blue/10' : 'bg-yellow-500/10'} flex items-center justify-center flex-shrink-0`}>
                    <Wallet className={`w-5 h-5 ${accentClass}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{shortenAddress(address!)}</p>
                    <div className="flex items-center gap-1.5">
                      {network === 'solana' ? <SolanaLogo size={14} /> : isBase ? <NetworkBase size={14} variant="branded" /> : <NetworkBinanceSmartChain size={14} variant="branded" />}
                      <p className="text-xs text-muted-foreground truncate">{chain?.name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => disconnect()} disabled={isProcessing} className="text-destructive hover:text-destructive flex-shrink-0">Disconnect</Button>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{chainConfig.currency} Balance</span>
                  <span className="font-medium text-foreground">{tokenBalance !== null ? `$${tokenBalance.toFixed(2)}` : '...'}</span>
                </div>
              </div>
            </div>

            {chain?.id !== targetChain.id && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-600">Please switch to {chainConfig.name} network</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Amount to Deposit</label>
              <div className="relative">
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} className="h-14 text-lg rounded-xl pr-16" disabled={isProcessing} />
                <Button variant="ghost" size="sm" onClick={handleMaxAmount} disabled={isProcessing || !tokenBalance} className={`absolute right-2 top-1/2 -translate-y-1/2 ${accentClass} font-medium`}>MAX</Button>
              </div>
            </div>

            <div className={`${isBase ? 'bg-base-blue/5' : 'bg-yellow-500/5'} rounded-xl p-4 text-center`}>
              <p className="text-xs text-muted-foreground mb-1">Depositing to</p>
              <p className="font-mono text-sm font-medium text-foreground">{shortenAddress(walletAddress)}</p>
              <p className={`text-xs ${accentClass} mt-1`}>Your MoniPay Wallet</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button size="lg" onClick={handleDeposit} disabled={isProcessing || !amount || chain?.id !== targetChain.id} className={`w-full h-14 text-lg font-semibold rounded-xl ${accentBgClass} hover:opacity-90 ${isBase ? '' : 'text-black'}`}>
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isConfirming ? 'Confirming...' : 'Depositing...'}</span>
                </div>
              ) : 'Deposit'}
            </Button>

            {txHash && (
              <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 text-sm ${accentClass} hover:underline`}>
                <span>View on {isBase ? 'BaseScan' : 'BscScan'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
