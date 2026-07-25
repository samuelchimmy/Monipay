import type { SupportedNetwork } from "@/config/chains";

const CELO = { id: "celo" as SupportedNetwork, label: "CELO", color: "hsl(55, 100%, 66%)" };

interface NetworkToggleProps {
  onOpenChange?: (open: boolean) => void;
  /** When true, renders full-width with a high-contrast white/black active style. */
  fullWidth?: boolean;
}

// MoniPay is Celo-only. The former multi-network switcher now renders a static
// Celo indicator; props are kept for call-site compatibility.
export function NetworkToggle({ fullWidth = false }: NetworkToggleProps) {
  return (
    <div className={`relative z-50 ${fullWidth ? 'w-full' : 'flex justify-center'}`}>
      <div
        className={
          fullWidth
            ? 'relative w-full rounded-2xl bg-white border border-white shadow-sm overflow-hidden'
            : 'relative rounded-2xl bg-foreground/[0.06] dark:bg-white/[0.06] backdrop-blur-2xl border border-border/20 overflow-hidden'
        }
        style={fullWidth ? undefined : { minWidth: 120 }}
      >
        <div className={`w-full flex items-center gap-2 ${fullWidth ? 'justify-between px-5 py-3' : 'justify-start px-5 py-2'}`}>
          <div className="flex items-center gap-2">
            <div
              className={`${fullWidth ? 'w-2 h-2' : 'w-[6px] h-[6px]'} rounded-full flex-shrink-0`}
              style={{ backgroundColor: CELO.color }}
            />
            <span className={`${fullWidth ? 'text-[13px] text-gray-950' : 'text-[13px] text-foreground dark:text-white'} font-extrabold tracking-[0.12em]`}>
              {CELO.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
