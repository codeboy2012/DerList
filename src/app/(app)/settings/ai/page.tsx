import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AISettingsForm } from './AISettingsForm';

export default async function AISettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });

  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const permissions = (config.assistantPermissions as Record<string, boolean>) ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">AI Settings</h1>
        <p className="text-muted-foreground mt-1">
          Control what the Shopping Assistant can do with your data.
        </p>
      </div>
      <AISettingsForm permissions={permissions} />
    </div>
  );
}
