import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Please enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Invitation acceptance (user sets their password and username)
// ─────────────────────────────────────────────────────────────────────────────

export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .min(1, 'Invitation token is required.'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(32, 'Username must be at most 32 characters.')
    .regex(
      /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
      'Username must be lowercase, start and end with a letter or number, and may contain hyphens or underscores.',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required.')
    .max(64, 'Display name must be at most 64 characters.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Create user (admin action)
// ─────────────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Please enter a valid email address.'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(32, 'Username must be at most 32 characters.')
    .regex(
      /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
      'Username must be lowercase, start and end with a letter or number, and may contain hyphens or underscores.',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required.')
    .max(64, 'Display name must be at most 64 characters.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  role: z.enum(['USER', 'ADMIN'], {
    error: 'Role must be USER or ADMIN.',
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
