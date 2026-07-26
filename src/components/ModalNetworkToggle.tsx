/**
 * ModalNetworkToggle — Animated network selector for modals (Fund/Withdraw).
 * Mirrors the dashboard NetworkToggle design with spring animations.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { getChainConfig, type SupportedNetwork } from "@/config/chains";

const NETWORKS: { id: SupportedNetwork; label: string; color: string; suffix: string }[] = [
  { id: "celo", label: "CELO", color: "hsl(55, 100%, 66%)", suffix: "USDT" },
];

interface ModalNetworkToggleProps {
  value: SupportedNetwork;
  onChange: (network: SupportedNetwork) => void;
  /** If true, the toggle is disabled and shows only the current network */
  locked?: boolean;
}

export function ModalNetworkToggle({ value, onChange, locked }: ModalNetworkToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const available = NETWORKS;

  const current = available.find((n) => n.id === value) || available[0];

  const spring = {
    type: "spring" as const,
    stiffness: 320,
    damping: 30,
    mass: 0.9,
  };

  return (
    <div ref={ref} className="relative z-50 flex justify-center">
      <motion.div
        layout
        transition={spring}
        className="relative w-full rounded-2xl bg-foreground/[0.06] dark:bg-white/[0.06] backdrop-blur-2xl border border-border/20 overflow-hidden"
      >
        {/* Trigger */}
        <motion.button
          layout="position"
          whileTap={locked ? undefined : { scale: 0.97 }}
          onClick={() => !locked && setOpen(!open)}
          transition={spring}
          className={`w-full flex items-center justify-between gap-3 px-5 py-3 ${locked ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-3">
            <motion.div
              layout="position"
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: current.color }}
              transition={spring}
            />
            <motion.span
              layout="position"
              className="text-[13px] font-extrabold tracking-[0.12em] text-foreground dark:text-white"
              transition={spring}
            >
              {current.label}
            </motion.span>
            <span className="text-[11px] font-medium text-foreground/40 dark:text-white/40 tracking-wider">
              · {current.suffix}
            </span>
          </div>
          {!locked && (
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex-shrink-0"
            >
              <ChevronDown className="w-4 h-4 text-foreground/40 dark:text-white/40" />
            </motion.div>
          )}
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence initial={false}>
          {open && !locked && (
            <motion.div
              key="dropdown"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: spring,
                opacity: { duration: 0.2, ease: "easeOut" },
              }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 flex flex-col gap-0.5">
                {available.filter((n) => n.id !== value).map((n, i) => (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ ...spring, delay: i * 0.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      onChange(n.id);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div
                      className="w-[6px] h-[6px] rounded-full opacity-50 flex-shrink-0"
                      style={{ backgroundColor: n.color }}
                    />
                    <span className="text-[12px] font-bold tracking-[0.10em] text-foreground/50 dark:text-white/50">
                      {n.label}
                    </span>
                    <span className="text-[10px] font-medium text-foreground/30 dark:text-white/30 tracking-wider">
                      · {n.suffix}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
