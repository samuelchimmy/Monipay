import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

export function VerifiedBadge({ size = 22, className = "" }: VerifiedBadgeProps) {
  return (
    <BadgeCheck 
      size={size} 
      className={`fill-base-blue text-white ${className}`}
      strokeWidth={2.5}
    />
  );
}

// Check if a pay tag is the MoniBot account
export function isMoniBotTag(payTag: string | undefined | null): boolean {
  if (!payTag) return false;
  const normalized = payTag.toLowerCase().replace(/^@/, '');
  return normalized === 'monibot';
}

// Component that displays a pay tag with verified badge if it's MoniBot
interface PayTagDisplayProps {
  payTag: string;
  className?: string;
  badgeSize?: number;
}

export function PayTagDisplay({ payTag, className = "", badgeSize = 14 }: PayTagDisplayProps) {
  const isMoniBot = isMoniBotTag(payTag);
  const displayTag = payTag.startsWith('@') ? payTag : `@${payTag}`;
  
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {displayTag}
      {isMoniBot && <VerifiedBadge size={badgeSize} />}
    </span>
  );
}
