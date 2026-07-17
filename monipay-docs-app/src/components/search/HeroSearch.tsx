'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { SearchDialog } from './SearchDialog';

export function HeroSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-all text-left shadow-sm">
        <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        <span className="text-[13px] text-[var(--color-text-muted)] flex-1">
          Search docs, contracts, commands...
        </span>
        <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] font-mono bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
          ⌘K
        </span>
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
