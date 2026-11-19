import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fields
// ─────────────────────────────────────────────────────────────────────────────

const emailField = z
  .string()
  .min(1, 'Email is required.')
  .max(254, 'Email must be at most 254 characters.')
  .email('Please enter a valid email address.');

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters.')
  .max(32, 'Username must be at most 32 characters.')
  .regex(
    /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
    'Username may contain only letters, numbers, hyphens and underscores, and must start and end with a letter or number.'
  );

const displayNameField = z
  .string()
  .max(64, 'Display name must be at most 64 characters.')
  .optional()
  .or(z.literal(''));

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.');

const confirmPasswordField = z.string().min(1, 'Please confirm your password.');

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

/** Sign in with either an email address or a username. */
export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required.')
    .max(254, 'Email or username is too long.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Public registration — username
// ─────────────────────────────────────────────────────────────────────────────

export const registerUsernameSchema = z
  .object({
    method: z.literal('username'),
    username: usernameField,
    email: emailField,
    displayName: displayNameField,
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterUsernameInput = z.infer<typeof registerUsernameSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Public registration — email
// ─────────────────────────────────────────────────────────────────────────────

export const registerEmailSchema = z
  .object({
    method: z.literal('email'),
    email: emailField,
    displayName: displayNameField,
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterEmailInput = z.infer<typeof registerEmailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Password recovery
// ─────────────────────────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'This reset link is invalid.'),
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

// ─────────────────────────────────────────────────────────────────────────────
// Invitation acceptance (user sets their password and username)
// ─────────────────────────────────────────────────────────────────────────────

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1, 'Invitation token is required.'),
    username: usernameField,
    displayName: z
      .string()
      .min(1, 'Display name is required.')
      .max(64, 'Display name must be at most 64 characters.'),
    password: passwordField,
    confirmPassword: confirmPasswordField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Create user (admin action)
// ─────────────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: emailField,
  username: usernameField,
  displayName: z
    .string()
    .min(1, 'Display name is required.')
    .max(64, 'Display name must be at most 64 characters.'),
  password: passwordField,
  role: z.enum(['USER', 'ADMIN'], {
    error: 'Role must be USER or ADMIN.',
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Re-export the individual field schemas for settings and tests.
export { emailField, usernameField, passwordField };
