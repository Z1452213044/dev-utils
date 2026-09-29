import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Appearance = 'system' | 'light' | 'dark';
export type DiffMode = 'side' | 'inline';

export interface Settings {
  appearance: Appearance;
  editorFontSize: number;
  tabSize: number;
  wordWrap: boolean;
  defaultDiffMode: DiffMode;
  defaultIgnoreWhitespace: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  editorFontSize: 13,
  tabSize: 4,
  wordWrap: false,
  defaultDiffMode: 'side',
  defaultIgnoreWhitespace: false,
};

const STORAGE_KEY = 'dt.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => undefined,
});

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function systemPrefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resolvedTheme =
    settings.appearance === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : settings.appearance;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);
  }, [settings.editorFontSize]);

  useEffect(() => {
    if (settings.appearance !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light';
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [settings.appearance]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
