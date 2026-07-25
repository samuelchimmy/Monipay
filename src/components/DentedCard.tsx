import { ReactNode } from "react";

interface DentedCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DentedCard({ children, className = "", style }: DentedCardProps) {
  return (
    <div className="relative">
      {/* Notch cutout — sized to hug the pill */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-[1] bg-background rounded-b-3xl"
        style={{ width: 140, height: 45 }}
      />
      <div className={`rounded-2xl ${className}`} style={style}>{children}</div>
    </div>
  );
}
