export const TEMPO_ENABLED = import.meta.env.VITE_ENABLE_TEMPO === 'true';
export const ARC_ENABLED = import.meta.env.VITE_ENABLE_ARC === 'true';

// ── V2 Feature Flags ──
export const V2_VAULT_ENABLED = import.meta.env.VITE_ENABLE_V2_VAULT === 'true';
export const MNS_ENABLED = import.meta.env.VITE_ENABLE_MNS === 'true';
export const SCATTER_BOT_ENABLED = import.meta.env.VITE_ENABLE_SCATTER_BOT === 'true';

/** V2 default fee in basis points (50 = 0.5%). Falls back to V1 100 bps (1%) when flag is absent. */
export const V2_FEE_BPS = parseInt(import.meta.env.VITE_V2_FEE_BPS || '100', 10);
