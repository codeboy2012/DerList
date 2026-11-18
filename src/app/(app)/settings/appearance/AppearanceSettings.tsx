'use client';

import { Eye, Focus, Monitor, Moon, Sparkles, Sun, Waves } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  ACCENT_KEYS,
  ACCENT_PALETTE,
  type AccentKey,
  type GlassMode,
  type ThemeMode,
} from '@/lib/preferences/local-settings';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePreferences } from '@/components/preferences/PreferencesProvider';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

const glassOptions: Array<{ value: GlassMode; label: string; hint: string }> = [
  { value: 'off', label: 'Off', hint: 'Solid panels' },
  { value: 'subtle', label: 'Subtle', hint: 'Default glass' },
  { value: 'full', label: 'Liquid Glass', hint: 'Deep blur + glow' },
];

export function AppearanceSettings() {
  const { preferences, setPreference, resetPreferences } = usePreferences();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-foreground text-base font-semibold">Appearance &amp; local settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Stored on this device only — these preferences never leave your browser.
        </p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sun className="text-accent h-4 w-4" aria-hidden />
            Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
            {themeOptions.map((option) => {
              const active = preferences.theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreference('theme', option.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border bg-surface text-muted-foreground hover:border-border-hover hover:text-foreground'
                  )}
                >
                  <option.icon className="h-4 w-4" aria-hidden />
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-accent h-4 w-4" aria-hidden />
            Accent colour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_KEYS.map((key: AccentKey) => {
              const palette = ACCENT_PALETTE[key];
              const active = preferences.accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreference('accent', key)}
                  aria-label={palette.label}
                  aria-pressed={active}
                  title={palette.label}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition-transform',
                    active ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: palette.accent }}
                />
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            {ACCENT_PALETTE[preferences.accent].label}
          </p>
        </CardContent>
      </Card>

      {/* Liquid Glass */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Waves className="text-accent h-4 w-4" aria-hidden />
            Liquid Glass
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Liquid Glass">
            {glassOptions.map((option) => {
              const active = preferences.glass === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreference('glass', option.value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-3 text-left transition-colors',
                    active
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-border bg-surface hover:border-border-hover'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-accent' : 'text-foreground'
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-[11px]">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Focus className="text-accent h-4 w-4" aria-hidden />
            Accessibility
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <ToggleRow
            label="Reduce motion"
            hint="Disable page and hover animations."
            checked={preferences.reduceMotion}
            onChange={(value) => setPreference('reduceMotion', value)}
          />
          <ToggleRow
            label="Reduce transparency"
            hint="Replace blurred glass surfaces with solid panels."
            checked={preferences.reduceTransparency}
            onChange={(value) => setPreference('reduceTransparency', value)}
          />
          <ToggleRow
            label="Always show focus rings"
            hint="Keep focus outlines visible for mouse users too."
            checked={preferences.alwaysShowFocus}
            onChange={(value) => setPreference('alwaysShowFocus', value)}
          />
        </CardContent>
      </Card>

      {/* Local privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Eye className="text-accent h-4 w-4" aria-hidden />
            Screen privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <ToggleRow
            label="Blur product images"
            hint="Images stay blurred until you hover them."
            checked={preferences.blurImages}
            onChange={(value) => setPreference('blurImages', value)}
          />
          <ToggleRow
            label="Blur prices"
            hint="Hide prices while sharing your screen."
            checked={preferences.hidePrices}
            onChange={(value) => setPreference('hidePrices', value)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={resetPreferences}>
          Reset to defaults
        </Button>
        <span className="text-muted-foreground text-xs">Changes save automatically.</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="hover:bg-surface/60 flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors">
      <span className="flex flex-col">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-border bg-card'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}
