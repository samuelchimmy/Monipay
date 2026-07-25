import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, PartyPopper } from "lucide-react";

interface IOUData {
  id: string;
  amount: number;
  token_symbol: string;
  sender_pay_tag: string;
  chain: string;
  created_at: string;
  platform: string | null;
}

interface IOUFoundCardProps {
  ious: IOUData[];
  platform: string;
  username: string;
  onCreateAccount: () => void;
}

export function IOUFoundCard({ ious, platform, username, onCreateAccount }: IOUFoundCardProps) {
  const hasConfettied = useRef(false);

  useEffect(() => {
    if (!hasConfettied.current && ious.length > 0) {
      hasConfettied.current = true;
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ["#0052FF", "#10B981", "#F59E0B", "#8B5CF6"],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ["#0052FF", "#10B981", "#F59E0B", "#8B5CF6"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [ious]);

  const totalAmount = ious.reduce((sum, i) => sum + Number(i.amount), 0);
  const mainIOU = ious[0];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="space-y-5"
    >
      {/* Hero celebration card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/[0.08] via-card/80 to-emerald-500/[0.06] border border-border/50 p-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/10 rounded-full blur-[80px]" />

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-emerald-400/20 border border-border/50 flex items-center justify-center mb-4"
        >
          <PartyPopper className="w-8 h-8 text-amber-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative space-y-3"
        >
          <p className="text-xs font-medium text-emerald-400 tracking-widest uppercase">You're getting paid</p>
          <div className="text-5xl font-bold text-foreground tracking-tight">
            ${totalAmount.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {ious.length === 1
              ? `@${mainIOU.sender_pay_tag} sent you $${Number(mainIOU.amount).toFixed(2)} on ${new Date(mainIOU.created_at).toLocaleDateString()}`
              : `${ious.length} payments from ${ious.map(i => `@${i.sender_pay_tag}`).join(", ")}`}
          </p>
        </motion.div>
      </div>

      {/* IOU details */}
      <div className="space-y-2.5">
        {ious.map((iou, idx) => (
          <motion.div
            key={iou.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + idx * 0.1 }}
            className="flex items-center justify-between p-4 rounded-2xl bg-card/60 border border-border/50"
          >
            <div className="text-sm space-y-0.5">
              <p className="font-semibold text-foreground">
                {Number(iou.amount).toFixed(2)} {iou.token_symbol}
              </p>
              <p className="text-muted-foreground text-xs">
                From @{iou.sender_pay_tag} · {iou.chain.charAt(0).toUpperCase() + iou.chain.slice(1)}
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground/50">
              {new Date(iou.created_at).toLocaleDateString()}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Security note */}
      <p className="text-[11px] text-muted-foreground/50 text-center px-6 leading-relaxed">
        🔒 Only the owner of @{username} on {platform.charAt(0).toUpperCase() + platform.slice(1)} can claim this. Your funds are safe.
      </p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Button
          onClick={onCreateAccount}
          className="w-full h-13 gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-semibold shadow-[0_0_30px_rgba(0,82,255,0.3)] border-0 text-[15px]"
          size="lg"
        >
          Create MoniTag™ to Claim <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
