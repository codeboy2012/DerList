import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversations = await prisma.shoppingConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ conversations });
}
