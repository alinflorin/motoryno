import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import '@/configs/i18n';
import { StorageProvider } from '@/storage';
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

function RootLayoutNav() {
  const { scheme } = useThemePreference();
  const colors = useThemeColors();

  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <StorageProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </StorageProvider>
  );
}
