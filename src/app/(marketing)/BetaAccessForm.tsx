'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import { submitBetaAccess, type BetaFormState } from './beta-action';

const initialState: BetaFormState = { success: false };

export function BetaAccessForm() {
  const [state, formAction, pending] = useActionState(submitBetaAccess, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-success/20 bg-success/5 p-8 text-center animate-scale-in">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </span>
        <h3 className="text-lg font-semibold text-foreground">You&apos;re on the list!</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;re sending invitations in waves. You&apos;ll receive an email when your access is ready.
          In the meantime, follow us on{' '}
          <a href="https://github.com/codeboy2012/DerList" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            GitHub
          </a>{' '}
          for updates.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left" noValidate>
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-xs text-danger">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="beta-name" className="text-sm font-medium text-foreground">Name</label>
        <Input id="beta-name" name="name" required placeholder="Your name" autoComplete="name" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="beta-email" className="text-sm font-medium text-foreground">Email</label>
        <Input id="beta-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="beta-interest" className="text-sm font-medium text-foreground">What excites you most?</label>
        <Select id="beta-interest" name="interest" defaultValue="">
          <option value="" disabled>Select one</option>
          <option value="Universal Wishlists">Universal Wishlists</option>
          <option value="Smart Product Import">Smart Product Import</option>
          <option value="Live Price Tracking">Live Price Tracking</option>
          <option value="Free PC Builder">Free PC Builder</option>
          <option value="Sharing & Collaboration">Sharing &amp; Collaboration</option>
          <option value="Self-Hosting">Self-Hosting</option>
          <option value="All of the above">All of the above</option>
        </Select>
      </div>

      <Checkbox name="newsletter" label="Send me product updates" description="No spam. Unsubscribe anytime." defaultChecked />

      <Button type="submit" disabled={pending} className="mt-2 w-full gap-2 glow-accent">
        {pending ? (
          <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Submitting...</>
        ) : (
          <><Sparkles className="h-4 w-4" aria-hidden /> Request Beta Access</>
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        We respect your privacy. No spam, ever.
      </p>
    </form>
  );
}
