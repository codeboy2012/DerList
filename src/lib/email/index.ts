import nodemailer, { type Transporter } from 'nodemailer';
import { siteConfig } from '@/lib/site-config';

/**
 * Minimal transactional email sender.
 *
 * Email is optional for a self-hosted DerList instance. When SMTP is not
 * configured, `isEmailConfigured()` is false and the UI does not offer email
 * verification or password recovery rather than pretending it works.
 *
 * Supported variables:
 *   SMTP_HOST (required), SMTP_PORT (default 587), SMTP_SECURE (true for 465),
 *   SMTP_USER, SMTP_PASSWORD, SMTP_FROM (required).
 */

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('SMTP is not configured.');
    this.name = 'EmailNotConfiguredError';
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!isEmailConfigured()) throw new EmailNotConfiguredError();

  if (!cachedTransporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure =
      process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD;

    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  return cachedTransporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM!.trim(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, body: string, actionLabel: string, url: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b0d12;color:#e6e8ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#12151d;border:1px solid #232838;border-radius:16px;padding:32px">
            <tr><td style="font-size:18px;font-weight:700;padding-bottom:16px">${escapeHtml(siteConfig.name)}</td></tr>
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${escapeHtml(title)}</td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#a9b0c1;padding-bottom:24px">${body}</td></tr>
            <tr>
              <td style="padding-bottom:24px">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#4f7cff;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">${escapeHtml(actionLabel)}</a>
              </td>
            </tr>
            <tr><td style="font-size:12px;line-height:1.6;color:#6f778a;border-top:1px solid #232838;padding-top:16px">
              If the button does not work, copy this link into your browser:<br>
              <span style="word-break:break-all;color:#a9b0c1">${escapeHtml(url)}</span>
            </td></tr>
            <tr><td style="font-size:12px;color:#6f778a;padding-top:12px">If you did not request this email, you can ignore it.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(
  to: string,
  username: string,
  url: string
): Promise<void> {
  const name = escapeHtml(username);
  await sendEmail({
    to,
    subject: `Verify your ${siteConfig.name} email address`,
    text: `Hi ${username},\n\nConfirm your email address to finish setting up your ${siteConfig.name} account:\n${url}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
    html: layout(
      'Confirm your email address',
      `Hi ${name}, confirm this address to finish setting up your ${escapeHtml(siteConfig.name)} account. This link expires in 24 hours.`,
      'Verify email',
      url
    ),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  url: string
): Promise<void> {
  const name = escapeHtml(username);
  await sendEmail({
    to,
    subject: `Reset your ${siteConfig.name} password`,
    text: `Hi ${username},\n\nUse this link to choose a new ${siteConfig.name} password:\n${url}\n\nThis link expires in 1 hour and can only be used once. If you did not request a reset, you can ignore this email.`,
    html: layout(
      'Reset your password',
      `Hi ${name}, use the button below to choose a new password. This link expires in 1 hour and can only be used once.`,
      'Choose a new password',
      url
    ),
  });
}
