'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export type BetaFormState = { success: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  interest: z.string().min(1).max(200),
  newsletter: z.coerce.boolean().default(false),
});

export async function submitBetaAccess(_prev: BetaFormState, formData: FormData): Promise<BetaFormState> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    interest: formData.get('interest'),
    newsletter: formData.get('newsletter') === 'on',
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'Please fill in all required fields.' };

  const { name, email, interest, newsletter } = parsed.data;

  const existing = await prisma.waitlist.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { success: false, error: "You're already on the list!" };

  await prisma.waitlist.create({
    data: { name, email: email.toLowerCase().trim(), interest, newsletter },
  });

  return { success: true };
}
