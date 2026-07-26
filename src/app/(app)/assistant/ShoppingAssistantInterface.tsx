'use client';

/**
 * Shopping Assistant Interface
 *
 * Interactive chat interface for the AI-powered shopping assistant
 */
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Info,
  Lightbulb,
  MessageCircle,
  Send,
  Settings,
  ShoppingCart,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: ShoppingAssistantResponse;
  timestamp: string;
}

interface ProductRecommendation {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  merchant: string;
  category: string;
  features: string[];
  pros: string[];
  cons: string[];
}

interface ShoppingAssistantResponse {
  message: string;
  recommendations?: ProductRecommendation[];
  insights?: Array<{
    type: 'tip' | 'warning' | 'info';
    title: string;
    content: string;
  }>;
  followUpQuestions?: string[];
  conversationId?: string;
}

interface Props {
  userId: string;
  initialConversations: Conversation[];
  hasProviders: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: ProductRecommendation }) {
  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex gap-4">
        {product.imageUrl && (
          <div className="h-24 w-24 flex-shrink-0">
            <Image
              src={product.imageUrl}
              alt={product.title}
              width={96}
              height={96}
              className="h-full w-full rounded-md object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm leading-tight font-medium">{product.title}</h3>
            <div className="flex-shrink-0 text-right">
              <div className="text-lg font-semibold">${product.price}</div>
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="text-muted-foreground text-sm line-through">
                  ${product.originalPrice}
                </div>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2">
            {product.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-current text-yellow-500" />
                <span className="text-xs">{product.rating}</span>
                {product.reviewCount && (
                  <span className="text-muted-foreground text-xs">({product.reviewCount})</span>
                )}
              </div>
            )}
            <Badge variant="secondary" className="text-xs">
              {product.merchant}
            </Badge>
          </div>

          {product.features.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {product.features.slice(0, 3).map((feature, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button size="sm" asChild className="flex-1">
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ShoppingCart className="h-3 w-3" />
                View Product
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InsightCard({
  insight,
}: {
  insight: { type: 'tip' | 'warning' | 'info'; title: string; content: string };
}) {
  const icons = {
    tip: Lightbulb,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    tip: 'text-green-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  const Icon = icons[insight.type];

  return (
    <Card className="p-3">
      <div className="flex gap-2">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colors[insight.type]}`} />
        <div>
          <h4 className="text-sm font-medium">{insight.title}</h4>
          <p className="text-muted-foreground mt-1 text-sm">{insight.content}</p>
        </div>
      </div>
    </Card>
  );
}

function ConversationSidebar({
  conversations,
  activeConversationId,
  onConversationSelect,
  onConversationDelete,
  onNewConversation,
}: {
  conversations: Conversation[];
  activeConversationId?: string;
  onConversationSelect: (id: string) => void;
  onConversationDelete: (id: string) => void;
  onNewConversation: () => void;
}) {
  return (
    <div className="bg-muted/20 flex w-64 flex-col border-r">
      <div className="border-b p-4">
        <Button onClick={onNewConversation} className="w-full" size="sm">
          <MessageCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {conversations.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">No conversations yet</div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors ${
                  activeConversationId === conversation.id ? 'bg-muted' : ''
                }`}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <MessageCircle className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConversationDelete(conversation.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ShoppingAssistantInterface({ userId, initialConversations, hasProviders }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConversation?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: ShoppingAssistantResponse = await response.json();

      // Update or create conversation
      if (data.conversationId) {
        const updatedConversation: Conversation = {
          id: data.conversationId,
          title: activeConversation?.title || userMessage.substring(0, 50),
          messages: [
            ...(activeConversation?.messages || []),
            {
              id: Date.now() + '-user',
              role: 'user',
              content: userMessage,
              timestamp: new Date().toISOString(),
            },
            {
              id: Date.now() + '-assistant',
              role: 'assistant',
              content: data.message,
              data: data,
              timestamp: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        };

        setActiveConversation(updatedConversation);

        // Update conversations list
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === data.conversationId);
          if (existing) {
            return prev.map((c) => (c.id === data.conversationId ? updatedConversation : c));
          } else {
            return [updatedConversation, ...prev];
          }
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Could add error handling UI here
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleConversationSelect = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/assistant/conversations/${conversationId}`);
      if (response.ok) {
        const conversation: Conversation = await response.json();
        setActiveConversation(conversation);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleConversationDelete = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/assistant/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversation?.id === conversationId) {
          setActiveConversation(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
    inputRef.current?.focus();
  };

  const handleFollowUpClick = (question: string) => {
    setMessage(question);
    inputRef.current?.focus();
  };

  if (!hasProviders) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<Settings className="h-full w-full" />}
          title="Configure Providers"
          description="You need to configure AI and Shopping providers to use the shopping assistant."
          action={
            <Button asChild>
              <Link href="/settings/providers">Configure Providers</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {showSidebar && (
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id}
          onConversationSelect={handleConversationSelect}
          onConversationDelete={handleConversationDelete}
          onNewConversation={handleNewConversation}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chat Messages */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<MessageCircle className="h-full w-full" />}
                title="Start a Conversation"
                description="Ask me anything about products you're looking for!"
                className="border-0 shadow-none"
              />
            </div>
          ) : (
            <>
              {activeConversation.messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {msg.role === 'user' ? (
                      <div className="bg-primary text-primary-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-medium">
                        U
                      </div>
                    ) : (
                      <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-full">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                    )}
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="bg-muted/20 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Assistant response data */}
                    {msg.role === 'assistant' && msg.data && (
                      <div className="mt-4 space-y-4">
                        {/* Product Recommendations */}
                        {msg.data.recommendations && msg.data.recommendations.length > 0 && (
                          <div>
                            <h4 className="mb-3 text-sm font-medium">Product Recommendations</h4>
                            <div className="grid gap-3">
                              {msg.data.recommendations.map(
                                (product: ProductRecommendation, i: number) => (
                                  <ProductCard key={i} product={product} />
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Insights */}
                        {msg.data.insights && msg.data.insights.length > 0 && (
                          <div>
                            <h4 className="mb-3 text-sm font-medium">Shopping Insights</h4>
                            <div className="grid gap-2">
                              {msg.data.insights.map(
                                (
                                  insight: {
                                    type: 'tip' | 'warning' | 'info';
                                    title: string;
                                    content: string;
                                  },
                                  i: number
                                ) => (
                                  <InsightCard key={i} insight={insight} />
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Follow-up Questions */}
                        {msg.data.followUpQuestions && msg.data.followUpQuestions.length > 0 && (
                          <div>
                            <h4 className="mb-3 text-sm font-medium">Related Questions</h4>
                            <div className="flex flex-wrap gap-2">
                              {msg.data.followUpQuestions.map((question: string, i: number) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFollowUpClick(question)}
                                  className="text-sm"
                                >
                                  {question}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask me about any product you're looking for..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !message.trim()} size="sm">
              {isLoading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
