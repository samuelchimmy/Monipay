'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function TableOfContents() {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('h2, h3'))
      .map((elem) => ({
        id: elem.id,
        text: elem.textContent || '',
        level: Number(elem.tagName.charAt(1)),
      }));
    setHeadings(elements);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '0% 0% -80% 0%' }
    );

    document.querySelectorAll('h2, h3').forEach((elem) => observer.observe(elem));

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">On this page</h4>
      <nav className="space-y-1">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              'block text-sm transition-all py-1 border-l-2',
              heading.level === 3 ? 'pl-6' : 'pl-4',
              activeId === heading.id
                ? 'text-brand border-brand font-medium'
                : 'text-text-muted border-transparent hover:text-text-primary hover:border-text-subtle'
            )}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  );
}
