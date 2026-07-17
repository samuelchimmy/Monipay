'use client';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MonipayLogo } from '@/components/ui/MonipayLogo';
import { motion } from 'framer-motion';
import { SearchDialog } from '@/components/search/SearchDialog';

export function TopNav() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isDark = !mounted ? true : resolvedTheme === 'dark';

  return (
    <>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
          className={`
            pointer-events-auto
            flex items-center justify-between
            w-full max-w-5xl h-[48px] px-3.5 sm:px-5
            rounded-2xl border shadow-sm backdrop-blur-xl transition-colors duration-300
            ${isDark
              ? 'bg-[#0D0D0D]/95 border-white/8 text-white'
              : 'bg-white/96 border-black/7 text-[#0D0D0D]'
            }
          `}
        >
          {/* Left: Logo + Docs label */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <MonipayLogo size={18} color={isDark ? '#FFFFFF' : '#0D0D0D'} />
            <span className="text-[13px] font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-sans)' }}>
              Monipay
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold tracking-tight
              ${isDark ? 'bg-white/8 text-white/50' : 'bg-black/6 text-black/40'}`}>
              Docs
            </span>
          </Link>



          {/* Right: Search + Theme + CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] transition-colors
                ${isDark
                  ? 'border-white/10 text-white/40 hover:text-white/60 bg-white/4'
                  : 'border-black/8 text-black/40 hover:text-black/60 bg-black/3'
                }`}
            >
              <Search className="w-3 h-3" />
              <span>Search</span>
              <span className="font-mono text-[10px] opacity-50">⌘K</span>
            </button>

            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-1.5 rounded-lg transition-all shrink-0
                ${isDark ? 'hover:bg-white/8 text-white/50' : 'hover:bg-black/6 text-black/40'}`}
              aria-label="Toggle theme"
            >
              {isDark
                ? <Moon className="w-3.5 h-3.5" />
                : <Sun className="w-3.5 h-3.5" />
              }
            </button>

            <a
              href="https://monipay.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold transition-all shrink-0
                ${isDark
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-[#0D0D0D] text-white hover:bg-black/85'
                }`}
            >
              Sign in ↗
            </a>
          </div>
        </motion.header>
      </div>
    </>
  );
}
