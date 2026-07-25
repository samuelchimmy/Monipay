import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadPrincipal } from "../_shared/principals.ts";
import {
  Connection,
  Transaction,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmRawTransaction,
} from "npm:@solana/web3.js@1.98.4";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "npm:@solana/spl-token@0.4.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Solana USDC mainnet mint
const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
const USDC_DECIMALS = 6;
const PLATFORM_FEE_BPS = 100; // 1%

// MoniPay treasury Solana address — set via env or fallback
// This must be a valid Solana Base58 address
const TREASURY_ADDRESS_STR = Deno.env.get("SOLANA_TREASURY_ADDRESS") || "CaU42qmZfZEGgvhhY3zPHdK4PeyuaELyLFtVkMwBkVwB";

const RPC_URLS = [
  "https://mainnet.helius-rpc.com/?api-key=a248af07-23fe-4199-85ce-1d6ac7bbe796",
  "https://beta.helius-rpc.com/?api-key=a248af07-23fe-4199-85ce-1d6ac7bbe796",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

function getConnection(): Connection {
  return new Connection(RPC_URLS[0], "confirmed");
}

function getFeePayer(): Keypair {
  const raw = Deno.env.get("SOLANA_FEEPAYER_PRIVATE_KEY");
  if (!raw) throw new Error("SOLANA_FEEPAYER_PRIVATE_KEY not configured");

  // Support both Base58 and JSON array formats
  try {
    // Try JSON array first [1,2,3,...]
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return Keypair.fromSecretKey(new Uint8Array(arr));
    }
  } catch {
    // Not JSON — try base58
  }

  // Base58 decode
  const bs58Alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of raw) {
    result = result * BigInt(58) + BigInt(bs58Alphabet.indexOf(char));
  }
  const hex = result.toString(16).padStart(128, "0");
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return Keypair.fromSecretKey(bytes);
}

function jsonResp(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ─── Return feePayer public key so client can build transactions ───
      case "getFeePayer": {
        const feePayer = getFeePayer();
        return jsonResp({
          success: true,
          feePayerPublicKey: feePayer.publicKey.toBase58(),
        });
      }

      // ─── Check / create Associated Token Account ───
      case "ensureATA": {
        const { ownerAddress } = body;
        if (!ownerAddress) {
          return jsonResp({ error: "ownerAddress required" }, 400);
        }

        const connection = getConnection();
        const feePayer = getFeePayer();
        const owner = new PublicKey(ownerAddress);
        const ata = await getAssociatedTokenAddress(USDC_MINT, owner);

        try {
          await getAccount(connection, ata);
          return jsonResp({
            success: true,
            ataAddress: ata.toBase58(),
            created: false,
          });
        } catch {
          // ATA doesn't exist — create it
          const tx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              feePayer.publicKey,
              ata,
              owner,
              USDC_MINT
            )
          );
          tx.feePayer = feePayer.publicKey;
          tx.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;
          tx.sign(feePayer);

          const sig = await sendAndConfirmRawTransaction(
            connection,
            tx.serialize(),
            { commitment: "confirmed" }
          );

          return jsonResp({
            success: true,
            ataAddress: ata.toBase58(),
            created: true,
            txHash: sig,
          });
        }
      }

      // ─── Co-sign and submit a user-signed transaction ───
      case "sendPayment": {
        const {
          serializedTransaction,
          senderProfileId,
          recipientPayTag,
          amount: paymentAmount,
        } = body;

        if (!serializedTransaction) {
          return jsonResp(
            { error: "serializedTransaction required (base64)" },
            400
          );
        }

        const connection = getConnection();
        const feePayer = getFeePayer();

        // Deserialize the partially-signed transaction from the client
        const txBuffer = Uint8Array.from(atob(serializedTransaction), (c) =>
          c.charCodeAt(0)
        );
        const tx = Transaction.from(txBuffer);

        // Verify feePayer matches our key
        if (
          !tx.feePayer ||
          tx.feePayer.toBase58() !== feePayer.publicKey.toBase58()
        ) {
          return jsonResp(
            {
              error:
                "Transaction feePayer does not match server. Use getFeePayer first.",
            },
            400
          );
        }

        // Keep the client-signed blockhash intact.
        // Replacing it here invalidates the sender signature.

        // Co-sign with feePayer
        tx.partialSign(feePayer);

        // Submit
        let txHash: string;
        try {
          txHash = await sendAndConfirmRawTransaction(
            connection,
            tx.serialize(),
            {
              commitment: "confirmed",
            }
          );
        } catch (txErr: any) {
          console.error("Solana TX failed:", txErr);
          return jsonResp(
            {
              error: "Transaction failed",
              details: txErr?.message || String(txErr),
            },
            500
          );
        }

        console.log(`Solana payment confirmed: ${txHash}`);

        // Log transactions in Supabase
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const amountNum = paymentAmount
          ? parseFloat(paymentAmount)
          : 0;
        const feeNum = amountNum * (PLATFORM_FEE_BPS / 10000);

        if (senderProfileId) {
          // Get sender's pay_tag (dual-lookup: profiles or wallet_profiles)
          const senderPrincipal = await loadPrincipal(supabase, senderProfileId);
          const senderPayTag = senderPrincipal?.pay_tag || "unknown";

          // Record sender transaction
          await supabase.from("transactions").insert({
            profile_id: senderProfileId,
            type: "sent",
            amount: amountNum,
            fee: feeNum,
            counterparty: recipientPayTag
              ? `@${recipientPayTag}`
              : "unknown",
            tx_hash: txHash,
            status: "completed",
            source: "p2p",
            metadata: { network: "solana" },
          });

          // Record recipient transaction if they have a profile
          if (recipientPayTag) {
            const { data: recipientProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("pay_tag", recipientPayTag.toLowerCase())
              .maybeSingle();

            if (recipientProfile) {
              await supabase.from("transactions").insert({
                profile_id: recipientProfile.id,
                type: "received",
                amount: amountNum - feeNum,
                fee: 0,
                counterparty: `@${senderPayTag}`,
                tx_hash: txHash,
                status: "completed",
                source: "p2p",
                metadata: { network: "solana" },
              });
            }
          }
        }

        return jsonResp({
          success: true,
          txHash,
          amount: amountNum,
          fee: feeNum,
          status: "completed",
          network: "solana",
        });
      }

      // ─── Get USDC balance for a Solana address ───
      case "getBalance": {
        const { address } = body;
        if (!address) {
          return jsonResp({ error: "address required" }, 400);
        }

        const connection = getConnection();
        const owner = new PublicKey(address);
        const ata = await getAssociatedTokenAddress(USDC_MINT, owner);

        try {
          const account = await getAccount(connection, ata);
          const balance =
            Number(account.amount) / Math.pow(10, USDC_DECIMALS);
          return jsonResp({ success: true, balance, address });
        } catch {
          return jsonResp({ success: true, balance: 0, address });
        }
      }

      default:
        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error("relay-solana-payment error:", error);
    return jsonResp({ error: error.message || "Internal error" }, 500);
  }
});
