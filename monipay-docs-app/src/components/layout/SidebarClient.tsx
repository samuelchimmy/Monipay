'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  title: string;
  href: string;
}

interface NavSection {
  title: string;
  slug: string;
  items: NavItem[];
}

export function SidebarClient({ navigation, className }: { navigation: NavSection[]; className?: string }) {
  const pathname = usePathname();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(navigation.map((s) => s.slug));
  });

  const toggleSection = (slug: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  return (
    <aside className={cn('bg-transparent', className)}>
      <nav className="px-6 py-8 space-y-4">
        {navigation.map((section) => {
          const isExpanded = expandedSections.has(section.slug);

          return (
            <div key={section.slug} className="space-y-1">
              <button
                onClick={() => toggleSection(section.slug)}
                className="w-full flex items-center justify-between text-[11px] font-extrabold text-text-muted tracking-[0.05em] uppercase hover:text-text-primary transition-colors group"
              >
                <span>{section.title}</span>
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden space-y-[2px] pt-1"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              'relative block px-3 py-1.5 text-[14px] transition-all duration-200 rounded-r-md border-l-2',
                              isActive
                                ? 'text-text-primary font-bold bg-accent/5 border-current dark:border-accent'
                                : 'text-text-muted hover:text-text-primary border-transparent'
                            )}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
