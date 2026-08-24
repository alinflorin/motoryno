import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useStorage } from '@/storage';

import { darkColors, lightColors, type ColorTokens } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  /** The user's chosen setting: follow the system, or force light/dark. Defaults to 'system'. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The resolved scheme after applying `preference` against the OS setting. */
  scheme: ColorScheme;
  colors: ColorTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { settings, updateSettings } = useStorage();
  const preference = settings.theme;
  const setPreference = useCallback(
    (next: ThemePreference) => updateSettings({ theme: next }),
    [updateSettings],
  );

  const scheme: ColorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference, scheme, colors }),
    [preference, setPreference, scheme, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

/** The active palette, resolved from the user's theme preference and the OS setting. */
export function useThemeColors(): ColorTokens {
  return useThemeContext().colors;
}

/** The user's theme preference (system/light/dark) plus the resolved scheme and a setter. */
export function useThemePreference() {
  const { preference, setPreference, scheme } = useThemeContext();
  return { preference, setPreference, scheme };
}
