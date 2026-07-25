import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { WalletOptions } from "./types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

const SUGGESTIONS = [
  "What's the current status of all bots?",
  "Analyze today's campaign performance",
  "Compare Base vs BSC transaction volume",
  "Any errors I should worry about?",
  "Recommend a campaign strategy for tonight",
];

export function MoniBotChatTab({ walletOptions, isUnlocked }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "🤖 **MoniBot AI** ready. I have real-time access to all bot transactions, campaigns, schedules, and logs.\n\nAsk me anything — performance reports, error analysis, campaign recommendations, or status checks.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;
    if (!walletOptions || !isUnlocked) return;

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:chat:${timestamp}`);

      const allMessages = [...messages.filter(m => m !== messages[0]), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monibot-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletOptions.walletAddress,
            "x-wallet-signature": signature,
          },
          body: JSON.stringify({ messages: allMessages, timestamp }),
        }
      );

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantSoFar += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && last !== messages[0]) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `❌ ${err.message || "Failed to get response"}` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-3">
      {/* Chat Messages */}
      <Card className="border-primary/10">
        <CardContent className="p-0">
          <ScrollArea className="h-[450px] p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-base-blue to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-base-blue to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick Suggestions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              disabled={!isUnlocked || isLoading}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 inline mr-1" />{s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isUnlocked ? "Ask MoniBot AI..." : "Unlock dashboard first"}
          disabled={!isUnlocked || isLoading}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="h-10"
        />
        <Button
          onClick={() => sendMessage()}
          disabled={!isUnlocked || isLoading || !input.trim()}
          size="icon"
          className="h-10 w-10 bg-primary"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
