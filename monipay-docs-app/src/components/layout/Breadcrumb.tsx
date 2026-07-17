'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Breadcrumb({ slug }: { slug: string[] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <nav className="flex items-center gap-1.5 mb-8 text-[12px] font-medium font-sans">
      <Link
        href="/"
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        Home
      </Link>

      {slug.map((segment, index) => {
        const isLast = index === slug.length - 1;
        const href = `/docs/${slug.slice(0, index + 1).join('/')}`;
        const label = segment
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        return (
          <div key={href} className="flex items-center gap-1.5">
            <ChevronRight
              className={`w-3 h-3 ${isDark ? 'text-accent' : 'text-[#888]'}`}
            />
            {isLast ? (
              <span className="text-text-primary font-bold">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-text-muted hover:text-text-primary transition-colors hidden sm:inline"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
