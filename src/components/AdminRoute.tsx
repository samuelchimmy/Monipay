import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

const ADMIN_PAYTAG = "monibot";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const raw = localStorage.getItem("paytag_profile");

  const denied = (reason: string) => (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground">Admin access required</h1>
        <p className="text-sm text-muted-foreground">{reason}</p>
        <p className="text-xs text-muted-foreground">
          Sign in as <span className="font-mono font-bold">@{ADMIN_PAYTAG}</span> on the main app, then return here.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MoniPay
        </Link>
      </div>
    </div>
  );

  if (!raw) return denied("No profile found in this browser. Sign in first.");

  try {
    const profile = JSON.parse(raw);
    const tag = (profile?.payTag || profile?.pay_tag || "").toString().toLowerCase();
    if (tag !== ADMIN_PAYTAG) {
      return denied(`Signed in as @${tag || "unknown"}. This dashboard is restricted to @${ADMIN_PAYTAG}.`);
    }
    if (!profile?.wallet?.encryptedPrivateKey) {
      return denied("Profile is missing an encrypted wallet. Re-import @monibot from your seed/backup.");
    }
  } catch {
    return denied("Profile data is corrupted. Re-import @monibot.");
  }

  return <>{children}</>;
}
