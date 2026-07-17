'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as motion from 'motion/react-client';

interface FAQProps {
  items: { q: string; a: string }[];
}

export function FAQAccordion({ items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently Asked Questions</h2>
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="bg-surface relative">
              <button
                type="button"
                className="w-full text-left px-6 py-4 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
              >
                <span className="font-medium pr-4">{item.q}</span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-text-muted transition-transform duration-200 shrink-0",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-4 pt-1">
                  <p className="text-text-muted leading-relaxed text-sm">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
