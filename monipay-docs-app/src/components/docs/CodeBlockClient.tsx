'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockClientProps {
  code: string;
  html: string;
  language?: string;
  title?: string;
}

export function CodeBlockClient({ code, html, language, title }: CodeBlockClientProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <figure className="my-8 rounded-xl overflow-hidden border border-white/5 bg-[#1A1A1A] shadow-2xl">
      {title && (
        <figcaption className="flex items-center justify-between px-5 py-3 bg-black/40 border-b border-white/5">
          <span className="text-[13px] font-mono font-medium text-white opacity-80">
            {title}
          </span>
          <button
            onClick={copy}
            className="p-1.5 text-white/40 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
          </button>
        </figcaption>
      )}
      {!title && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={copy}
            className="p-2 text-white/40 hover:text-white transition-colors bg-black/20 rounded-md backdrop-blur-sm"
          >
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}
      <div 
        className="p-5 overflow-x-auto text-[13px] font-mono leading-relaxed text-[#e6e6e6]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
