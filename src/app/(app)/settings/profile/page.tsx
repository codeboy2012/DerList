import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

import { ProfileForm } from './ProfileForm';

export const metadata: Metadata = {
  title: `Profile — ${siteConfig.name}`,
};

export default async function ProfileSettingsPage() {
  const sessionUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!user) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>
    </div>
  );
}
