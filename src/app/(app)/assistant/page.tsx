import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderManager } from '@/lib/providers';
import { ShoppingAssistantInterface } from './ShoppingAssistantInterface';

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  // Get existing conversations
  const conversations = await prisma.shoppingConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, data: true, createdAt: true },
      },
    },
  });

  // Check if user has any AI provider configured
  const providers = getProviderManager();
  const hasProviders = await providers.hasAI(user.id);

  // Get AI permissions from user config
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });
  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const aiPermissions = (config.assistantPermissions as Record<string, boolean>) ?? {};

  const serializedConversations = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      data: m.data as Record<string, unknown> | null,
      timestamp: m.createdAt.toISOString(),
    })),
  }));

  return (
    <ShoppingAssistantInterface
      userId={user.id}
      initialConversations={serializedConversations}
      hasProviders={hasProviders}
      permissions={aiPermissions}
    />
  );
}
