'use client';

import { useState } from 'react';
import { Sparkles, ChevronRight, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AISummaryProps {
  title: string;
  content: string;
}

export function AISummary({ title, content }: AISummaryProps) {
  const [isOpen, setIsOpen] = useState(true); // Expanded by default on desktop
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ bullets: string[]; followUp: string[] } | null>(null);

  const generateSummary = async () => {
    if (summary) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to generate summary', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load if open
  useState(() => {
    if (typeof window !== 'undefined') {
       // Small delay to prevent blocking initial render
       setTimeout(generateSummary, 100);
    }
  });

  return (
    <div className={`
      relative rounded-xl overflow-hidden border-l-[3px] transition-all duration-300
      ${isOpen ? 'bg-text-primary/5' : 'bg-transparent'}
      dark:border-accent border-[#111111]
    `}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-text-primary/5 transition-all group"
      >
        <div className="flex items-center gap-2.5 font-extrabold text-[13px] uppercase tracking-wider text-text-primary">
          <Sparkles className="w-4 h-4 text-accent fill-accent" />
          AI Summary
        </div>
        <ChevronRight className={cn('w-4 h-4 transition-transform duration-200 text-text-muted', isOpen && 'rotate-90')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest">Generating...</p>
                </div>
              ) : summary ? (
                <div className="space-y-6">
                  <ul className="space-y-4">
                    {summary.bullets.map((bullet, i) => (
                      <li key={i} className="flex gap-3 text-[14px] text-text-primary leading-relaxed font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-[7px] shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  {summary.followUp && summary.followUp.length > 0 && (
                    <div className="pt-5 border-t border-border">
                      <h5 className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        Deep Dive
                      </h5>
                      <div className="space-y-2">
                        {summary.followUp.map((q, i) => (
                          <button key={i} className="block w-full text-left text-[12px] font-bold text-text-primary hover:text-accent transition-colors">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-red-500 font-medium">Failed to load summary.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
