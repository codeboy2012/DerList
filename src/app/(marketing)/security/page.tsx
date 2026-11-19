import type { Metadata } from 'next';
import { Database, Key, Lock, Shield, ShieldCheck, UserCheck } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

export const metadata: Metadata = {
  title: `Security — ${siteConfig.name}`,
  description:
    'How DerList protects your data — authentication, encryption, privacy, and security practices.',
};

const practices = [
  {
    icon: Key,
    title: 'Argon2id Password Hashing',
    description:
      'Passwords are hashed using Argon2id — the OWASP-recommended algorithm that resists both GPU cracking and side-channel attacks. We never store plaintext passwords.',
  },
  {
    icon: Lock,
    title: 'Database-Backed Sessions',
    description:
      'Sessions are stored as SHA-256 hashed tokens in PostgreSQL. Even if the database is compromised, session tokens cannot be reconstructed from stored hashes.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Cookies',
    description:
      'Session cookies are HttpOnly (no JavaScript access), Secure (HTTPS only in production), and SameSite=Lax (CSRF protection). Sliding window renewal keeps active users logged in safely.',
  },
  {
    icon: UserCheck,
    title: 'OAuth with PKCE',
    description:
      'Google OAuth uses PKCE (Proof Key for Code Exchange) for enhanced security. GitHub OAuth uses state validation. Both prevent authorization code interception.',
  },
  {
    icon: Shield,
    title: 'Rate-Limited Public Registration',
    description:
      'Anyone can create an account during the Open Beta. Registration requests are rate-limited per IP address and per email, sessions are issued only after validation, and accounts can be disabled by an administrator.',
  },
  {
    icon: Database,
    title: 'Data Privacy',
    description:
      'Wishlists are private by default. No tracking pixels, no advertising, no selling user data. The entire application is open source so you can verify these claims.',
  },
];

export default function SecurityPage() {
  return (
    <div className="flex flex-col">
      <section className="border-border border-b py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">
              Security
            </Badge>
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              Your data is safe with us.
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg">
              Security isn&apos;t an afterthought at DerList. It&apos;s built into every layer of
              the stack.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {practices.map((p, i) => (
              <AnimatedSection key={p.title} variant="fade-up" delay={80 + i * 60}>
                <div className="border-border bg-card flex gap-4 rounded-2xl border p-6">
                  <span className="bg-accent/10 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-foreground text-sm font-semibold">{p.title}</h3>
                    <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="border-border bg-surface/30 border-t py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-foreground text-2xl font-bold">Responsible Disclosure</h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-sm leading-relaxed">
              If you discover a security vulnerability, please report it responsibly via GitHub
              Issues or email. We take all reports seriously and will respond promptly.
            </p>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
