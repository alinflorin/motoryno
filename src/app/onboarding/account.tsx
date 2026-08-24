import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function OnboardingAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useStorage();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.accountTitle')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('settingsAccount.syncSubtitle')}</Text>

        <View style={styles.loginButtons}>
          <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}>
            <Icon name="logo-google" size={18} color={colors.textSecondary} />
            <Text style={styles.loginText}>{t('settingsAccount.loginWithGoogle')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}>
            <Icon name="logo-apple" size={18} color={colors.textSecondary} />
            <Text style={styles.loginText}>{t('settingsAccount.loginWithApple')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => {
          updateSettings({ onboardingDone: true });
          router.replace('/');
        }}
        onNext={() => router.push('/onboarding/add-car')}
      />
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 24,
      gap: 20,
    },
    intro: {
      color: colors.textFaint,
      fontSize: 13,
      lineHeight: 18,
    },
    loginButtons: {
      gap: 10,
    },
    loginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingVertical: 13,
    },
    loginButtonPressed: {
      borderColor: colors.amberBorder,
    },
    loginText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
