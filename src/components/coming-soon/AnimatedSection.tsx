'use client';

import { cn } from '@/utils/cn';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

export type AnimationVariant = 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right';

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  /** Animation style. Defaults to 'fade-up'. */
  variant?: AnimationVariant;
  /** Delay in milliseconds before the animation plays (default 0). */
  delay?: number;
  /** IntersectionObserver threshold (0–1, default 0.1). */
  threshold?: number;
}

/** Subscribe to prefers-reduced-motion changes. */
function subscribeToReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServer() {
  return false;
}

/**
 * Wraps children in a div that fades/slides in when it enters the viewport.
 *
 * Respects `prefers-reduced-motion` — the element becomes instantly visible
 * when the user has opted out of animations. Uses IntersectionObserver so
 * animation only fires once.
 */
export function AnimatedSection({
  children,
  className,
  variant = 'fade-up',
  delay = 0,
  threshold = 0.1,
}: AnimatedSectionProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );

  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, prefersReducedMotion]);

  const initial: Record<AnimationVariant, string> = {
    'fade-up': 'translate-y-6 opacity-0',
    'fade-in': 'opacity-0',
    'fade-left': '-translate-x-6 opacity-0',
    'fade-right': 'translate-x-6 opacity-0',
  };

  // When reduced motion is preferred, always visible with no animation
  const isVisible = visible || prefersReducedMotion;

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[transform,opacity]',
        !isVisible && initial[variant],
        isVisible && 'translate-x-0 translate-y-0 opacity-100',
        className,
      )}
      style={{
        transitionDuration: prefersReducedMotion ? '0ms' : '600ms',
        transitionDelay: prefersReducedMotion ? '0ms' : `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
