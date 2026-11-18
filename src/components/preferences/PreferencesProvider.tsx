'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  applyPreferences,
  DEFAULT_PREFERENCES,
  getPreferencesServerSnapshot,
  getPreferencesSnapshot,
  subscribeToPreferences,
  updatePreferences,
  type LocalPreferences,
} from '@/lib/preferences/local-settings';

interface PreferencesContextValue {
  preferences: LocalPreferences;
  setPreference: <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => void;
  resetPreferences: () => void;
  /** True once stored preferences have been read on the client. */
  hydrated: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Provides local (device-only) appearance, accessibility and privacy settings.
 *
 * The boot script in the root layout applies stored values before paint; this
 * provider reads the same store through `useSyncExternalStore` so React and the
 * DOM never disagree, and follows the OS theme while "System" is selected.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    getPreferencesSnapshot,
    getPreferencesServerSnapshot
  );

  // Keep the DOM in sync whenever preferences change (external system update).
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  // Follow the operating-system theme while in "System" mode.
  useEffect(() => {
    if (preferences.theme !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyPreferences(preferences);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preferences]);

  const setPreference = useCallback(
    <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => {
      updatePreferences({ ...getPreferencesSnapshot(), [key]: value });
    },
    []
  );

  const resetPreferences = useCallback(() => {
    updatePreferences({ ...DEFAULT_PREFERENCES });
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      setPreference,
      resetPreferences,
      // The store always returns the stored (or default) values on the client.
      hydrated: typeof window !== 'undefined',
    }),
    [preferences, setPreference, resetPreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  }
  return context;
}
