import { createWalletClient, erc20Abi, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_CONFIGS, type EvmNetwork } from '@/config/chains';

export async function approveEvmTokenWithKey(
  privateKey: `0x${string}`,
  network: EvmNetwork,
): Promise<`0x${string}`> {
  const config = CHAIN_CONFIGS[network];

  if (!config?.token || !config?.monipayRouter) {
    throw new Error(`Approval is not available for ${network}`);
  }

  const account = privateKeyToAccount(privateKey);
  const chain = {
    id: config.id,
    name: config.name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [...config.rpcUrls.filter((url) => url.startsWith('http'))] } },
    blockExplorers: { default: { name: `${config.name} Explorer`, url: config.explorerUrl } },
  } as const;

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  return walletClient.writeContract({
    address: config.token as Hex,
    abi: erc20Abi,
    functionName: 'approve',
    args: [config.monipayRouter as Hex, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    chain,
    account,
  });
}