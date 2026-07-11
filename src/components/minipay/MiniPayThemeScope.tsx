/**
 * MiniPayThemeScope.tsx
 * Wraps a subtree with `data-minipay`, which activates the MiniPay
 * design tokens defined in src/index.css. Inside this scope, shadcn
 * primitives (<Button>, <Input>, <Card>, <Dialog>, <Select>, etc.)
 * automatically adopt the Celo palette, 1rem radius, and MiniPay
 * surface/border/ring colors — no per-component overrides required.
 *
 * Also exposes shared utility classes:
 *   mp-cta          → premium green pill button (use on <Button>/<button>)
 *   mp-cta-outline  → outlined pill variant
 *   mp-card         → soft elevated card surface
 *   mp-icon-frame   → rounded-2xl icon container, theme-aware
 *
 * And CSS variables you can consume via arbitrary classes:
 *   --mp-primary, --mp-ink, --mp-surface, --mp-surface-elev,
 *   --mp-border, --mp-muted, --mp-faint, --mp-radius,
 *   --mp-radius-pill, --mp-shadow-cta, --mp-shadow-card
 */
import { ReactNode } from 'react';

interface MiniPayThemeScopeProps {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function MiniPayThemeScope({
  children,
  className,
  as: Tag = 'div',
}: MiniPayThemeScopeProps) {
  return (
    // @ts-expect-error dynamic tag
    <Tag data-minipay="" className={className}>
      {children}
    </Tag>
  );
}