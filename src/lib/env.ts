import { z } from 'zod';

/**
 * Public, client-safe environment variables.
 *
 * Server-only secrets must NEVER be exposed to the browser.
 * Prefix every public variable with `NEXT_PUBLIC_`.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
});

const parsedClientEnv = clientEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!parsedClientEnv.success) {
  // eslint-disable-next-line no-console
  console.error(
    'Invalid public environment variables:',
    parsedClientEnv.error.flatten().fieldErrors,
  );
}

export const clientEnv = parsedClientEnv.success
  ? parsedClientEnv.data
  : ({} as z.infer<typeof clientEnvSchema>);
