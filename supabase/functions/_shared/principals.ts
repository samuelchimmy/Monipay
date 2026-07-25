// Shared dual-lookup for "principals" — accounts that can act as sender or payer.
// Falls back from `public.profiles` (full MoniPay accounts) to `public.wallet_profiles`
// (wallet-only sessions: Path B/C connect-wallet identities).
//
// Returns a normalized shape so callers don't care which table the row came from.

export type PrincipalSource = "profiles" | "wallet_profiles";

export interface Principal {
  id: string;
  source: PrincipalSource;
  pay_tag: string | null;
  wallet_address: string | null;
  preferred_network: string | null;
  tempo_address: string | null;
  solana_address: string | null;
  status: string | null;
}

// Columns we always select from profiles. Never select encrypted_* keys here.
const PROFILE_COLS =
  "id, pay_tag, wallet_address, preferred_network, tempo_address, solana_address, status";

const WALLET_PROFILE_COLS =
  "id, pay_tag, wallet_address, preferred_network";

/**
 * Load a principal by id. Tries `profiles` first, then `wallet_profiles`.
 * Returns null if neither table has the id.
 */
export async function loadPrincipal(
  supabase: any,
  id: string | null | undefined
): Promise<Principal | null> {
  if (!id) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", id)
    .maybeSingle();

  if (p) {
    return {
      id: p.id,
      source: "profiles",
      pay_tag: p.pay_tag ?? null,
      wallet_address: p.wallet_address ?? null,
      preferred_network: p.preferred_network ?? null,
      tempo_address: p.tempo_address ?? null,
      solana_address: p.solana_address ?? null,
      status: p.status ?? null,
    };
  }

  const { data: w } = await supabase
    .from("wallet_profiles")
    .select(WALLET_PROFILE_COLS)
    .eq("id", id)
    .maybeSingle();

  if (w) {
    return {
      id: w.id,
      source: "wallet_profiles",
      pay_tag: w.pay_tag ?? null,
      wallet_address: w.wallet_address ?? null,
      preferred_network: w.preferred_network ?? null,
      tempo_address: null,
      solana_address: null,
      status: "active",
    };
  }

  return null;
}

/**
 * Convenience: load a principal and just return its preferred_network,
 * falling back to "base" if unknown.
 */
export async function loadPrincipalNetwork(
  supabase: any,
  id: string | null | undefined,
  fallback = "base"
): Promise<string> {
  const p = await loadPrincipal(supabase, id);
  return p?.preferred_network || fallback;
}

/**
 * Load a principal by pay_tag (case-insensitive, optional leading @).
 * Tries `profiles` first, then `wallet_profiles`. Returns null when not found.
 */
export async function loadPrincipalByPayTag(
  supabase: any,
  payTag: string | null | undefined,
): Promise<Principal | null> {
  if (!payTag) return null;
  const tag = payTag.toString().trim().toLowerCase().replace(/^@/, "");
  if (!tag) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("pay_tag", tag)
    .maybeSingle();

  if (p) {
    return {
      id: p.id,
      source: "profiles",
      pay_tag: p.pay_tag ?? null,
      wallet_address: p.wallet_address ?? null,
      preferred_network: p.preferred_network ?? null,
      tempo_address: p.tempo_address ?? null,
      solana_address: p.solana_address ?? null,
      status: p.status ?? null,
    };
  }

  const { data: w } = await supabase
    .from("wallet_profiles")
    .select(WALLET_PROFILE_COLS)
    .eq("pay_tag", tag)
    .maybeSingle();

  if (w) {
    return {
      id: w.id,
      source: "wallet_profiles",
      pay_tag: w.pay_tag ?? null,
      wallet_address: w.wallet_address ?? null,
      preferred_network: w.preferred_network ?? null,
      tempo_address: null,
      solana_address: null,
      status: "active",
    };
  }

  return null;
}