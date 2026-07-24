import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { CheckCircle2, Database, Key, Lock, Shield, ShieldCheck, UserCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: `Security — ${siteConfig.name}`,
  description: 'How DerList protects your data — authentication, encryption, privacy, and security practices.',
};

const practices = [
  {
    icon: Key, title: 'Argon2id Password Hashing',
    description: 'Passwords are hashed using Argon2id — the OWASP-recommended algorithm that resists both GPU cracking and side-channel attacks. We never store plaintext passwords.',
  },
  {
    icon: Lock, title: 'Database-Backed Sessions',
    description: 'Sessions are stored as SHA-256 hashed tokens in PostgreSQL. Even if the database is compromised, session tokens cannot be reconstructed from stored hashes.',
  },
  {
    icon: ShieldCheck, title: 'Secure Cookies',
    description: 'Session cookies are HttpOnly (no JavaScript access), Secure (HTTPS only in production), and SameSite=Lax (CSRF protection). Sliding window renewal keeps active users logged in safely.',
  },
  {
    icon: UserCheck, title: 'OAuth with PKCE',
    description: 'Google OAuth uses PKCE (Proof Key for Code Exchange) for enhanced security. GitHub OAuth uses state validation. Both prevent authorization code interception.',
  },
  {
    icon: Shield, title: 'Invite-Only Access',
    description: 'No public registration. Accounts are created only through administrator invitations or approved beta access requests. This prevents spam and unauthorized access during beta.',
  },
  {
    icon: Database, title: 'Data Privacy',
    description: 'Wishlists are private by default. No tracking pixels, no advertising, no selling user data. The entire application is open source so you can verify these claims.',
  },
];

export default function SecurityPage() {
  return (
    <div className="flex flex-col">
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Security</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Your data is safe with us.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Security isn&apos;t an afterthought at DerList. It&apos;s built into every layer of the stack.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {practices.map((p, i) => (
              <AnimatedSection key={p.title} variant="fade-up" delay={80 + i * 60}>
                <div className="flex gap-4 rounded-2xl border border-border bg-card p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="border-t border-border bg-surface/30 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-2xl font-bold text-foreground">Responsible Disclosure</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground leading-relaxed">
              If you discover a security vulnerability, please report it responsibly via GitHub Issues or email. We take all reports seriously and will respond promptly.
            </p>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
