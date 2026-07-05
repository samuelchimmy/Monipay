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