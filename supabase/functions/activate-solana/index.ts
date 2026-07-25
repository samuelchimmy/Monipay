import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, solanaAddress } = await req.json();

    // PLACEHOLDER: Solana activation stub
    // Unlike EVM chains, Solana SPL tokens do NOT require approval transactions.
    // This function exists as a stub for future use cases:
    // - Creating Associated Token Account (ATA) for USDC if it doesn't exist
    // - Airdropping minimal SOL for first transaction (testnet)
    // - Any future activation requirements

    switch (action) {
      case 'checkActivation':
        // Solana SPL tokens are always "activated" — no approval needed
        return new Response(
          JSON.stringify({
            success: true,
            isActivated: true,
            message: 'Solana SPL tokens do not require approval. Wallet is ready to receive USDC.',
            solanaAddress,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'createATA':
        // PLACEHOLDER: Create Associated Token Account for USDC
        return new Response(
          JSON.stringify({
            success: false,
            error: 'ATA creation not yet implemented',
            message: 'Associated Token Account will be auto-created on first deposit. No action needed.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 501 }
        );

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
