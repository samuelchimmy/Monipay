/**
 * Re-export chains.js from root for src/ module imports.
 */
export {
  CHAIN_CONFIGS,
  getChainConfig,
  isTestnet,
  getExplorerUrl,
  getTestnetWarning,
  resolveToken,
  resolveChainName,
  resolveActiveChain,
} from '../chains.js';
