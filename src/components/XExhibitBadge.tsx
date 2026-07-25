import { BadgeCheck } from 'lucide-react';

interface XExhibitBadgeProps {
  variant?: 'pill' | 'card' | 'inline';
  className?: string;
}

/**
 * Verified listing on X Developer Exhibit.
 * https://developer.x.com/exhibit/monipay
 */
export function XExhibitBadge({ variant = 'pill', className = '' }: XExhibitBadgeProps) {
  const href = 'https://developer.x.com/exhibit/monipay';

  if (variant === 'inline') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground transition-colors ${className}`}
      >
        <BadgeCheck className="w-3 h-3" />
        Verified on X Developer Exhibit
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group relative flex items-center gap-4 rounded-xl border border-black dark:border-white bg-card hover:bg-muted/50 transition-colors p-5 ${className}`}
      >
        <div className="flex items-center justify-center w-12 h-12 text-foreground shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
            <path d="M18.244 2H21l-6.53 7.46L22 22h-6.828l-4.77-6.24L4.8 22H2l7.03-8.03L2 2h6.914l4.32 5.71L18.244 2Zm-2.393 18h1.876L8.243 4H6.234l9.617 16Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">Featured</span>
            <BadgeCheck className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Verified on the X Developer Exhibit
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            developer.x.com/exhibit/monipay
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          View →
        </span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors px-3 py-1.5 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3 text-foreground" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2H21l-6.53 7.46L22 22h-6.828l-4.77-6.24L4.8 22H2l7.03-8.03L2 2h6.914l4.32 5.71L18.244 2Zm-2.393 18h1.876L8.243 4H6.234l9.617 16Z" />
      </svg>
      <span className="text-[11px] font-medium tracking-wide text-foreground/70">
        Verified on X Developer Exhibit
      </span>
      <BadgeCheck className="w-3 h-3 text-foreground/50" />
    </a>
  );
}