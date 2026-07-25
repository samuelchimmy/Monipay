/**
 * claim-social-funds Edge Function
 *
 * Verifies the caller owns the recipientId (via linked social identity in
 * profiles), then submits an on-chain `batchClaim` to the IOURegistry on the
 * specified chain using the IOU_VAULT_PRIVATE_KEY (vault role on the contract).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createPublicClient, createWalletClient, http, keccak256, toBytes, encodeFunctionData } from "https://esm.sh/viem@2.37.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.37.0/accounts";
import { base, bsc, celo, ink } from "https://esm.sh/viem@2.37.0/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAINS: Record<string, { chain: any; rpc: string; registry: `0x${string}`; registryV2?: `0x${string}` }> = {
  base: {
    chain: base,
    rpc: "https://base-rpc.publicnode.com",
    registry: "0x1945c633659Ae71991aE37eE2Bdfe64E00514650",
  },
  bsc: {
    chain: bsc,
    rpc: "https://bsc-dataseed.binance.org",
    registry: "0xF602b559eE5c51ED122F667d101be105d9eDf90d",
  },
  celo: {
    chain: celo,
    rpc: "https://forno.celo.org",
    // V1 registry — used by USDT MagicPay (legacy)
    registry: "0x6bB3C64C382fcF8fB65b24234C455bB62b155742",
    // V2 registry — used by G$, USDC, USDm MagicPay
    registryV2: "0x89218866374DF22c74a0F44ae648bfA9de8BD31e",
  },
  ink: {
    chain: ink,
    rpc: "https://rpc-qnd.inkonchain.com",
    registry: "0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08",
  },
};

const IOU_REGISTRY_ABI = [
  {
    type: "function",
    name: "batchClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "iouIds", type: "uint256[]" },
      { name: "claimant", type: "address" },
      { name: "recipientId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

function getRecipientId(platform: string, userId: string): `0x${string}` {
  return keccak256(toBytes(`${platform.toLowerCase()}:${userId}`));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { chain, platform, platformUserId, iouIds, claimantAddress, registryVersion } = body as {
      chain: string;
      platform: string;
      platformUserId: string;
      iouIds: string[];
      claimantAddress: string;
      /** "v1" = USDT legacy registry | "v2" = G$/USDC/USDm registry. Defaults to "v2" on Celo if V2 is deployed. */
      registryVersion?: "v1" | "v2";
    };

    if (!chain || !platform || !platformUserId || !Array.isArray(iouIds) || iouIds.length === 0 || !claimantAddress) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (iouIds.length > 100) {
      return new Response(JSON.stringify({ error: "Batch too large (max 100)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chainCfg = CHAINS[chain.toLowerCase()];
    if (!chainCfg) {
      return new Response(JSON.stringify({ error: `Unsupported chain: ${chain}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick registry: V2 if available and requested (or default), V1 if explicitly requested or V2 not deployed
    const useV2 = chainCfg.registryV2 && registryVersion !== "v1";
    const registryAddress: `0x${string}` = useV2 ? chainCfg.registryV2! : chainCfg.registry;
    console.log(`[claim-social-funds] chain=${chain} registryVersion=${registryVersion ?? "auto"} → ${useV2 ? "V2" : "V1"} registry: ${registryAddress}`);


    // ── 1. Verify the recipientId belongs to the caller via session/profile lookup ──
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The wallet address is treated as the identity claim — look up ALL profile
    // rows with this wallet across both legacy `profiles` and MiniPay
    // `wallet_profiles`. A user may exist in both tables (legacy MoniPay row
    // + MiniPay-linked socials in wallet_profiles); pick whichever row has the
    // requested social identity linked.
    const SELECT_COLS =
      "id, wallet_address, discord_id, telegram_id, x_username, x_user_id, x_verified";

    const [{ data: legacyRows }, { data: walletRows }] = await Promise.all([
      supabase.from("profiles").select(SELECT_COLS).ilike("wallet_address", claimantAddress),
      supabase.from("wallet_profiles").select(SELECT_COLS).ilike("wallet_address", claimantAddress),
    ]);

    const candidates: any[] = [
      ...(walletRows || []), // prefer wallet_profiles (MiniPay) first
      ...(legacyRows || []),
    ];

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ error: "Profile not found for claimant address" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformLower = platform.toLowerCase();
    const ownsRow = (p: any): boolean => {
      if (platformLower === "discord") return String(p.discord_id || "") === String(platformUserId);
      if (platformLower === "telegram") return String(p.telegram_id || "") === String(platformUserId);
      if (platformLower === "twitter" || platformLower === "x") {
        if (!p.x_verified) return false;
        if (p.x_user_id && String(p.x_user_id) === String(platformUserId)) return true;
        if (!p.x_user_id && p.x_username && String(p.x_username).toLowerCase() === String(platformUserId).toLowerCase()) return true;
      }
      return false;
    };

    const profile = candidates.find(ownsRow);
    if (!profile) {
      console.warn("[claim-social-funds] owns check failed", {
        claimantAddress, platform: platformLower, platformUserId,
        candidates: candidates.map((c) => ({
          id: c.id, discord_id: c.discord_id, telegram_id: c.telegram_id,
          x_user_id: c.x_user_id, x_username: c.x_username, x_verified: c.x_verified,
        })),
      });
      return new Response(JSON.stringify({ error: "This social identity is not linked to your wallet" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientId = getRecipientId(platformLower, platformUserId);

    // ── 2. Submit on-chain batchClaim via vault key ──
    const vaultKey = Deno.env.get("IOU_VAULT_PRIVATE_KEY");
    if (!vaultKey) {
      return new Response(JSON.stringify({ error: "Vault key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vaultAccount = privateKeyToAccount(
      (vaultKey.startsWith("0x") ? vaultKey : `0x${vaultKey}`) as `0x${string}`,
    );

    const publicClient = createPublicClient({ chain: chainCfg.chain, transport: http(chainCfg.rpc) });
    const walletClient = createWalletClient({ account: vaultAccount, chain: chainCfg.chain, transport: http(chainCfg.rpc) });

    const ids = iouIds.map((s) => BigInt(s));
    const data = encodeFunctionData({
      abi: IOU_REGISTRY_ABI,
      functionName: "batchClaim",
      args: [ids, claimantAddress as `0x${string}`, recipientId],
    });

    let gas: bigint;
    try {
      gas = await publicClient.estimateGas({
        account: vaultAccount.address,
        to: registryAddress,
        data,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Gas estimation failed: ${e.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let gasPrice = await publicClient.getGasPrice();
    const relayerAddr = walletClient.account.address;

    // Append Celo Attribution Tag (celo_b6186af7f424) for leaderboard tracking
    const CELO_TAG_SUFFIX = "63656c6f5f623631383661663766343234110080218021802180218021802180218021";
    const txData: `0x${string}` = chain.toLowerCase() === "celo"
      ? ((data + CELO_TAG_SUFFIX) as `0x${string}`)
      : data;

    let lastErr: unknown;
    let sent: Hex | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const pendingNonce = await publicClient.getTransactionCount({
          address: relayerAddr,
          blockTag: "pending",
        });

        sent = await walletClient.sendTransaction({
          chain: chainCfg.chain,
          to: registryAddress,
          data: txData,
          gas: gas + gas / 5n,
          gasPrice,
          nonce: pendingNonce,
        });
        break;
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isUnderpriced =
          msg.includes("underpriced") ||
          msg.includes("replacement transaction") ||
          msg.includes("nonce too low");
        if (!isUnderpriced || attempt === 2) {
          lastErr = err;
          throw err;
        }
        console.warn(`[tx-retry] Attempt ${attempt + 1} failed: ${msg.slice(0, 120)}`);
        gasPrice = (gasPrice * 125n) / 100n;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (!sent) throw lastErr ?? new Error("Transaction submission failed");
    const hash = sent;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      return new Response(JSON.stringify({ error: "On-chain claim reverted", txHash: hash }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Mark DB rows as claimed ──
    await supabase
      .from("ious")
      .update({
        status: "claimed",
        recipient_profile_id: profile.id,
        claimed_at: new Date().toISOString(),
        tx_hash_claim: hash,
      })
      .in("iou_id", iouIds.map(String))
      .eq("chain", chain.toLowerCase());

    return new Response(
      JSON.stringify({ success: true, txHash: hash, chain, count: iouIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("claim-social-funds error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
