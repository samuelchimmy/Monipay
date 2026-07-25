/**
 * InkThemeScope.tsx
 * Wraps a subtree with `data-ink`, which activates the Ink
 * design tokens defined in src/index.css. Inside this scope, shadcn
 * primitives (<Button>, <Input>, <Card>, <Dialog>, <Select>, etc.)
 * automatically adopt the Celo palette, 1rem radius, and Ink
 * surface/border/ring colors — no per-component overrides required.
 *
 * Also exposes shared utility classes:
 *   ink-cta          → premium green pill button (use on <Button>/<button>)
 *   ink-cta-outline  → outlined pill variant
 *   ink-card         → soft elevated card surface
 *   ink-icon-frame   → rounded-2xl icon container, theme-aware
 *
 * And CSS variables you can consume via arbitrary classes:
 *   --mp-primary, --mp-ink, --mp-surface, --mp-surface-elev,
 *   --mp-border, --mp-muted, --mp-faint, --mp-radius,
 *   --mp-radius-pill, --mp-shadow-cta, --mp-shadow-card
 */
import { ReactNode } from 'react';

interface InkThemeScopeProps {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function InkThemeScope({
  children,
  className,
  as: Tag = 'div',
}: InkThemeScopeProps) {
  return (
    // @ts-expect-error dynamic tag
    <Tag data-ink="" className={className}>
      {children}
    </Tag>
  );
}