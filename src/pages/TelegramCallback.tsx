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