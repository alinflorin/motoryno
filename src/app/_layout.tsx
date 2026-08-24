import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import '@/configs/i18n';
import { StorageProvider } from '@/storage';
import { ThemeProvider, useThemeColors, useThemePreference } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync();

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
