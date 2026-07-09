import { http, createConfig, createStorage } from 'wagmi';
import { base, bsc, mainnet, arbitrum, optimism, polygon, linea, scroll, zkSync, mode, worldchain, blast, lisk, ink, zora, celo } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { defineChain, type Chain } from 'viem';

// WalletConnect Project ID - you can get one at https://cloud.walletconnect.com
const projectId = 'fdef5f6c19413d2eb89836d77bad923c'; // Replace with your actual project ID

export const tempoTestnet = defineChain({
  id: 42431,
  name: 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [base, bsc, tempoTestnet, celo, mainnet, arbitrum, optimism, polygon, linea, scroll, zkSync, mode, worldchain, blast, lisk, ink, zora],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  storage: createStorage({ storage: localStorage }),
  transports: {
    [base.id]:         http('https://mainnet.base.org'),
    [bsc.id]:          http('https://bsc-dataseed.binance.org'),
    [tempoTestnet.id]: http('https://rpc.moderato.tempo.xyz'),
    [celo.id]:         http('https://forno.celo.org'),
    [ink.id]:          http('https://rpc-qnd.inkonchain.com'),
    [mainnet.id]:      http(),
    [arbitrum.id]:     http(),
    [optimism.id]:     http(),
    [polygon.id]:      http(),
    [linea.id]:        http(),
    [scroll.id]:       http(),
    [zkSync.id]:       http(),
    [mode.id]:         http(),
    [worldchain.id]:   http(),
    [blast.id]:        http(),
    [lisk.id]:         http(),
    [zora.id]:         http(),
  },
});

export { base, bsc, celo, ink };

/** Resolve the viem Chain object for a given app network key. */
export function wagmiChainFromNetwork(network: string): Chain {
  switch (network) {
    case 'base':  return base;
    case 'bsc':   return bsc;
    case 'celo':  return celo;
    case 'ink':   return ink;
    case 'tempo': return tempoTestnet;
    default:      return base;
  }
}
