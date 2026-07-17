"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const DISMISS_KEY = 'monipay_wc26_promo_dismissed';

export function SportsPromoToast() {
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowToast(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  const tweetIntentUrl = `https://x.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40jade%20if%20Germany%20wins%20Curacao%20%E2%9A%BD`;
  const blogUrl = `https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards`;

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:max-w-[480px] text-left"
        >
          <div className="bg-white/95 dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative flex flex-col gap-4">
            
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-6 right-6 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all cursor-pointer backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Banner Image Container */}
            <div className="relative overflow-hidden rounded-[16px] border border-slate-100 dark:border-zinc-800 shadow-sm aspect-[3/1] bg-slate-100 dark:bg-zinc-850">
              <img 
                src="/images/conditional-sports-p2p-banner.jpg" 
                alt="World Cup 2026 Conditional Sports P2P"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Actions Footer - Custom Banner Buttons matching CSS Specs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full mt-1.5 px-0.5">
              <a 
                href={blogUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:w-auto sm:flex-[0_0_auto] h-[44px] px-5 rounded-[12px] border-[1.5px] border-[#d1d6e8] bg-transparent text-[#3d4460] font-semibold text-[13.5px] flex items-center justify-center transition-all duration-150 cursor-pointer hover:border-[#0e6dec] hover:text-[#0e6dec] hover:bg-[#0e6dec]/5 active:translate-y-0 select-none whitespace-nowrap tracking-tight dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Learn More
              </a>
              <a 
                href={tweetIntentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:flex-1 h-[44px] px-5 rounded-[12px] border-none bg-gradient-to-r from-[#0e6dec] to-[#0a4ebd] hover:from-[#0e6dec]/95 hover:to-[#0a4ebd]/95 text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(14,109,236,0.35)] hover:shadow-[0_6px_20px_rgba(14,109,236,0.45)] transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap tracking-tight"
              >
                <span className="w-[18px] h-[18px] bg-white/20 rounded-[6px] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 8.5l7-7M8.5 1.5H3M8.5 1.5v5.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Reward Your Followers
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
