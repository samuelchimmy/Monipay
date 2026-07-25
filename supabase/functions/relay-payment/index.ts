import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createWalletClient, createPublicClient, http, parseAbi, parseAbiItem, encodeFunctionData, parseUnits, formatUnits, erc20Abi, keccak256, encodePacked, decodeEventLog, type Hex, type Chain } from "npm:viem@2.44.4";
import { privateKeyToAccount } from "npm:viem@2.44.4/accounts";
import { base, bsc, ink } from "npm:viem@2.44.4/chains";
import { 
  corsHeaders, 
  checkRateLimit, 
  RATE_LIMITS, 
  verifyRequestSignature,
  rateLimitedResponse,
  unauthorizedResponse,
  getClientIP,
} from "../_shared/security.ts";
import { loadPrincipal } from "../_shared/principals.ts";

// ============ Network Configurations ============

type NetworkId = "base" | "bsc" | "tempo" | "celo" | "ink";

interface NetworkConfig {
  chain: Chain;
  routerAddress: Hex;
  tokenAddress: Hex;
  magicPayAddress?: Hex;
  decimals: number;
  currency: string;
  rpcUrls: string[];
}

// Define Tempo testnet chain for viem
const tempoTestnet = {
  id: 42431,
  name: "Tempo Testnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" } },
} as const;

// Use private RPC URLs from env when available, fallback to public
const baseRpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
const tempoRpcUrl = Deno.env.get("TEMPO_RPC_URL") || "https://rpc.moderato.tempo.xyz";
const inkRpcUrl = Deno.env.get("INK_RPC_URL") || "https://rpc-qnd.inkonchain.com";

const NETWORK_CONFIGS: Record<NetworkId, NetworkConfig> = {
  base: {
    chain: base,
    routerAddress: "0x4048d18F71E723647f83B61202362425C5a7D2c0" as Hex,
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Hex,
    magicPayAddress: "0x1945c633659Ae71991aE37eE2Bdfe64E00514650" as Hex,
    decimals: 6,
    currency: "USDC",
    // mainnet.base.org is heavily rate-limited (429s) — push it last.
    rpcUrls: [baseRpcUrl, "https://base-rpc.publicnode.com", "https://base.drpc.org", "https://1rpc.io/base", "https://mainnet.base.org"],
  },
  bsc: {
    chain: bsc,
    routerAddress: "0x557285AbC46038E898d90eB00943Ff42c4Fbcb54" as Hex,
    tokenAddress: "0x55d398326f99059fF775485246999027B3197955" as Hex,
    magicPayAddress: "0xF602b559eE5c51ED122F667d101be105d9eDf90d" as Hex,
    decimals: 18,
    currency: "USDT",
    rpcUrls: [
      "https://bsc-dataseed.binance.org",
      "https://bsc-rpc.publicnode.com",
      "https://binance.llamarpc.com",
      "https://bsc.drpc.org",
      "https://bsc.meowrpc.com",
      "https://bnb.api.onfinality.io/public",
      "https://bsc-mainnet.public.blastapi.io",
    ],
  },
  tempo: {
    chain: tempoTestnet as any,
    routerAddress: "0xa39C3B7e02686cf7F226337525515c694318BDb9" as Hex,
    tokenAddress: "0x20c0000000000000000000000000000000000001" as Hex,
    decimals: 6,
    currency: "aUSD",
    rpcUrls: [tempoRpcUrl],
  },
  celo: {
    chain: { id: 42220, name: "Celo", nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }, rpcUrls: { default: { http: ["https://forno.celo.org"] } } } as any,
    routerAddress: "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0" as Hex,
    tokenAddress: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Hex,
    magicPayAddress: "0x6bB3C64C382fcF8fB65b24234C455bB62b155742" as Hex,
    decimals: 6,
    currency: "USDT",
    rpcUrls: ["https://forno.celo.org", "https://rpc.ankr.com/celo", "https://1rpc.io/celo"],
  },
  ink: {
    chain: ink,
    routerAddress: "" as Hex, // Awaiting MoniPayRouter deployment on Ink
    tokenAddress: "0x2D270e6886d130D724215A266106e6832161EAEd" as Hex,
    decimals: 6,
    currency: "USDC",
    rpcUrls: [inkRpcUrl, "https://ink.drpc.org", "https://ink-public.nodies.app"],
  },
};

// ============ ERC-8021 Builder Code (Base Only) ============

const BUILDER_CODE = "bc_qt9yxo1d";

// Pre-encoded suffix for bc_qt9yxo1d
const BUILDER_CODE_SUFFIX = "802162635f71743979786f31640b00802180218021802180218021802180218021";

function generateBuilderCodeSuffix(): string {
  return BUILDER_CODE_SUFFIX;
}

function appendBuilderCode(calldata: string): string {
  if (!calldata || !calldata.startsWith("0x")) return calldata;
  return `${calldata}${generateBuilderCodeSuffix()}`;
}

function isBaseNetwork(networkId: string): boolean {
  return networkId === "base";
}

// ============ ERC-8021 Celo Attribution Tag ============
const CELO_TAG_SUFFIX = "63656c6f5f623631383661663766343234110080218021802180218021802180218021";

function appendCeloAttribution(calldata: string): string {
  if (!calldata || !calldata.startsWith("0x")) return calldata;
  return `${calldata}${CELO_TAG_SUFFIX}`;
}

function isCeloNetwork(networkId: string): boolean {
  return networkId === "celo";
}

function getNetworkConfig(network?: string): NetworkConfig {
  const id = (network || "base").toLowerCase();
  return NETWORK_CONFIGS[id as NetworkId] || NETWORK_CONFIGS.base;
}

// MoniPayRouter ABI (only the functions we need)
const ROUTER_ABI = parseAbi([
  "function relayPayment(address from, address to, uint256 amount, uint256 fee, uint256 nonce, uint256 deadline, bytes signature) external",
  "function isNonceUsed(address user, uint256 nonce) view returns (bool)",
  "function calculateFee(uint256 totalAmount) pure returns (uint256)",
  "function processPayment(address from, address to, uint256 amount, uint256 nonce) external returns (bool)",
]);

// ERC-20 ABI for allowance/balance check
const TOKEN_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const MAGIC_PAY_ABI = [
  { name: "executeCreate", type: "function", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "amount", type: "uint256" }, { name: "recipientId", type: "bytes32" }], outputs: [{ name: "iouId", type: "uint256" }] },
  { name: "IOUCreated", type: "event", inputs: [
    { name: "iouId", type: "uint256", indexed: true },
    { name: "sender", type: "address", indexed: true },
    { name: "recipientId", type: "bytes32", indexed: true },
    { name: "grossAmount", type: "uint256", indexed: false },
    { name: "netAmount", type: "uint256", indexed: false },
    { name: "fee", type: "uint256", indexed: false },
    { name: "expiry", type: "uint64", indexed: false },
  ] },
] as const;

function getMagicPayRecipientId(platform: string, userId: string): Hex {
  return keccak256(encodePacked(["string", "string", "string"], [platform.toLowerCase(), ":", String(userId)]));
}

function toTokenUnits(value: bigint, decimals: number): number {
  return Number(value) / Math.pow(10, decimals);
}

function createClientsForNetwork(config: NetworkConfig, relayerKey?: string) {
  const rpcUrl = config.rpcUrls[0];
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
  });

  let walletClient = null;
  if (relayerKey) {
    const account = privateKeyToAccount(`0x${relayerKey.replace('0x', '')}` as Hex);
    walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(rpcUrl),
    });
  }

  return { publicClient, walletClient };
}

/**
 * Try a read against each RPC in order; return the first success.
 * Used for getNonce/checkApproval to dodge 429s on public Base RPCs.
 */
async function readContractWithFailover<T>(
  config: NetworkConfig,
  fn: (client: ReturnType<typeof createPublicClient>) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const rpc of config.rpcUrls) {
    try {
      const client = createPublicClient({ chain: config.chain, transport: http(rpc) });
      return await fn(client as any);
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Only failover on rate-limit / network / 429 type errors
      const isRetryable =
        msg.includes("429") ||
        msg.includes("over rate limit") ||
        msg.includes("rate limit") ||
        msg.includes("fetch failed") ||
        msg.includes("HTTP request failed");
      if (!isRetryable) throw err;
      console.warn(`[rpc-failover] ${rpc} failed (${msg.slice(0, 80)}), trying next…`);
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All RPCs failed");
}

async function syncExternalIncomingTransfers(opts: {
  supabase: any;
  publicClient: any;
  profileId: string;
  walletAddress: Hex;
  tokenAddress: Hex;
  decimals: number;
  blocksBack?: bigint;
  chainId?: number;
}) {
  const { supabase, publicClient, profileId, walletAddress, tokenAddress, decimals, chainId } = opts;
  // BSC produces blocks every ~3s, so 5000 blocks = ~4hrs and hits RPC limits
  // Use 1000 blocks for BSC (~50min), 5000 for Base (~2.5hrs)
  const defaultBlocksBack = chainId === 56 ? 1_000n : 5_000n;
  const blocksBack = opts.blocksBack ?? defaultBlocksBack;

  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > blocksBack ? latestBlock - blocksBack : 0n;

  const logs = await publicClient.getLogs({
    address: tokenAddress,
    event: TRANSFER_EVENT,
    args: { to: walletAddress },
    fromBlock,
    toBlock: latestBlock,
  });

  if (!logs.length) return;

  const sorted = [...logs].sort((a: any, b: any) => Number(b.blockNumber - a.blockNumber));

  for (const log of sorted) {
    const txHash = (log as any).transactionHash as string | null;
    if (!txHash) continue;

    const { data: existing, error: existingError } = await (supabase as any)
      .from("transactions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("tx_hash", txHash)
      .eq("type", "received")
      .limit(1);

    if (existingError) {
      console.error("[external-sync] Failed to check existing tx:", existingError);
      continue;
    }

    if (existing && existing.length > 0) continue;

    const block = await publicClient.getBlock({ blockNumber: (log as any).blockNumber });
    const createdAt = new Date(Number(block.timestamp) * 1000).toISOString();

    const amount = toTokenUnits((log as any).args.value as bigint, decimals);
    const from = ((log as any).args.from as string) || "";

    const { error: insertError } = await (supabase as any).from("transactions").insert({
      profile_id: profileId,
      type: "received",
      amount,
      fee: 0,
      counterparty: from,
      tx_hash: txHash,
      status: "completed",
      created_at: createdAt,
      payer_pay_tag: null,
      items: null,
      invoice_id: null,
      source: "external",
    });

    if (insertError) {
      console.error("[external-sync] Failed to insert external received tx:", insertError);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Read body once for signature verification
  const bodyText = await req.text();
  
  // Verify request signature
  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    console.error("Signature verification failed:", signatureResult.error);
    return unauthorizedResponse(signatureResult.error);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Some clients/proxies accidentally wrap payloads as { body: { ... } }.
    const parsed = bodyText ? JSON.parse(bodyText) : {};
    const payload = parsed?.body && typeof parsed.body === "object" ? parsed.body : parsed;

    const {
      action,
      signature,
      message,
      senderProfileId,
      recipientPayTag,
      recipientAddress,
      items,
      invoiceId,
      network: requestNetwork,
    } = payload ?? {};

    console.log(
      "relay-payment request:",
      JSON.stringify({
        action,
        hasMessage: Boolean(message),
        hasSignature: Boolean(signature),
        senderProfileId,
        network: requestNetwork || "base",
        wrappedBody: Boolean(parsed?.body),
      })
    );

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // Resolve network config - check sender's preferred network or use explicit network param
    const resolveNetwork = async (): Promise<string> => {
      if (requestNetwork) return requestNetwork;
      if (senderProfileId) {
        const principal = await loadPrincipal(supabase, senderProfileId);
        if (principal?.preferred_network) return principal.preferred_network;
      }
      return "base";
    };

    // Relay a real on-chain payment
    if (action === "relay") {
      // Dual rate limiting: per wallet AND per IP to prevent treasury drain
      const rateLimitKey = message?.from || senderProfileId || clientIP;
      const walletRateLimit = await checkRateLimit(rateLimitKey, RATE_LIMITS.relay);
      if (!walletRateLimit.allowed) {
        console.warn(`Wallet rate limit exceeded for relay: ${rateLimitKey}`);
        return rateLimitedResponse(walletRateLimit);
      }
      
      const ipRateLimit = await checkRateLimit(clientIP, RATE_LIMITS.relayIP);
      if (!ipRateLimit.allowed) {
        console.warn(`IP rate limit exceeded for relay: ${clientIP}`);
        return rateLimitedResponse(ipRateLimit);
      }

      if (!message || !senderProfileId || !signature) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: message, senderProfileId, signature" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { from, to, amount, fee, nonce, deadline } = message;
      
      if (!from || !to || !amount || fee === undefined || nonce === undefined || !deadline) {
        return new Response(
          JSON.stringify({ error: "Invalid message structure" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const networkId = await resolveNetwork();
      const config = getNetworkConfig(networkId);
      const isTempo = networkId === "tempo";

      console.log(`Processing payment: ${toTokenUnits(BigInt(amount), config.decimals)} ${config.currency} from ${from} to ${to} [${networkId}]`);

      const relayerPrivateKey = Deno.env.get("RELAYER_PRIVATE_KEY");
      if (!relayerPrivateKey) {
        console.error("RELAYER_PRIVATE_KEY not configured");
        return new Response(
          JSON.stringify({ error: "Relayer not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { publicClient, walletClient } = createClientsForNetwork(config, relayerPrivateKey);

      // Check user's token balance
      const balance = await publicClient.readContract({
        address: config.tokenAddress,
        abi: TOKEN_ABI,
        functionName: "balanceOf",
        args: [from as Hex],
      });

      if (balance < BigInt(amount)) {
        return new Response(
          JSON.stringify({ error: `Insufficient ${config.currency} balance` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check user's allowance to the router
      const allowance = await publicClient.readContract({
        address: config.tokenAddress,
        abi: TOKEN_ABI,
        functionName: "allowance",
        args: [from as Hex, config.routerAddress],
      });

      if (allowance < BigInt(amount)) {
        return new Response(
          JSON.stringify({ 
            error: `Insufficient ${config.currency} allowance`,
            needsApproval: true,
            requiredAllowance: amount.toString(),
            currentAllowance: allowance.toString(),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let txHash: Hex;
      try {
        if (isTempo) {
          // Tempo: Use processPayment (no EIP-712 signature needed)
          // The relayer calls processPayment which does transferFrom
          console.log(`Submitting Tempo processPayment...`);
          let gasPrice = await publicClient.getGasPrice();
          const relayerAddr = walletClient!.account.address;

          let lastErr: unknown;
          let sent: Hex | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const pendingNonce = await publicClient.getTransactionCount({
                address: relayerAddr,
                blockTag: "pending",
              });

              sent = await walletClient!.writeContract({
                address: config.routerAddress,
                abi: ROUTER_ABI,
                functionName: "processPayment",
                args: [
                  from as Hex,
                  to as Hex,
                  BigInt(amount),
                  BigInt(nonce || 0),
                ],
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
          txHash = sent;
        } else {
          // Base/BSC: Use EIP-712 relayPayment with signature
          // Check if nonce is already used
          const nonceUsed = await publicClient.readContract({
            address: config.routerAddress,
            abi: ROUTER_ABI,
            functionName: "isNonceUsed",
            args: [from as Hex, BigInt(nonce)],
          });

          if (nonceUsed) {
            return new Response(
              JSON.stringify({ error: "Nonce already used" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Check deadline
          const now = Math.floor(Date.now() / 1000);
          if (Number(deadline) < now) {
            return new Response(
              JSON.stringify({ error: "Payment authorization expired" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          console.log(`Submitting transaction to MoniPayRouter on ${networkId}...`);

          // Encode calldata
          let calldata = encodeFunctionData({
            abi: ROUTER_ABI,
            functionName: "relayPayment",
            args: [
              from as Hex,
              to as Hex,
              BigInt(amount),
              BigInt(fee),
              BigInt(nonce),
              BigInt(deadline),
              signature as Hex,
            ],
          });

          // Append ERC-8021 Builder Code suffix for Base only
          if (isBaseNetwork(networkId)) {
            calldata = appendBuilderCode(calldata) as Hex;
            console.log(`Builder Code appended for Base transaction`);
          } else if (isCeloNetwork(networkId)) {
            calldata = appendCeloAttribution(calldata) as Hex;
            console.log(`Attribution Tag appended for Celo transaction`);
          }

          let gasPrice = await publicClient.getGasPrice();
          const relayerAddr = walletClient!.account.address;

          let lastErr: unknown;
          let sent: Hex | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const pendingNonce = await publicClient.getTransactionCount({
                address: relayerAddr,
                blockTag: "pending",
              });

              sent = await walletClient!.sendTransaction({
                chain: config.chain,
                to: config.routerAddress,
                data: calldata,
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
          txHash = sent;
        }
      } catch (txError) {
        console.error("Transaction failed:", txError);
        return new Response(
          JSON.stringify({ 
            error: "Transaction failed", 
            details: txError instanceof Error ? txError.message : "Unknown error" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Transaction submitted: ${txHash}`);

      // Wait for transaction receipt (with timeout)
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        });
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      } catch (receiptError) {
        console.error("Error waiting for receipt:", receiptError);
      }

      const status = receipt?.status === "success" ? "completed" : receipt?.status === "reverted" ? "failed" : "pending";
      
      const amountToken = toTokenUnits(BigInt(amount), config.decimals);
      const feeToken = toTokenUnits(BigInt(fee), config.decimals);

      // Determine counterparty display name
      let counterparty = recipientPayTag || (to as string).slice(0, 10) + "...";
      
      // Get sender's PayTag
      const senderPrincipal = await loadPrincipal(supabase, senderProfileId);
      const senderPayTag = senderPrincipal?.pay_tag || (from as string).slice(0, 10) + "...";

      // Determine transaction source
      const txSource = invoiceId ? "invoice" : "p2p";

      // Record sender's transaction (sent)
      const { error: senderError } = await supabase
        .from("transactions")
        .insert({
          profile_id: senderProfileId,
          type: "sent",
          amount: amountToken,
          fee: feeToken,
          counterparty: counterparty,
          tx_hash: txHash,
          status: status,
          items: items || null,
          invoice_id: invoiceId || null,
          payer_pay_tag: senderPayTag,
          source: txSource,
          metadata: networkId !== "base" ? { network: networkId } : null,
        });

      if (senderError) {
        console.error("Failed to record sender transaction:", senderError);
      }

      // If recipient has a profile, record their transaction (received)
      if (recipientPayTag) {
        const { data: recipientProfile } = await supabase
          .from("profiles")
          .select("id, pay_tag")
          .eq("pay_tag", recipientPayTag.toLowerCase())
          .maybeSingle();

        if (recipientProfile) {
          const { error: recipientError } = await supabase
            .from("transactions")
            .insert({
              profile_id: recipientProfile.id,
              type: "received",
              amount: amountToken,
              fee: 0,
              counterparty: senderPayTag,
              tx_hash: txHash,
              status: status,
              items: items || null,
              invoice_id: invoiceId || null,
              payer_pay_tag: senderPayTag,
              source: txSource,
              metadata: networkId !== "base" ? { network: networkId } : null,
            });

          if (recipientError) {
            console.error("Failed to record recipient transaction:", recipientError);
          }
        }
      }

      console.log(`Payment ${status}: ${txHash} [${networkId}]`);

      return new Response(
        JSON.stringify({ 
          success: status === "completed",
          txHash: txHash,
          amount: amountToken,
          fee: feeToken,
          status: status,
          blockNumber: receipt?.blockNumber?.toString(),
          network: networkId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token approval status
    if (action === "checkApproval") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { walletAddress, network: approvalNetwork } = message || {};
      
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "Missing walletAddress" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = getNetworkConfig(approvalNetwork || requestNetwork);

      const allowance = await readContractWithFailover(config, (client) =>
        client.readContract({
          address: config.tokenAddress,
          abi: TOKEN_ABI,
          functionName: "allowance",
          args: [walletAddress as Hex, config.routerAddress],
        }) as Promise<bigint>
      );

      const balance = await readContractWithFailover(config, (client) =>
        client.readContract({
          address: config.tokenAddress,
          abi: TOKEN_ABI,
          functionName: "balanceOf",
          args: [walletAddress as Hex],
        }) as Promise<bigint>
      );

      const divisor = Math.pow(10, config.decimals);

      // Determine network name from config
      const resolvedNetworkName = config.currency === "aUSD" ? "tempo" : config.currency === "USDT" ? "bsc" : "base";

      return new Response(
        JSON.stringify({
          allowance: allowance.toString(),
          allowanceFormatted: Number(allowance) / divisor,
          balance: balance.toString(),
          balanceFormatted: Number(balance) / divisor,
          hasUnlimitedApproval: allowance > BigInt("0xffffffffffffffffffffffff"),
          routerAddress: config.routerAddress,
          network: resolvedNetworkName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get next available nonce for a user
    if (action === "getNonce") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { walletAddress, network: nonceNetwork } = message || {};
      
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "Missing walletAddress" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = getNetworkConfig(nonceNetwork || requestNetwork);

      let nonce = 0;
      while (nonce < 1000) {
        const used = await readContractWithFailover(config, (client) =>
          client.readContract({
            address: config.routerAddress,
            abi: ROUTER_ABI,
            functionName: "isNonceUsed",
            args: [walletAddress as Hex, BigInt(nonce)],
          }) as Promise<boolean>
        );

        if (!used) break;
        nonce++;
      }

      return new Response(
        JSON.stringify({ nonce }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check transaction status on-chain
    if (action === "checkTxStatus") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { txHash, network: txNetwork } = message || {};
      
      if (!txHash) {
        return new Response(
          JSON.stringify({ error: "Missing txHash" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = getNetworkConfig(txNetwork || requestNetwork);
      const { publicClient } = createClientsForNetwork(config);

      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: txHash as Hex,
        });

        let status: 'pending' | 'confirmed' | 'failed' = 'pending';
        if (receipt) {
          status = receipt.status === 'success' ? 'confirmed' : 'failed';
        }

        return new Response(
          JSON.stringify({ 
            status,
            blockNumber: receipt?.blockNumber?.toString(),
            gasUsed: receipt?.gasUsed?.toString(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ status: 'pending' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update transaction items (for external payments where merchant wants to add cart info)
    if (action === "updateItems") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { txId, profileId, items: updateItems } = message || {};

      if (!txId || !profileId) {
        return new Response(
          JSON.stringify({ error: "Missing txId or profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingTx, error: fetchError } = await supabase
        .from("transactions")
        .select("id, items")
        .eq("id", txId)
        .eq("profile_id", profileId)
        .maybeSingle();

      if (fetchError || !existingTx) {
        return new Response(
          JSON.stringify({ error: "Transaction not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("transactions")
        .update({ items: updateItems || null })
        .eq("id", txId)
        .eq("profile_id", profileId);

      if (updateError) {
        console.error("Failed to update transaction items:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get transaction history for a profile (server-side merge + cursor pagination)
    if (action === "history") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { profileId, limit: historyLimit = 50, cursor } = { profileId: senderProfileId, limit: 50, cursor: null as string | null, ...message };
      const pageSize = Math.min(historyLimit, 200);

      // Sync external incoming transfers — check both `profiles` and `wallet_profiles`
      // so MiniPay (wallet-only) users also get external deposits picked up.
      let profileRow: { wallet_address: string | null; preferred_network: string | null } | null = null;
      {
        const { data: p } = await supabase
          .from("profiles")
          .select("wallet_address, preferred_network")
          .eq("id", profileId)
          .maybeSingle();
        if (p?.wallet_address) {
          profileRow = { wallet_address: p.wallet_address, preferred_network: p.preferred_network };
        } else {
          const { data: w } = await supabase
            .from("wallet_profiles")
            .select("wallet_address, preferred_network")
            .eq("id", profileId)
            .maybeSingle();
          if (w?.wallet_address) {
            profileRow = { wallet_address: w.wallet_address, preferred_network: w.preferred_network };
          }
        }
      }

      if (profileRow?.wallet_address) {
        const networkId = profileRow.preferred_network || "base";
        const config = getNetworkConfig(networkId);
        const { publicClient } = createClientsForNetwork(config);

        try {
          await syncExternalIncomingTransfers({
            supabase,
            publicClient,
            profileId,
            walletAddress: profileRow.wallet_address as Hex,
            tokenAddress: config.tokenAddress,
            decimals: config.decimals,
            chainId: config.chain.id,
          });
        } catch (syncErr) {
          console.error("[external-sync] Failed to sync external transfers:", syncErr);
        }
      }

      // Fetch main transactions with cursor pagination
      let mainQuery = supabase
        .from("transactions")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (cursor) {
        mainQuery = mainQuery.lt("created_at", cursor);
      }

      const { data: mainData, error: mainError } = await mainQuery;

      if (mainError) {
        console.error("Failed to fetch history:", mainError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch transaction history" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch monibot transactions (same cursor logic)
      let monibotQuery = supabase
        .from("monibot_transactions")
        .select("*")
        .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (cursor) {
        monibotQuery = monibotQuery.lt("created_at", cursor);
      }

      const { data: monibotData } = await monibotQuery;

      // Resolve profile IDs from monibot transactions to pay_tags
      const profileIdsToResolve = new Set<string>();
      (monibotData || []).forEach((tx: any) => {
        if (tx.sender_id && tx.sender_id !== profileId) profileIdsToResolve.add(tx.sender_id);
        if (tx.receiver_id && tx.receiver_id !== profileId) profileIdsToResolve.add(tx.receiver_id);
      });

      let profilePayTagMap: Record<string, string> = {};
      if (profileIdsToResolve.size > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, pay_tag")
          .in("id", Array.from(profileIdsToResolve));

        if (profilesData) {
          profilesData.forEach((p: any) => {
            if (p.id && p.pay_tag) profilePayTagMap[p.id] = p.pay_tag;
          });
        }
      }

      // Map monibot transactions to unified format
      const mappedMonibot = (monibotData || []).map((tx: any) => {
        const isSender = tx.sender_id === profileId;
        const source = tx.type === "grant" ? "monibot_grant" : tx.type === "magicpay" ? "magicpay" : "monibot_p2p";
        const monibotType = tx.type === "grant" ? "grant" : tx.type === "magicpay" ? "magicpay" : "p2p";

        let counterparty: string;
        if (isSender) {
          counterparty = tx.recipient_pay_tag || profilePayTagMap[tx.receiver_id] || tx.receiver_id;
        } else {
          counterparty = tx.payer_pay_tag || profilePayTagMap[tx.sender_id] || "monibot";
        }

        return {
          id: `monibot_${tx.id}`,
          type: isSender ? "sent" : "received",
          amount: parseFloat(tx.amount),
          fee: isSender ? parseFloat(tx.fee) : 0,
          counterparty,
          created_at: tx.created_at,
          tx_hash: tx.tx_hash,
          payer_pay_tag: tx.payer_pay_tag,
          source,
          metadata: {
            monibot_type: monibotType,
            tweet_id: tx.tweet_id,
            campaign_id: tx.campaign_id,
            network: tx.chain?.toLowerCase(),
          },
          items: null,
          invoice_id: null,
        };
      });

      // Merge by tx_hash deduplication (prefer monibot enrichment)
      const normHash = (h?: string | null) => {
        if (!h) return null;
        const t = String(h).trim().toLowerCase();
        return t.startsWith("0x") ? t : `0x${t}`;
      };

      const byHash = new Map<string, any>();

      for (const tx of (mainData || [])) {
        const key = normHash(tx.tx_hash);
        const mapKey = key || `nohash_${tx.id}`;
        const existing = byHash.get(mapKey);
        if (existing) {
          // Same tx_hash: prefer the record with a more specific source
          const existingSrc = (existing.source || "").trim().toLowerCase();
          const newSrc = (tx.source || "").trim().toLowerCase();
          const isNewMoreSpecific = (!existingSrc || existingSrc === "p2p") && newSrc && newSrc !== "p2p";
          if (isNewMoreSpecific) {
            byHash.set(mapKey, { ...existing, ...tx, source: newSrc });
          }
          // else keep existing (it already has better source)
        } else {
          byHash.set(mapKey, tx);
        }
      }

      for (const mb of mappedMonibot) {
        const key = normHash(mb.tx_hash);
        if (!key) {
          byHash.set(`nohash_${mb.id}`, mb);
          continue;
        }

        const existing = byHash.get(key);
        if (!existing) {
          byHash.set(key, mb);
          continue;
        }

        // Merge: enrich with monibot source/metadata/counterparty
        const existingIsAddress = existing.counterparty?.startsWith("0x");
        const mbIsResolved = mb.counterparty && !mb.counterparty.startsWith("0x");

        const mergedSource = (() => {
          const es = typeof existing.source === "string" ? existing.source.trim().toLowerCase() : null;
          const ms = typeof mb.source === "string" ? mb.source.trim().toLowerCase() : null;
          if (ms?.startsWith("monibot_")) return ms;
          if (!es || es === "p2p") return ms || es;
          return es || ms;
        })();

        byHash.set(key, {
          ...existing,
          counterparty: existingIsAddress && mbIsResolved ? mb.counterparty : existing.counterparty,
          source: mergedSource,
          metadata: { ...(existing.metadata || {}), ...(mb.metadata || {}) },
          payer_pay_tag: existing.payer_pay_tag || mb.payer_pay_tag,
        });
      }

      // Sort merged results by created_at descending and apply page size
      const merged = Array.from(byHash.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, pageSize);

      // Determine next cursor
      const nextCursor = merged.length === pageSize ? merged[merged.length - 1].created_at : null;

      return new Response(
        JSON.stringify({ transactions: merged, nextCursor, hasMore: merged.length === pageSize }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bot-initiated MagicPay transfer (called by scheduled-executor)
    if (action === "bot-magicpay") {
      const { senderProfileId: botSenderId, amount: botAmount, chain: botChain, platform, platformUserId, recipientUsername, source: botSource } = payload ?? {};
      if (!botSenderId || !botAmount || !platform || !platformUserId) {
        return new Response(JSON.stringify({ success: false, error: "Missing senderProfileId, amount, platform, or platformUserId" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const sender = await loadPrincipal(supabase, botSenderId);
      if (!sender?.wallet_address) {
        return new Response(JSON.stringify({ success: false, error: "Sender profile not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const networkId = (botChain || sender.preferred_network || "base").toLowerCase() as NetworkId;
      const config = getNetworkConfig(networkId);
      if (!config.magicPayAddress) {
        return new Response(JSON.stringify({ success: false, error: `MagicPay is not supported on ${networkId}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const executorKey = Deno.env.get("MONIBOT_WALLET_PRIVATE_KEY");
      if (!executorKey) {
        return new Response(JSON.stringify({ success: false, error: "Bot executor key not configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { publicClient, walletClient } = createClientsForNetwork(config, executorKey);
      const amountRaw = parseUnits(String(botAmount), config.decimals);
      const recipientHash = getMagicPayRecipientId(platform, String(platformUserId));

      const [balance, allowance] = await Promise.all([
        publicClient.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [sender.wallet_address as Hex] }),
        publicClient.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: "allowance", args: [sender.wallet_address as Hex, config.magicPayAddress] }),
      ]);
      if ((balance as bigint) < amountRaw) return new Response(JSON.stringify({ success: false, error: `Insufficient ${config.currency} balance for MagicPay` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if ((allowance as bigint) < amountRaw) return new Response(JSON.stringify({ success: false, error: `Insufficient ${config.currency} MagicPay allowance` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const calldata = encodeFunctionData({ abi: MAGIC_PAY_ABI, functionName: "executeCreate", args: [sender.wallet_address as Hex, amountRaw, recipientHash] });
      
      let txHash: Hex;
      let gasPrice = await publicClient.getGasPrice();
      const relayerAddr = walletClient!.account.address;

      let lastErr: unknown;
      let sent: Hex | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pendingNonce = await publicClient.getTransactionCount({
            address: relayerAddr,
            blockTag: "pending",
          });

          sent = await walletClient!.sendTransaction({
            chain: config.chain,
            to: config.magicPayAddress,
            data: calldata,
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
      txHash = sent;
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      if (receipt.status === "reverted") return new Response(JSON.stringify({ success: false, error: "MagicPay transaction reverted", txHash }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let iouId = `${Date.now()}`;
      let fee = 0;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== config.magicPayAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: MAGIC_PAY_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === "IOUCreated") {
            iouId = decoded.args.iouId.toString();
            fee = Number(formatUnits(decoded.args.fee as bigint, config.decimals));
          }
        } catch {}
      }

      await supabase.from("ious").insert({
        iou_id: iouId,
        sender_profile_id: botSenderId,
        sender_pay_tag: sender.pay_tag || "unknown",
        recipient_identifier: `${platform}:${recipientUsername || platformUserId}`,
        recipient_id: `${platform}:${platformUserId}`,
        platform,
        platform_user_id: String(platformUserId),
        amount: botAmount,
        chain: networkId,
        token: config.tokenAddress,
        token_symbol: config.currency,
        status: "pending",
        expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        tx_hash_create: txHash,
      });

      return new Response(JSON.stringify({ success: true, txHash, fee, amount: botAmount, network: networkId, iouId, source: botSource }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Bot-initiated P2P transfer (called by scheduled-executor)
    if (action === "bot-p2p") {
      const { senderProfileId: botSenderId, recipientProfileId, amount: botAmount, chain: botChain, source: botSource } = payload ?? {};

      if (!botSenderId || !recipientProfileId || !botAmount) {
        return new Response(
          JSON.stringify({ error: "Missing senderProfileId, recipientProfileId, or amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sender = await loadPrincipal(supabase, botSenderId);
      const recipient = await loadPrincipal(supabase, recipientProfileId);

      if (!sender) {
        return new Response(JSON.stringify({ success: false, error: "Sender profile not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!recipient) {
        return new Response(JSON.stringify({ success: false, error: "Recipient profile not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const networkId = (botChain || sender.preferred_network || "base").toLowerCase() as NetworkId;

      // MoniBotRouter addresses per network (different from MoniPayRouter!)
      const MONIBOT_ROUTERS: Record<string, Hex> = {
        base: "0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516" as Hex,
        bsc: "0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E" as Hex,
        celo: "0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e" as Hex,
        tempo: "0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc" as Hex,
      };

      const moniBotRouterAddress = MONIBOT_ROUTERS[networkId];
      if (!moniBotRouterAddress) {
        return new Response(JSON.stringify({ success: false, error: `Unsupported network for bot-p2p: ${networkId}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const config = getNetworkConfig(networkId);

      // Use MONIBOT_WALLET_PRIVATE_KEY (executor on MoniBotRouter)
      const executorKey = Deno.env.get("MONIBOT_WALLET_PRIVATE_KEY");
      if (!executorKey) {
        return new Response(JSON.stringify({ error: "Bot executor key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { publicClient, walletClient } = createClientsForNetwork(config, executorKey);

      const senderAddress = sender.wallet_address as Hex;
      const recipientAddress = recipient.wallet_address as Hex;
      if (!senderAddress || !recipientAddress) {
        return new Response(JSON.stringify({ success: false, error: "Sender or recipient wallet address missing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const amountRaw = BigInt(Math.round(botAmount * Math.pow(10, config.decimals)));

      const MONIBOT_ROUTER_ABI = [
        {
          name: "executeP2P",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "tweetId", type: "string" },
          ],
          outputs: [{ type: "bool" }],
        },
        {
          name: "getNonce",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "user", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
        {
          name: "calculateFee",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "amount", type: "uint256" }],
          outputs: [{ name: "fee", type: "uint256" }, { name: "netAmount", type: "uint256" }],
        },
      ] as const;

      // Batch: get nonce, balance, allowance in parallel
      const [nonce, balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: moniBotRouterAddress,
          abi: MONIBOT_ROUTER_ABI,
          functionName: "getNonce",
          args: [senderAddress],
        }),
        publicClient.readContract({
          address: config.tokenAddress,
          abi: TOKEN_ABI,
          functionName: "balanceOf",
          args: [senderAddress],
        }),
        publicClient.readContract({
          address: config.tokenAddress,
          abi: TOKEN_ABI,
          functionName: "allowance",
          args: [senderAddress, moniBotRouterAddress], // allowance to MoniBotRouter, not MoniPayRouter!
        }),
      ]);

      if (balance < amountRaw) {
        return new Response(JSON.stringify({ success: false, error: `Insufficient ${config.currency} balance` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (allowance < amountRaw) {
        return new Response(JSON.stringify({ success: false, error: `Insufficient ${config.currency} allowance to MoniBotRouter` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get fee
      const [fee] = await publicClient.readContract({
        address: moniBotRouterAddress,
        abi: MONIBOT_ROUTER_ABI,
        functionName: "calculateFee",
        args: [amountRaw],
      });

      // Generate unique tweetId for deduplication (scheduled jobs use job context)
      const tweetId = botSource ? `scheduled_${Date.now()}` : `bot_${Date.now()}`;

      // Execute via MoniBotRouter.executeP2P
      let txHash: Hex;
      try {
        console.log(`[bot-p2p] Executing via MoniBotRouter: ${sender.pay_tag} → ${recipient.pay_tag}, ${botAmount} ${config.currency} on ${networkId}, nonce=${nonce}`);

        let calldata = encodeFunctionData({
          abi: MONIBOT_ROUTER_ABI,
          functionName: "executeP2P",
          args: [senderAddress, recipientAddress, amountRaw, nonce as bigint, tweetId],
        });

        if (isBaseNetwork(networkId)) {
          calldata = appendBuilderCode(calldata) as Hex;
        } else if (isCeloNetwork(networkId)) {
          calldata = appendCeloAttribution(calldata) as Hex;
        }

        let gasPrice = await publicClient.getGasPrice();
        const relayerAddr = walletClient!.account.address;

        let lastErr: unknown;
        let sent: Hex | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const pendingNonce = await publicClient.getTransactionCount({
              address: relayerAddr,
              blockTag: "pending",
            });

            sent = await walletClient!.sendTransaction({
              chain: config.chain,
              to: moniBotRouterAddress,
              data: calldata,
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
        txHash = sent;
      } catch (txError: any) {
        console.error("[bot-p2p] Transaction failed:", txError.message);
        return new Response(JSON.stringify({ success: false, error: txError.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Wait for receipt
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      } catch (e) {
        console.error("[bot-p2p] Receipt wait failed:", e);
      }

      const status = receipt?.status === "success" ? "completed" : "pending";
      const feeFormatted = toTokenUnits(fee as bigint, config.decimals);

      // Record transactions in ledger
      await supabase.from("transactions").insert({
        profile_id: botSenderId,
        type: "sent",
        amount: botAmount,
        fee: feeFormatted,
        counterparty: recipient.pay_tag,
        tx_hash: txHash,
        status,
        payer_pay_tag: sender.pay_tag,
        source: "monibot_p2p",
        metadata: { network: networkId },
      });

      await supabase.from("transactions").insert({
        profile_id: recipientProfileId,
        type: "received",
        amount: botAmount - feeFormatted,
        fee: 0,
        counterparty: sender.pay_tag,
        tx_hash: txHash,
        status,
        payer_pay_tag: sender.pay_tag,
        source: "monibot_p2p",
        metadata: { network: networkId },
      });

      console.log(`[bot-p2p] ✅ Success: ${txHash} [${networkId}]`);

      return new Response(
        JSON.stringify({ success: true, txHash, fee: feeFormatted, amount: botAmount, network: networkId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Relay error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
