'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiEndpointProps {
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestSchema?: any;
  responseSchema?: any;
}

export function ApiEndpoint({ method, path, description, requestSchema, responseSchema }: ApiEndpointProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const methodColors = {
    GET: 'bg-blue-500',
    POST: 'bg-emerald-500',
    PATCH: 'bg-amber-500',
    DELETE: 'bg-red-500',
  };

  return (
    <div className="my-6 border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('px-2 py-1 rounded text-[10px] font-bold text-white min-w-[50px] text-center', methodColors[method])}>
          {method}
        </span>
        <code className="text-sm font-mono text-text-primary flex-1">{path}</code>
        <div className="text-text-muted">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 border-t border-border bg-gray-50/50 dark:bg-gray-900/50">
          <p className="text-sm text-text-muted mb-6">{description}</p>
          
          {requestSchema && (
            <div className="mb-6">
              <h5 className="text-xs font-bold text-text-subtle uppercase mb-2">Request Body</h5>
              <pre className="p-3 bg-surface border border-border rounded-lg text-xs font-mono overflow-x-auto text-text-primary">
                {JSON.stringify(requestSchema, null, 2)}
              </pre>
            </div>
          )}
          
          {responseSchema && (
            <div>
              <h5 className="text-xs font-bold text-text-subtle uppercase mb-2">Response</h5>
              <pre className="p-3 bg-surface border border-border rounded-lg text-xs font-mono overflow-x-auto text-text-primary">
                {JSON.stringify(responseSchema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
