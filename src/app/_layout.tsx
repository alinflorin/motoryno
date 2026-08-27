import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { ObdMonitorController } from '@/ble/ObdMonitorController';
import '@/configs/i18n';
import { NotificationsController } from '@/notifications/NotificationsController';
import { StorageProvider } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { ThemeProvider, useThemeColors, useThemePreference } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync();

// On web, expo-router's <Link> renders an <a>. When it's pressed, React
// Navigation marks the outgoing screen's container aria-hidden while the
// clicked link (or focus that later lands back on it) is still inside it,
// which trips an a11y warning ("Blocked aria-hidden on an element because
// its descendant retained focus"). Guessing at event timing (blurring on
// pointerdown/click) doesn't reliably win the race against the browser's
// own focus-on-click behavior, so instead watch for aria-hidden actually
// being applied and, if it lands on an element that still contains focus,
// move focus away immediately.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (
        target.getAttribute('aria-hidden') === 'true' &&
        document.activeElement instanceof HTMLElement &&
        target.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true,
  });
}

/**
 * Builds a React Navigation theme (used for the native chrome - header/back button -
 * that iOS renders and interpolates outside our own screenOptions) from our color tokens,
 * so it tracks dark/light instead of defaulting to React Navigation's built-in light theme.
 * Without this, the iOS back button stays tinted for the default light theme (i.e. shows up
 * white/wrong) even when the app itself is in dark mode - see expo-router's Stack docs on
 * "Dark Mode Handling".
 */
function useNavigationTheme(scheme: 'light' | 'dark', colors: ColorTokens) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return useMemo(
    () => ({
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        primary: colors.amber,
        background: colors.background,
        card: colors.background,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.red,
      },
    }),
    [base, scheme, colors]
  );
}

function RootLayoutNav() {
  const { scheme } = useThemePreference();
  const colors = useThemeColors();
  const navigationTheme = useNavigationTheme(scheme, colors);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.amber,
          headerTitleStyle: { color: colors.textPrimary },
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <StorageProvider>
      <ThemeProvider>
        <NotificationsController />
        <ObdMonitorController />
        <RootLayoutNav />
      </ThemeProvider>
    </StorageProvider>
  );
}
