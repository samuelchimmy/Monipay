import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { getChainConfig } from '../../shared/chains.js';
import { getAllowance } from '../../shared/blockchain.js';

export async function checkAllowance(walletAddress, amount, chain, context = 'p2p', profileAllowance = null, senderSource = 'profile') {
  try {
    let allowance = profileAllowance;
    const config = getChainConfig(chain);

    if (allowance === null || allowance === undefined) {
      if (context === 'magicpay' && config?.magicPayAddress) {
        const client = createPublicClient({ chain: config.chain, transport: http(config.rpcs[0]) });
        const raw = await client.readContract({
          address: config.tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [walletAddress, config.magicPayAddress],
        });
        allowance = parseFloat(formatUnits(raw, config.decimals));
      } else {
        allowance = (await getAllowance(walletAddress, chain)).allowance;
      }
    }

    if (allowance < amount) {
      // MiniPay users approve inside the miniapp, not on monipay.xyz
      const fixInstructions = senderSource === 'wallet_profile'
        ? 'Open the *MiniPay* app → Monipay miniapp → *Approve Spending Allowance*.'
        : 'Go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Set Allowance.';

      return {
        ok: false,
        allowance,
        message:
          `⚠️ *Allowance too low on ${chain.toUpperCase()}.*\n` +
          `Approved: $${allowance.toFixed(2)} | Needed: $${amount.toFixed(2)}\n\n` +
          fixInstructions
      };
    }
    return { ok: true, allowance };
  } catch (err) {
    console.warn(`⚠️ [Allowance] Pre-check failed for ${walletAddress} on ${chain}: ${err.message}`);
    return { ok: true };
  }
}
