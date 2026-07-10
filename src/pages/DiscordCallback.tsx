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