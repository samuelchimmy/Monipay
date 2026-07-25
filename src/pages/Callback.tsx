/**
 * /x-callback  — X (Twitter) OAuth 2.0 callback page
 *
 * Flow:
 *  1. X redirects here with ?code=…&state=…
 *  2. We call our `social-identity` edge function (link-x-oauth action)
 *     which exchanges the code for a token and persists x_username + x_user_id
 *  3. On success we post "x-oauth-success" to window.opener and close
 *  4. On error we show a readable message so the user isn't stuck
 *
 * Drop this file at:   src/pages/XCallback.tsx
 * Add route in your router:  <Route path="/x-callback" element={<XCallback />} />
 */

import { useEffect, useState } from "react";
import { Twitter, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Stage = "loading" | "success" | "error";

export default function XCallback() {
  const [stage, setStage] = useState<Stage>("loading");
  const [message, setMessage] = useState("Connecting your X account…");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorParam = params.get("error");

      // ── X denied / user cancelled ──────────────────────────────────
      if (errorParam) {
        setStage("error");
        setMessage(
          errorParam === "access_denied"
            ? "You cancelled the X authorization."
            : `X returned an error: ${errorParam}`,
        );
        return;
      }

      // ── Missing params ─────────────────────────────────────────────
      if (!code || !state) {
        setStage("error");
        setMessage("Missing OAuth parameters. Please try again.");
        return;
      }

      // ── Decode state  { profileId, walletAddress } ─────────────────
      let profileId: string;
      let walletAddress: string;
      try {
        const decoded = JSON.parse(atob(state));
        profileId = decoded.profileId;
        walletAddress = decoded.walletAddress;
        if (!profileId || !walletAddress) throw new Error("bad state");
      } catch {
        setStage("error");
        setMessage("Invalid OAuth state. Please try again.");
        return;
      }

      // ── Exchange code via edge function ────────────────────────────
      try {
        const redirectUri = `${window.location.origin}/x-callback`;

        const response = await supabase.functions.invoke("social-identity", {
          body: {
            action: "link-x-oauth",
            profileId,
            walletAddress,
            code,
            redirectUri,
          },
        });

        if (response.error) throw new Error(response.error.message);

        const data = response.data as { error?: string; x_username?: string };

        if (data?.error) {
          if (/already linked/i.test(data.error) && window.opener && !window.opener.closed) {
            const m = data.error.match(/@([a-z0-9_]+)/i);
            window.opener.postMessage({
              type: "social-link-conflict",
              platform: "x",
              message: data.error,
              payTag: m ? m[1] : null,
            }, window.location.origin);
            setTimeout(() => window.close(), 400);
            return;
          }
          setStage("error");
          setMessage(data.error);
          return;
        }

        const linkedUsername = data?.x_username ?? null;
        setUsername(linkedUsername);
        setStage("success");
        setMessage(
          linkedUsername
            ? `@${linkedUsername} linked successfully!`
            : "X account linked successfully!",
        );

        // ── Notify opener then close ───────────────────────────────
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "x-oauth-success",
              x_username: linkedUsername,
            },
            window.location.origin,
          );
        }

        // Brief pause so the user sees the success state
        setTimeout(() => window.close(), 1800);
      } catch (err: any) {
        setStage("error");
        setMessage(err?.message || "Something went wrong. Please try again.");
      }
    };

    run();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        margin: 0,
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: "#18181b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          border: "1px solid #27272a",
        }}
      >
        {stage === "loading" && (
          <Loader2
            style={{
              width: 24,
              height: 24,
              color: "#a1a1aa",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
        {stage === "success" && <CheckCircle2 style={{ width: 24, height: 24, color: "#22c55e" }} />}
        {stage === "error" && <XCircle style={{ width: 24, height: 24, color: "#ef4444" }} />}
      </div>

      {/* X wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Twitter style={{ width: 16, height: 16, color: "#71717a" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#52525b", textTransform: "uppercase" }}>
          X (Twitter)
        </span>
      </div>

      {/* Message */}
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 280,
          lineHeight: 1.5,
          color: stage === "error" ? "#ef4444" : stage === "success" ? "#22c55e" : "#a1a1aa",
          margin: "0 0 8px",
        }}
      >
        {message}
      </p>

      {stage === "success" && (
        <p style={{ fontSize: 12, color: "#52525b", margin: 0 }}>
          This window will close automatically…
        </p>
      )}

      {stage === "error" && (
        <button
          onClick={() => window.close()}
          style={{
            marginTop: 20,
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid #27272a",
            backgroundColor: "#18181b",
            color: "#a1a1aa",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Close window
        </button>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
