import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageMeta } from "@/components/PageMeta";

export default function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Linking your Discord account...");


  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received from Discord.");
      return;
    }

    // Parse state (contains profileId + walletAddress)
    let profileId: string, walletAddress: string;
    try {
      const parsed = JSON.parse(atob(state || ""));
      profileId = parsed.profileId;
      walletAddress = parsed.walletAddress;
    } catch {
      setStatus("error");
      setMessage("Invalid session state. Please try again.");
      return;
    }

    const redirectUri = `${window.location.origin}/discord-callback`;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("discord-oauth", {
          body: { code, redirectUri, profileId, walletAddress },
        });

        if (error) throw error;
        if (data?.error) {
          setStatus("error");
          setMessage(data.error);
          return;
        }

        setStatus("success");
        setMessage(`Connected as ${data.discord_username}!`);

        // Notify the opener window and close
        if (window.opener) {
          window.opener.postMessage({ type: "discord-oauth-success", ...data }, window.location.origin);
          setTimeout(() => window.close(), 1500);
        }
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Failed to link Discord account.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <PageMeta title="Discord Linking" description="Linking your Discord account to MoniPay." path="/discord-callback" noIndex noIndexFollow />
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
            <p className="text-lg font-semibold text-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">This window will close automatically.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold text-foreground">Linking Failed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button onClick={() => window.close()} className="text-sm text-indigo-500 underline">
              Close this window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
