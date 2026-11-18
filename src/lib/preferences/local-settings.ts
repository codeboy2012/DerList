/**
 * Local preferences — device-scoped appearance, accessibility and privacy
 * settings.
 *
 * These deliberately live in `localStorage`, not the database: they describe
 * how DerList looks on *this* device (theme, glass, accent) and are not part
 * of the user's account data. There is exactly one store for them, so they
 * never duplicate server-side settings.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type GlassMode = 'off' | 'subtle' | 'full';
export type AccentKey = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

export interface LocalPreferences {
  /** Light, dark, or follow the operating system. */
  theme: ThemeMode;
  /** Accent colour used across the app. */
  accent: AccentKey;
  /** Liquid Glass intensity for panels, headers and cards. */
  glass: GlassMode;
  /** Disable non-essential animation. */
  reduceMotion: boolean;
  /** Disable backdrop blur / translucency. */
  reduceTransparency: boolean;
  /** Always render focus rings, not just for keyboard users. */
  alwaysShowFocus: boolean;
  /** Blur product images until hovered (screen-sharing privacy). */
  blurImages: boolean;
  /** Blur prices until hovered (screen-sharing privacy). */
  hidePrices: boolean;
}

export const PREFERENCES_STORAGE_KEY = 'derlist.preferences.v1';

export const DEFAULT_PREFERENCES: LocalPreferences = {
  theme: 'dark',
  accent: 'blue',
  glass: 'subtle',
  reduceMotion: false,
  reduceTransparency: false,
  alwaysShowFocus: false,
  blurImages: false,
  hidePrices: false,
};

export const ACCENT_PALETTE: Record<
  AccentKey,
  { label: string; accent: string; hover: string; glow: string }
> = {
  blue: {
    label: 'DerList Blue',
    accent: '#3b82f6',
    hover: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.15)',
  },
  violet: {
    label: 'Violet',
    accent: '#8b5cf6',
    hover: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.16)',
  },
  emerald: {
    label: 'Emerald',
    accent: '#10b981',
    hover: '#059669',
    glow: 'rgba(16, 185, 129, 0.16)',
  },
  amber: { label: 'Amber', accent: '#f59e0b', hover: '#d97706', glow: 'rgba(245, 158, 11, 0.16)' },
  rose: { label: 'Rose', accent: '#f43f5e', hover: '#e11d48', glow: 'rgba(244, 63, 94, 0.16)' },
  cyan: { label: 'Cyan', accent: '#06b6d4', hover: '#0891b2', glow: 'rgba(6, 182, 212, 0.16)' },
};

export const ACCENT_KEYS = Object.keys(ACCENT_PALETTE) as AccentKey[];

/** Resolve `system` against the operating-system preference. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Merge stored values onto defaults, discarding anything unexpected. */
export function normalizePreferences(input: unknown): LocalPreferences {
  if (!input || typeof input !== 'object') return { ...DEFAULT_PREFERENCES };
  const raw = input as Record<string, unknown>;
  const bool = (key: keyof LocalPreferences) =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : (DEFAULT_PREFERENCES[key] as boolean);

  const theme: ThemeMode =
    raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
      ? raw.theme
      : DEFAULT_PREFERENCES.theme;
  const glass: GlassMode =
    raw.glass === 'off' || raw.glass === 'subtle' || raw.glass === 'full'
      ? raw.glass
      : DEFAULT_PREFERENCES.glass;
  const accent: AccentKey =
    typeof raw.accent === 'string' && (ACCENT_KEYS as string[]).includes(raw.accent)
      ? (raw.accent as AccentKey)
      : DEFAULT_PREFERENCES.accent;

  return {
    theme,
    accent,
    glass,
    reduceMotion: bool('reduceMotion'),
    reduceTransparency: bool('reduceTransparency'),
    alwaysShowFocus: bool('alwaysShowFocus'),
    blurImages: bool('blurImages'),
    hidePrices: bool('hidePrices'),
  };
}

export function readPreferences(): LocalPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return normalizePreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(preferences: LocalPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode, quota) — preferences stay
    // applied for the current page load only.
  }
}

/**
 * Push preferences onto the document so CSS can react to them.
 *
 * `data-*` attributes cover structural switches (theme, glass, motion), while
 * the accent palette is written as CSS custom properties so it overrides the
 * theme defaults.
 */
export function applyPreferences(preferences: LocalPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const palette = ACCENT_PALETTE[preferences.accent] ?? ACCENT_PALETTE.blue;

  root.dataset.theme = resolveTheme(preferences.theme);
  root.dataset.themeMode = preferences.theme;
  root.dataset.glass = preferences.glass;
  root.dataset.motion = preferences.reduceMotion ? 'reduced' : 'full';
  root.dataset.transparency = preferences.reduceTransparency ? 'reduced' : 'full';
  root.dataset.focus = preferences.alwaysShowFocus ? 'always' : 'auto';
  root.dataset.blurImages = String(preferences.blurImages);
  root.dataset.hidePrices = String(preferences.hidePrices);

  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-hover', palette.hover);
  root.style.setProperty('--ring', palette.accent);
  root.style.setProperty('--accent-glow', palette.glow);
}

/**
 * Inline script that applies stored preferences before first paint so the app
 * never flashes the wrong theme. Kept as a string so it can run synchronously
 * in <head>.
 */
export const PREFERENCES_BOOT_SCRIPT = `
(function(){
  try {
    var key = '${PREFERENCES_STORAGE_KEY}';
    var defaults = ${JSON.stringify(DEFAULT_PREFERENCES)};
    var palette = ${JSON.stringify(ACCENT_PALETTE)};
    var stored = window.localStorage.getItem(key);
    var p = stored ? Object.assign({}, defaults, JSON.parse(stored)) : defaults;
    var root = document.documentElement;
    var systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = p.theme === 'system' ? (systemLight ? 'light' : 'dark') : (p.theme === 'light' ? 'light' : 'dark');
    root.dataset.theme = theme;
    root.dataset.themeMode = p.theme;
    root.dataset.glass = p.glass || 'subtle';
    root.dataset.motion = p.reduceMotion ? 'reduced' : 'full';
    root.dataset.transparency = p.reduceTransparency ? 'reduced' : 'full';
    root.dataset.focus = p.alwaysShowFocus ? 'always' : 'auto';
    root.dataset.blurImages = String(!!p.blurImages);
    root.dataset.hidePrices = String(!!p.hidePrices);
    var a = palette[p.accent] || palette.blue;
    root.style.setProperty('--accent', a.accent);
    root.style.setProperty('--accent-hover', a.hover);
    root.style.setProperty('--ring', a.accent);
    root.style.setProperty('--accent-glow', a.glow);
  } catch (e) {}
})();
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Tiny external store
// ─────────────────────────────────────────────────────────────────────────────
// `useSyncExternalStore` lets components read localStorage without rendering a
// mismatched first paint or calling setState inside an effect. The boot script
// above handles the pre-paint case; this keeps React in sync afterwards.

const listeners = new Set<() => void>();
let cachedPreferences: LocalPreferences | null = null;

/** Server snapshot is always the defaults — hydration then swaps in stored values. */
const SERVER_SNAPSHOT: LocalPreferences = { ...DEFAULT_PREFERENCES };

export function getPreferencesSnapshot(): LocalPreferences {
  if (cachedPreferences === null) {
    cachedPreferences = readPreferences();
  }
  return cachedPreferences;
}

export function getPreferencesServerSnapshot(): LocalPreferences {
  return SERVER_SNAPSHOT;
}

export function subscribeToPreferences(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PREFERENCES_STORAGE_KEY && event.key !== null) return;
    cachedPreferences = readPreferences();
    applyPreferences(cachedPreferences);
    listeners.forEach((notify) => notify());
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Persist, apply and notify React in one step. */
export function updatePreferences(next: LocalPreferences): void {
  const normalized = normalizePreferences(next);
  cachedPreferences = normalized;
  writePreferences(normalized);
  applyPreferences(normalized);
  listeners.forEach((notify) => notify());
}
