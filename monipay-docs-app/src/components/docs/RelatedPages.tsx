import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface RelatedPage {
  title: string;
  href: string;
  description?: string;
}

interface RelatedPagesProps {
  pages: RelatedPage[];
}

export function RelatedPages({ pages }: RelatedPagesProps) {
  if (!pages || pages.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-4">
        Related Pages
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group flex items-center justify-between p-3 rounded-lg border border-border hover:border-brand/20 hover:bg-brand/[0.02] transition-all"
          >
            <div className="min-w-0">
              <span className="text-[13px] font-medium text-text-primary group-hover:text-brand transition-colors block truncate">
                {page.title}
              </span>
              {page.description && (
                <span className="text-[11px] text-text-muted truncate block">{page.description}</span>
              )}
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-text-subtle group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </div>
  );
}
