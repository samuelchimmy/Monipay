import { http, createConfig, createStorage } from 'wagmi';
import { celo } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { type Chain } from 'viem';

// WalletConnect Project ID - you can get one at https://cloud.walletconnect.com
const projectId = 'fdef5f6c19413d2eb89836d77bad923c'; // Replace with your actual project ID

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  storage: createStorage({ storage: localStorage }),
  transports: {
    [celo.id]: http('https://forno.celo.org'),
  },
});

export { celo };

/** Resolve the viem Chain object for a given app network key. */
export function wagmiChainFromNetwork(_network: string): Chain {
  // MoniPay is Celo-only.
  return celo;
}
