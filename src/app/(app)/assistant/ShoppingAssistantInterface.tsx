'use client';

/**
 * Shopping Assistant Interface
 *
 * Full conversational AI shopping assistant with:
 * - Chat messages with streaming-like UX
 * - Product cards for recommendations
 * - Tool activity indicators
 * - Wishlist permission controls
 * - Conversation history sidebar
 * - Starter prompts
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  ChevronLeft,
  ExternalLink,
  List,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LiveWishlistPanel } from '@/components/wishlist/LiveWishlistPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown> | null;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  updatedAt: string;
}

interface ProductResult {
  title: string;
  url?: string;
  currentPrice?: number;
  currency?: string;
  image?: string;
  retailer?: string;
  brand?: string;
}

interface ToolResultData {
  success: boolean;
  tool: string;
  data?: unknown;
  error?: string;
  activity: string;
}

interface Props {
  userId: string;
  initialConversations: Conversation[];
  hasProviders: boolean;
  permissions: Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Starter Prompts
// ─────────────────────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  { text: 'Find me a gaming monitor under $300', icon: ShoppingCart },
  { text: 'Build me a $1,500 gaming PC', icon: Package },
  { text: 'Compare RTX 5070 vs RX 9070 XT', icon: Sparkles },
  { text: "What's on my wishlist?", icon: List },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ShoppingAssistantInterface({
  userId,
  initialConversations,
  hasProviders,
  permissions,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    setMessage('');
    setError(null);
    setIsLoading(true);
    setToolActivity('Thinking...');

    // Optimistically add user message to UI
    const tempUserMsg: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setActiveConversation((prev) => {
      if (prev) {
        return { ...prev, messages: [...prev.messages, tempUserMsg] };
      }
      return {
        id: 'temp',
        title: userMessage.slice(0, 50),
        messages: [tempUserMsg],
        updatedAt: new Date().toISOString(),
      };
    });

    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConversation?.id !== 'temp' ? activeConversation?.id : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Assistant request failed');
      }

      const assistantMsg: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        data: {
          ...(data.products ? { products: data.products } : {}),
          ...(data.toolResults ? { toolResults: data.toolResults } : {}),
        },
        timestamp: new Date().toISOString(),
      };

      const convId = data.conversationId;

      setActiveConversation((prev) => {
        const msgs = prev ? prev.messages.filter((m) => m.id !== `temp-${Date.now()}`) : [];
        return {
          id: convId,
          title: prev?.title || userMessage.slice(0, 50),
          messages: [...msgs, assistantMsg],
          updatedAt: new Date().toISOString(),
        };
      });

      // Update sidebar
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === convId);
        if (exists) {
          return prev.map((c) =>
            c.id === convId ? { ...c, updatedAt: new Date().toISOString() } : c
          );
        }
        return [
          { id: convId, title: userMessage.slice(0, 50), messages: [], updatedAt: new Date().toISOString() },
          ...prev,
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setToolActivity(null);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message.trim());
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
    setError(null);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const handleConversationSelect = async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        const conv = data.conversation;
        setActiveConversation({
          id: conv.id,
          title: conv.title,
          messages: conv.messages.map((m: { id: string; role: string; content: string; data: unknown; createdAt: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            data: m.data as Record<string, unknown> | null,
            timestamp: m.createdAt,
          })),
          updatedAt: conv.updatedAt,
        });
        setShowSidebar(false);
      }
    } catch {
      // Silently fail
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) setActiveConversation(null);
    } catch {
      // Silently fail
    }
  };

  // ─── No providers state ───
  if (!hasProviders) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="bg-surface flex h-16 w-16 items-center justify-center rounded-2xl">
          <Bot className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold">Configure an AI Provider</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          The Shopping Assistant needs an AI provider to work. Add one in Settings → Providers.
        </p>
        <Button asChild size="md">
          <Link href="/settings/providers">
            <Settings className="mr-2 h-4 w-4" />
            Configure Providers
          </Link>
        </Button>
      </div>
    );
  }

  const messages = activeConversation?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
            aria-label="Toggle conversation history"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold">
              {activeConversation ? activeConversation.title : 'New Conversation'}
            </h1>
            <p className="text-muted-foreground text-xs">DerList Shopping AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWishlist(!showWishlist)}
            className={cn('gap-1.5', showWishlist && 'bg-accent/10 text-accent')}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wishlist</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="border-border bg-surface/50 absolute inset-y-0 left-0 z-10 w-72 border-r md:relative">
            <div className="border-border flex items-center justify-between border-b p-3">
              <span className="text-sm font-medium">History</span>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="text-muted-foreground hover:text-foreground md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="text-muted-foreground p-3 text-center text-xs">No conversations yet</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        activeConversation?.id === conv.id
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                      )}
                      onClick={() => handleConversationSelect(conv.id)}
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate">{conv.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                        className="text-muted-foreground hover:text-danger shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {messages.length === 0 ? (
              /* Empty state with starter prompts */
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="bg-accent/10 flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Bot className="text-accent h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold">DerList Shopping AI</h2>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    Find products, compare prices, build PCs, and manage your wishlist.
                  </p>
                </div>
                <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.text}
                      type="button"
                      onClick={() => sendMessage(prompt.text)}
                      className="border-border hover:bg-surface hover:border-border/80 flex items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                    >
                      <prompt.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-sm">{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {/* Tool activity indicator */}
                {toolActivity && (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Loader2 className="text-accent h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">{toolActivity}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="border-danger/20 bg-danger/5 mx-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2">
              <AlertCircle className="text-danger h-4 w-4 shrink-0" />
              <span className="text-danger flex-1 text-sm">{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-danger/60 hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-border border-t p-4">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="border-border focus-within:border-accent/50 focus-within:ring-accent/20 flex items-end gap-2 rounded-xl border bg-card p-2 transition-colors focus-within:ring-2">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about products, compare items, or manage your wishlist..."
                  rows={1}
                  className="max-h-[150px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!message.trim() || isLoading}
                  className="shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground mt-1.5 text-center text-[10px]">
                DerList AI may make mistakes. Verify important product information.
              </p>
            </form>
          </div>
        </div>

        {/* Live Wishlist Panel */}
        {showWishlist && (
          <div className="border-border hidden w-80 shrink-0 border-l md:block lg:w-96">
            <LiveWishlistPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';
  const products = (message.data?.products as ProductResult[] | undefined) ?? [];
  const toolResults = (message.data?.toolResults as ToolResultData[] | undefined) ?? [];

  return (
    <div className={cn('flex gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <div className="bg-accent/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Bot className="text-accent h-4 w-4" />
        </div>
      )}
      <div className={cn('max-w-[80%] space-y-3', isUser && 'order-first')}>
        {/* Tool activity badges */}
        {toolResults.length > 0 && (
          <div className="space-y-1.5">
            {toolResults.map((result, i) => (
              <ToolResultDisplay key={i} result={result} />
            ))}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-accent text-accent-foreground ml-auto rounded-br-md'
              : 'bg-surface border-border rounded-bl-md border'
          )}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Product cards */}
        {products.length > 0 && (
          <div className="space-y-2">
            {products.map((product, i) => (
              <ProductCard key={i} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Result Display
// ─────────────────────────────────────────────────────────────────────────────

interface BulkItemResultData {
  title: string;
  status: 'added' | 'already_exists' | 'failed';
}

function ToolResultDisplay({ result }: { result: ToolResultData }) {
  // Check if this is a bulk import result
  const bulkData = result.data as { total?: number; added?: number; alreadyExists?: number; failed?: number; results?: BulkItemResultData[] } | undefined;
  const isBulk = result.tool === 'add_multiple_to_wishlist' && bulkData?.results;

  if (isBulk && bulkData?.results) {
    return (
      <div className="bg-surface border-border rounded-xl border p-3 text-xs">
        <div className={cn(
          'mb-2 flex items-center gap-2 font-medium',
          result.success ? 'text-success' : 'text-danger'
        )}>
          {result.success ? <span>✓</span> : <AlertCircle className="h-3 w-3" />}
          {result.activity}
        </div>
        <div className="text-muted-foreground max-h-48 space-y-0.5 overflow-y-auto">
          {bulkData.results.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn(
                item.status === 'added' ? 'text-success' :
                item.status === 'already_exists' ? 'text-muted-foreground' : 'text-danger'
              )}>
                {item.status === 'added' ? '✓' : item.status === 'already_exists' ? '○' : '✗'}
              </span>
              <span className="truncate">{item.title}</span>
              {item.status === 'already_exists' && (
                <span className="text-muted-foreground/60 shrink-0">already exists</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default single-action display
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium',
      result.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
    )}>
      {result.success ? <span>✓</span> : <AlertCircle className="h-3 w-3" />}
      {result.activity}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: ProductResult }) {
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-3 transition-shadow hover:shadow-sm">
      {product.image ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
          <img src={product.image} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
          <Package className="text-muted-foreground h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.title}</p>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {product.retailer && <span>{product.retailer}</span>}
          {product.brand && <span>· {product.brand}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {product.currentPrice != null && (
          <span className="text-sm font-semibold">
            {product.currency === 'USD' ? '$' : ''}{product.currentPrice.toFixed(2)}
          </span>
        )}
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="View product"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
