// supabase/functions/give-feedback-batch/index.ts
// One-shot function: seeds agent_peer_feedback_queue with target agents
// and immediately drains them by calling giveFeedback() on Celo Mainnet.
//
// Invoke: POST /functions/v1/give-feedback-batch
// Auth:   Bearer <SUPABASE_SERVICE_ROLE_KEY>  (or set via Authorization header)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createWalletClient, http, parseAbi } from "npm:viem";
import { privateKeyToAccount } from "npm:viem/accounts";
import type { Hex } from "npm:viem";

const REGISTRY   = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Hex;
const CELO_RPC   = "https://forno.celo.org";
const MY_AGENT_ID = 9103;

const CELO_CHAIN = {
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [CELO_RPC] } },
} as const;

const REGISTRY_ABI = parseAbi([
  "function giveFeedback(uint256 agentId, uint8 score, string calldata uri) external",
]);

// All Celo agents discovered on 8004scan to give feedback to
const TARGETS: Array<{ agentId: number; score: number; name: string }> = [
  { agentId: 9275, score: 8, name: "Trucoach" },
  { agentId: 9274, score: 8, name: "Sippar HireWire" },
  { agentId: 9268, score: 7, name: "TrustGuard Router" },
  { agentId: 9263, score: 8, name: "Celina" },
  { agentId: 9261, score: 7, name: "Ragna" },
  { agentId: 9255, score: 7, name: "The Metronome" },
  { agentId: 9253, score: 7, name: "Gambit Queen" },
  { agentId: 9239, score: 9, name: "CeloMind" },
  { agentId: 9237, score: 9, name: "Remifi" },
  { agentId: 9230, score: 8, name: "Agent Ada" },
  { agentId: 9228, score: 8, name: "CeloSense" },
  { agentId: 9229, score: 7, name: "Payflow Agent" },
  { agentId: 9226, score: 8, name: "CVault" },
  { agentId: 9225, score: 9, name: "CeloBank Agent" },
  { agentId: 9221, score: 8, name: "UtilityPay Agent" },
  { agentId: 9220, score: 7, name: "CeloSeer" },
];

const REGISTRY_CAIP = `eip155:42220:${REGISTRY}`;

Deno.serve(async (req) => {
  // Simple auth check — must be called with service role key
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader.includes(serviceKey.slice(-20))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const privateKey = Deno.env.get("MONIBOT_WALLET_PRIVATE_KEY") || Deno.env.get("RELAYER_PRIVATE_KEY");
  if (!privateKey) {
    return new Response(JSON.stringify({ error: "MONIBOT_WALLET_PRIVATE_KEY not set" }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}` as Hex);
  const walletClient = createWalletClient({
    account,
    chain: CELO_CHAIN as any,
    transport: http(CELO_RPC),
  });

  console.log(`[give-feedback-batch] Wallet: ${account.address}`);
  console.log(`[give-feedback-batch] Giving feedback to ${TARGETS.length} agents...`);

  const results: Array<{
    agentId: number;
    name: string;
    status: string;
    txHash?: string;
    error?: string;
  }> = [];

  for (const target of TARGETS) {
    const uri = `https://monipay.xyz/erc8004/feedback/${MY_AGENT_ID}/${target.agentId}`;
    try {
      console.log(`  → Agent #${target.agentId} (${target.name}) score=${target.score}`);

      const txHash = await walletClient.writeContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "giveFeedback",
        args: [BigInt(target.agentId), target.score, uri],
      });

      console.log(`  ✅ TX: ${txHash}`);

      // Also log it in supabase for traceability (non-blocking)
      supabase.from("agent_peer_feedback_queue").insert({
        peer_agent_id: String(target.agentId),
        peer_registry: REGISTRY_CAIP,
        score: target.score,
        receipt_uri: uri,
        source_request_id: `batch-${Date.now()}-${target.agentId}`,
        source_endpoint: "give-feedback-batch",
        status: "completed",
        processed_tx_hash: txHash,
        processed_at: new Date().toISOString(),
      }).then(() => {});

      results.push({ agentId: target.agentId, name: target.name, status: "success", txHash });

      // 3s delay between txs to avoid nonce racing
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err: any) {
      console.error(`  ❌ Agent #${target.agentId} failed: ${err.message}`);
      results.push({ agentId: target.agentId, name: target.name, status: "failed", error: err.message });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  console.log(`[give-feedback-batch] Done: ${successCount}/${TARGETS.length} succeeded`);

  return new Response(
    JSON.stringify({
      senderWallet: account.address,
      myAgentId: MY_AGENT_ID,
      total: TARGETS.length,
      succeeded: successCount,
      failed: TARGETS.length - successCount,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
