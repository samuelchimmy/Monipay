import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageMeta } from "@/components/PageMeta";

export default function XCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your X account…");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error || !code || !state) {
        setStatus("error");
        setMessage(
          error === "access_denied"
            ? "Authorization cancelled."
            : "Missing OAuth parameters."
        );
        setTimeout(() => window.close(), 2000);
        return;
      }

      let profileId: string;
      let walletAddress: string;
      let codeVerifier: string;

      try {
        const decoded = JSON.parse(atob(state));
        profileId = decoded.profileId;
        walletAddress = decoded.walletAddress;
        codeVerifier = decoded.codeVerifier;
        if (!profileId || !walletAddress || !codeVerifier) throw new Error("missing");
      } catch {
        setStatus("error");
        setMessage("Invalid state parameter.");
        setTimeout(() => window.close(), 2000);
        return;
      }

      try {
        const response = await supabase.functions.invoke("social-identity", {
          body: {
            action: "link-x-oauth",
            profileId,
            walletAddress,
            code,
            codeVerifier,
            redirectUri: `${window.location.origin}/x-callback`,
          },
        });

        const errMsg = response.data?.error || response.error?.message;
        if (errMsg) {
          if (/already linked/i.test(errMsg) && window.opener && !window.opener.closed) {
            const m = errMsg.match(/@([a-z0-9_]+)/i);
            window.opener.postMessage({
              type: "social-link-conflict",
              platform: "x",
              message: errMsg,
              payTag: m ? m[1] : null,
            }, window.location.origin);
            setTimeout(() => window.close(), 400);
            return;
          }
          throw new Error(errMsg);
        }

        const { x_username, x_user_id } = response.data;

        setStatus("success");
        setMessage(`Connected as @${x_username}!`);

        // Post message to opener and retry a few times to ensure delivery
        // before closing the popup
        if (window.opener && !window.opener.closed) {
          const payload = { type: "x-oauth-success", x_username, x_user_id };

          // Send immediately
          window.opener.postMessage(payload, window.location.origin);

          // Send again after short delays to handle any timing issues
          setTimeout(() => {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(payload, window.location.origin);
            }
          }, 300);

          setTimeout(() => {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(payload, window.location.origin);
            }
          }, 800);
        }

        // Give enough time for parent to receive and process the message
        setTimeout(() => window.close(), 2000);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Something went wrong.");
        setTimeout(() => window.close(), 2500);
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <PageMeta title="X Linking" description="Linking your X account to MoniPay." path="/x-callback" noIndex noIndexFollow />
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium">{message}</p>
            <p className="text-xs text-muted-foreground">You can close this window</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
