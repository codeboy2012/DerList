/**
 * AI Provider Settings Page
 * 
 * Allows users to select and configure their preferred AI provider.
 * Shows available providers with their features, pricing, and setup instructions.
 */

import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAvailableProviders, getProviderMetadata } from '@/lib/ai/providers';
import { AIProviderSelector } from './AIProviderSelector';
import { prisma } from '@/lib/prisma';

export default async function AISettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Get user's current AI provider settings
  const userWithAI = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      aiProviderId: true,
      aiProviderConfig: true,
    },
  });

  const availableProviders = getAvailableProviders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Provider</h1>
        <p className="text-muted-foreground mt-2">
          Choose and configure your preferred AI provider for product identification, 
          search, and shopping assistance.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Current Provider</h2>
            <p className="text-sm text-muted-foreground">
              {userWithAI?.aiProviderId
                ? `Using ${getProviderMetadata(userWithAI.aiProviderId)?.name || userWithAI.aiProviderId}`
                : 'No AI provider configured'}
            </p>
          </div>

          <AIProviderSelector
            availableProviders={availableProviders}
            currentProviderId={userWithAI?.aiProviderId || null}
            currentConfig={userWithAI?.aiProviderConfig as Record<string, unknown> || {}}
            userId={user.id}
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-medium">About AI Providers</h2>
          <div className="space-y-3 text-sm">
            <p>
              <strong>SerpApi (Recommended for new users)</strong> - Free tier with Google Shopping 
              integration. Great for product discovery but limited conversation capabilities.
            </p>
            <p>
              <strong>OpenAI</strong> - Premium provider with best-in-class chat, vision, and 
              reasoning capabilities. Pay-per-use pricing.
            </p>
            <p>
              <strong>Coming Soon:</strong> Anthropic Claude, Google Gemini, OpenRouter, 
              Ollama (local), LM Studio, and custom API support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}