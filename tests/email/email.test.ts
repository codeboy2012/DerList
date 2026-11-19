import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mail = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mail.createTransport },
}));

const ORIGINAL_ENV = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('email delivery', () => {
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
    vi.resetModules();
    mail.sendMail.mockReset();
    mail.sendMail.mockResolvedValue({ messageId: 'test' });
    mail.createTransport.mockReset();
    mail.createTransport.mockReturnValue({ sendMail: mail.sendMail });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('reports email as unconfigured without SMTP_HOST and SMTP_FROM', async () => {
    const { isEmailConfigured, sendEmail, EmailNotConfiguredError } = await import('@/lib/email');

    expect(isEmailConfigured()).toBe(false);
    await expect(
      sendEmail({ to: 'user@example.test', subject: 'x', text: 'x', html: '<p>x</p>' })
    ).rejects.toBeInstanceOf(EmailNotConfiguredError);
    expect(mail.createTransport).not.toHaveBeenCalled();
  });

  it('creates a transport only when configured and sends a verification link', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_FROM = 'DerList <no-reply@example.test>';

    const { isEmailConfigured, sendVerificationEmail } = await import('@/lib/email');

    expect(isEmailConfigured()).toBe(true);

    await sendVerificationEmail(
      'user@example.test',
      'alice',
      'https://derlist.example.test/verify-email?token=abc'
    );

    expect(mail.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      auth: undefined,
    });

    const message = mail.sendMail.mock.calls[0][0];
    expect(message).toMatchObject({
      to: 'user@example.test',
      subject: expect.stringContaining('Verify'),
    });
    expect(message.text).toContain('https://derlist.example.test/verify-email?token=abc');
    expect(message.html).toContain('https://derlist.example.test/verify-email?token=abc');
  });

  it('uses secure SMTP on port 465 and sends a password reset link', async () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'mailer';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_FROM = 'no-reply@example.test';

    const { sendPasswordResetEmail } = await import('@/lib/email');
    await sendPasswordResetEmail(
      'user@example.test',
      'alice',
      'https://derlist.example.test/reset-password?token=xyz'
    );

    expect(mail.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'mailer', pass: 'secret' },
    });
    expect(mail.sendMail.mock.calls[0][0].text).toContain(
      'https://derlist.example.test/reset-password?token=xyz'
    );
  });
});
