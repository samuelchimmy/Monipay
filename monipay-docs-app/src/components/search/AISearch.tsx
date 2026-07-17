'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2, Bot, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AISearch() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!query.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slug: 'ai-search', 
          content: `User Question: ${query}\n\nContext: You are the Monipay AI Assistant. Answer the user's question based on Monipay documentation.` 
        }),
      });

      const data = await response.json();
      let content = '';
      if (data.bullets) {
        content = data.bullets.join('\n');
      } else if (data.summary) {
        content = data.summary;
      } else {
        content = "I'm sorry, I couldn't generate a summary for that.";
      }
      
      const assistantMessage: Message = { role: 'assistant', content };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Search Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-gray-900 rounded-2xl border border-border overflow-hidden shadow-xl">
      <div className="p-4 border-b border-border bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand" />
        <span className="font-bold text-sm uppercase tracking-wider">Monipay AI Assistant</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
            <Bot className="w-12 h-12 mb-4" />
            <p className="text-sm">Ask me anything about Monipay protocol, SDKs, or MoniBot.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex gap-3 max-w-[85%]",
            msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
          )}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-brand text-white" : "bg-gray-100 dark:bg-gray-800 text-brand"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "p-3 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' ? "bg-brand text-white rounded-tr-none" : "bg-gray-100 dark:bg-gray-800 text-text-primary rounded-tl-none"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-gray-50 dark:bg-gray-800/50">
        <div className="relative">
          <input 
            placeholder="Ask a question..."
            className="w-full pl-4 pr-12 py-3 bg-white dark:bg-gray-900 border border-border rounded-xl focus:border-brand outline-none transition-all text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand text-white rounded-lg disabled:opacity-50 hover:bg-brand-light transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-center text-text-subtle uppercase tracking-widest font-bold">
          Powered by Gemini 2.0 Flash
        </p>
      </div>
    </div>
  );
}
