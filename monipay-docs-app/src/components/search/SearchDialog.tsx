'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, ArrowRight, FileText, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  title: string;
  description: string;
  href: string;
  section: string;
  excerpt: string;
  score: number;
}

interface SearchDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SearchDialog({ open: controlledOpen, onOpenChange }: SearchDialogProps = {}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      window.location.href = results[selectedIndex].href;
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Default trigger — only shown when uncontrolled */}
      {!isControlled && (
        <>
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-transparent border border-border rounded-lg text-[13px] text-text-muted hover:border-text-subtle hover:text-text-primary transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search docs...</span>
            <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-surface px-1.5 font-mono text-[10px] text-text-subtle ml-4">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Mobile search button */}
          <button
            onClick={() => setIsOpen(true)}
            className="sm:hidden p-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-subtle shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                placeholder="Search documentation..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-subtle"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
              {loading && <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-subtle hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                  {results.map((result, i) => (
                    <a
                      key={result.href}
                      href={result.href}
                      className={cn(
                        'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors',
                        i === selectedIndex
                          ? 'bg-brand/5 border border-brand/10'
                          : 'hover:bg-surface border border-transparent'
                      )}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => setIsOpen(false)}
                    >
                      <FileText className="w-4 h-4 text-text-subtle shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {result.title}
                          </span>
                          <span className="text-[10px] font-medium text-text-subtle bg-surface border border-border rounded px-1.5 py-0.5 shrink-0">
                            {result.section}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                          {result.description || result.excerpt}
                        </p>
                      </div>
                      {i === selectedIndex && (
                        <ArrowRight className="w-3.5 h-3.5 text-brand shrink-0 mt-1" />
                      )}
                    </a>
                  ))}
                </div>
              ) : query.length >= 2 && !loading ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-text-muted">No results found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : !query ? (
                <div className="py-12 text-center">
                  <Command className="w-8 h-8 mx-auto mb-3 text-text-subtle opacity-40" />
                  <p className="text-xs text-text-subtle">Type to search across all documentation</p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {results.length > 0 && (
              <div className="px-4 py-2.5 bg-surface border-t border-border flex items-center justify-between text-[10px] text-text-subtle">
                <div className="flex gap-3">
                  <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
                  <span><kbd className="font-mono">↵</kbd> Open</span>
                </div>
                <span><kbd className="font-mono">esc</kbd> Close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
