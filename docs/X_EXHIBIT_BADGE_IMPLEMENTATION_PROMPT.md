# X Exhibit Badge — Implementation Prompt for Docs & Blog Sub-Apps

## Objective
Add the **X Developer Exhibit Verified** badge prominently to the MoniPay **docs app** and **blog app** (subfolders inside this repo). Use the same component design language as the main MoniPay app.

## Badge Variants Available
1. **`pill`** — Compact, inline. Best for headers, navbars, footers.
2. **`card`** — Larger, block-level card with logo + link. Best for hero sections, about pages.
3. **`inline`** — Minimal text link with checkmark. Best for footers, signatures, metadata.

## Component Source Code
Create this component in the target sub-app (e.g., `src/components/XExhibitBadge.tsx` or equivalent path based on the sub-app's conventions):

```tsx
import { BadgeCheck } from 'lucide-react';

interface XExhibitBadgeProps {
  variant?: 'pill' | 'card' | 'inline';
  className?: string;
}

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
        className={`group relative flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors p-5 ${className}`}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-foreground text-background shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2H21l-6.53 7.46L22 22h-6.828l-4.77-6.24L4.8 22H2l7.03-8.03L2 2h6.914l4.32 5.71L18.244 2Zm-2.393 18h1.876L8.243 4H6.234l9.617 16Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-[0.15em] uppercase text-foreground/40">Featured</span>
            <BadgeCheck className="w-3.5 h-3.5 text-foreground/60" />
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Verified on the X Developer Exhibit
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            developer.x.com/exhibit/monipay
          </p>
        </div>
        <span className="text-xs font-medium text-foreground/40 group-hover:text-foreground transition-colors">
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
```

> **Note:** If the sub-app does not use Tailwind CSS, translate the utility classes (`bg-foreground/5`, `rounded-full`, `text-xs`, etc.) into the sub-app's equivalent styling system (CSS modules, styled-components, inline styles, or Docusaurus/Ghost theme classes). Keep the layout semantics identical.

## Required Dependency
The component imports `BadgeCheck` from **Lucide React**:

```bash
npm install lucide-react
# or
yarn add lucide-react
# or
pnpm add lucide-react
```

If the sub-app already uses a different icon library (e.g., FontAwesome, Heroicons), replace `<BadgeCheck className="..." />` with the equivalent checkmark/circle-check icon from that library.

## Placement Recommendations

### Docs App
| Location | Recommended Variant | Rationale |
|----------|-------------------|-----------|
| **Header / Navbar** | `pill` | Always visible, subtle credibility signal on every page. |
| **Footer** | `inline` | Minimal, sits next to copyright / links. |
| **Homepage / Hero** | `card` | First impression; prominent social proof above the fold. |
| **"About MoniPay" page** | `card` | Dedicated section for platform credentials. |

### Blog App
| Location | Recommended Variant | Rationale |
|----------|-------------------|-----------|
| **Header / Top bar** | `pill` | Persistent trust marker across all articles. |
| **Footer** | `inline` | Clean, unobtrusive, reinforces legitimacy. |
| **Author bio / About sidebar** | `card` | Contextual social proof near writer/platform credentials. |

## Styling Adaptation Guide (if no Tailwind)
If the sub-app uses plain CSS, CSS Modules, or a different framework, preserve these visual rules:
- **Pill:** `border-radius: 9999px`, `padding: 6px 12px`, `font-size: 11px`, `display: inline-flex`, `gap: 8px`, subtle border (`rgba(0,0,0,0.1)` or theme equivalent), muted text color.
- **Card:** `border-radius: 16px`, `padding: 20px`, `display: flex`, `gap: 16px`, dark circle with white X logo (use the SVG path provided), "Featured" label in uppercase tracking.
- **Inline:** No border, no background, just text + small icon, `font-size: 11px`.
- **Dark mode:** If the sub-app supports dark mode, ensure `bg-foreground` maps to light surfaces and `text-background` maps to dark text (invert for dark themes).

## URL & Link
All variants link to: `https://developer.x.com/exhibit/monipay`
- Must open in a new tab (`target="_blank"`).
- Must include `rel="noopener noreferrer"` for security.

## Accessibility
- The `<a>` tag must have meaningful link text ("Verified on X Developer Exhibit").
- The X logo `<svg>` should have `aria-hidden="true"` since the text label already describes the link purpose.

## What NOT to change
- Do not modify the URL.
- Do not alter the SVG path (it is the official X logo).
- Do not remove the `rel="noopener noreferrer"` attribute.
- Do not change the link text to something generic like "Click here".
