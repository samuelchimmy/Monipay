'use client';

import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { Maximize2, Download } from 'lucide-react';

interface DiagramRendererProps {
  code: string;
}

export function DiagramRenderer({ code }: DiagramRendererProps) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'var(--font-sans)',
    });
    
    // Create a unique id for the render target
    const id = `mermaid-${Math.random().toString(36).substring(7)}`;
    
    const cleanCode = code.trim();
    mermaid.render(id, cleanCode)
      .then((result) => {
        setSvg(result.svg);
      })
      .catch((error) => {
        console.error('Mermaid rendering failed', error);
      });
  }, [code]);

  return (
    <div className="my-10 p-6 bg-surface border border-border rounded-xl shadow-sm group relative">
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-2 bg-white dark:bg-gray-800 border border-border rounded-md hover:border-brand transition-colors text-text-muted hover:text-text-primary">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button className="p-2 bg-white dark:bg-gray-800 border border-border rounded-md hover:border-brand transition-colors text-text-muted hover:text-text-primary">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: svg || '<div class="text-sm text-text-muted">Loading diagram...</div>' }} />
    </div>
  );
}
