import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageMeta } from "@/components/PageMeta";

export default function TelegramCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Linking your Telegram account...");

  useEffect(() => {
    // Telegram Login Widget redirects here with signed query params:
    // id, first_name, last_name, username, photo_url, auth_date, hash
    // Plus our own `state` param (base64 of { profileId, walletAddress }).
    const stateParam = searchParams.get("state");
    const id = searchParams.get("id");
    const hash = searchParams.get("hash");
    const auth_date = searchParams.get("auth_date");

    if (!stateParam || !id || !hash || !auth_date) {
      setStatus("error");
      setMessage("Missing Telegram authorization parameters.");
      return;
    }

    let profileId: string;
    let walletAddress: string;
    try {
      const parsed = JSON.parse(atob(stateParam));
      profileId = parsed.profileId;
      walletAddress = parsed.walletAddress;
      if (!profileId || !walletAddress) throw new Error("Missing fields");
    } catch {
      setStatus("error");
      setMessage("Invalid session state. Please close this tab and try again.");
      return;
    }

    // Forward the entire widget payload to the edge function for HMAC verification.
    const widgetPayload: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "state") widgetPayload[key] = value;
    });

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("social-identity", {
          body: {
            action: "link-telegram",
            profileId,
            walletAddress,
            widgetPayload,
          },
        });

        if (error) throw error;
        if (data?.error) {
          // Cross-context conflict (also linked on legacy/wallet side).
          if (/already linked/i.test(data.error) && window.opener && !window.opener.closed) {
            const m = data.error.match(/@([a-z0-9_]+)/i);
            window.opener.postMessage({
              type: "social-link-conflict",
              platform: "telegram",
              message: data.error,
              payTag: m ? m[1] : null,
            }, window.location.origin);
            setTimeout(() => window.close(), 400);
            return;
          }
          setStatus("error");
          setMessage(data.error);
          return;
        }

        setStatus("success");
        setMessage(`Connected as @${data.telegram_username || data.telegram_id}!`);

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "telegram-oauth-success",
              telegram_id: data.telegram_id,
              telegram_username: data.telegram_username,
            },
            window.location.origin,
          );
          setTimeout(() => window.close(), 1500);
        }
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Failed to link Telegram account. Please try again.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <PageMeta title="Telegram Linking" description="Linking your Telegram account to MoniPay." path="/telegram-callback" noIndex noIndexFollow />
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-semibold text-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold text-foreground">Telegram Linked!</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">This window will close automatically.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold text-foreground">Linking Failed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => window.close()}
              className="text-sm text-primary underline mt-2"
            >
              Close this window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
