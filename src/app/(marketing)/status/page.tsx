import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { CheckCircle2, Circle } from 'lucide-react';

export const metadata: Metadata = {
  title: `Status — ${siteConfig.name}`,
  description: 'DerList system status — monitor the health of all services.',
};

const services = [
  { name: 'Website', status: 'operational' as const, description: 'Landing page and marketing site' },
  { name: 'Application', status: 'operational' as const, description: 'Dashboard, wishlists, and user features' },
  { name: 'Authentication', status: 'operational' as const, description: 'Login, OAuth, and sessions' },
  { name: 'Database', status: 'operational' as const, description: 'PostgreSQL primary database' },
  { name: 'Product Import', status: 'operational' as const, description: 'Smart URL import engine' },
  { name: 'Price Tracking', status: 'operational' as const, description: 'Background price monitoring' },
  { name: 'Admin Panel', status: 'operational' as const, description: 'User and content management' },
  { name: 'API', status: 'operational' as const, description: 'Internal search and data APIs' },
];

const statusConfig = {
  operational: { label: 'Operational', color: 'text-success', bg: 'bg-success', badge: 'success' as const },
  degraded: { label: 'Degraded', color: 'text-warning', bg: 'bg-warning', badge: 'warning' as const },
  down: { label: 'Down', color: 'text-danger', bg: 'bg-danger', badge: 'danger' as const },
};

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <div className="flex flex-col">
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Status</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              System Status
            </h1>
            {allOperational && (
              <div className="mx-auto mt-6 flex items-center justify-center gap-2 rounded-full border border-success/30 bg-success/5 px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">All systems operational</span>
              </div>
            )}
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="flex flex-col gap-3">
            {services.map((service, i) => {
              const config = statusConfig[service.status];
              return (
                <AnimatedSection key={service.name} variant="fade-up" delay={i * 40}>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{service.name}</span>
                      <span className="text-xs text-muted-foreground">{service.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${config.bg}`} />
                      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
