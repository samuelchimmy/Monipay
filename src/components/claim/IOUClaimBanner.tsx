import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Gift, X, ArrowRight, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IOUClaimBannerProps {
  profileId: string;
  onClaimed?: () => void;
}

interface PendingIOU {
  id: string;
  amount: number;
  token_symbol: string;
  sender_pay_tag: string;
  platform: string;
}

const DISMISS_KEY = "monipay_iou_banner_dismissed";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchJSON(body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-iou`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function IOUClaimBanner({ profileId, onClaimed }: IOUClaimBannerProps) {
  const [pendingIOUs, setPendingIOUs] = useState<PendingIOU[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
  const { toast } = useToast();

  useEffect(() => {
    if (dismissed) { setLoading(false); return; }

    // Use auto-link-check which queries by profileId
    // Also check if there's a pending claim from the /claim page
    const pendingClaim = localStorage.getItem("monipay_iou_claim_pending");
    if (pendingClaim) {
      try {
        const { iouIds } = JSON.parse(pendingClaim);
        if (iouIds?.length) {
          // Fetch these specific IOUs
          checkByProfile();
          return;
        }
      } catch { /* ignore */ }
    }

    checkByProfile();
  }, [profileId, dismissed]);

  async function checkByProfile() {
    try {
      // Query IOUs where recipient_profile_id matches (set during social linking)
      const data = await fetchJSON({ action: "auto-link-check", profileId, platform: "_all", platformUserId: "_" });
      // Also try the direct profile approach - the edge function auto-link-check 
      // assigns recipient_profile_id, so let's query that way
      setPendingIOUs(data.ious || []);
    } catch (e) {
      console.error("IOU check failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function claimAll() {
    setClaiming(true);
    try {
      for (const iou of pendingIOUs) {
        await fetchJSON({ action: "claim", iouDbId: iou.id, claimantProfileId: profileId });
      }

      toast({ title: "IOUs Claimed!", description: `$${totalAmount.toFixed(2)} credited to your wallet.` });
      setPendingIOUs([]);
      localStorage.removeItem("monipay_iou_claim_pending");
      onClaimed?.();
    } catch {
      toast({ title: "Claim Failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const totalAmount = pendingIOUs.reduce((s, i) => s + Number(i.amount), 0);

  if (dismissed || loading || pendingIOUs.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              You have ${totalAmount.toFixed(2)} to claim!
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingIOUs.length === 1
                ? `@${pendingIOUs[0].sender_pay_tag} sent you ${Number(pendingIOUs[0].amount).toFixed(2)} ${pendingIOUs[0].token_symbol}`
                : `${pendingIOUs.length} pending payments waiting for you`}
            </p>
            <Button
              onClick={claimAll}
              disabled={claiming}
              variant="primary"
              size="sm"
              className="mt-3 gap-2"
            >
              {claiming ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Claiming...</>
              ) : (
                <>Claim Now <ArrowRight className="w-3 h-3" /></>
              )}
            </Button>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
