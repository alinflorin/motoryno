import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { setLanguage, type SupportedLanguage } from '@/configs/i18n';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

const LANGUAGES: { code: SupportedLanguage; labelKey: 'settingsLanguage.english' | 'settingsLanguage.romanian' }[] = [
  { code: 'en', labelKey: 'settingsLanguage.english' },
  { code: 'ro', labelKey: 'settingsLanguage.romanian' },
];

const CURRENCIES = ['EUR', 'RON', 'USD'] as const;

export default function OnboardingLanguageScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('EUR');
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.languageTitle')} right={<Text style={styles.globe}>🌐</Text>} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title={t('settingsLanguage.language')}>
          {LANGUAGES.map((language) => (
            <SettingsRow
              key={language.code}
              label={t(language.labelKey)}
              onPress={() => setLanguage(language.code)}
              right={i18n.language === language.code ? <Text style={styles.checkmark}>✓</Text> : undefined}
            />
          ))}
        </SettingsSection>

        <SettingsSection title={t('settingsLanguage.currency')}>
          {CURRENCIES.map((code) => (
            <SettingsRow
              key={code}
              label={code}
              onPress={() => setCurrency(code)}
              right={currency === code ? <Text style={styles.checkmark}>✓</Text> : undefined}
            />
          ))}
        </SettingsSection>
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => router.replace('/')}
        onNext={() => router.push('/onboarding/account')}
      />
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    globe: {
      fontSize: 18,
    },
    content: {
      padding: 16,
      paddingTop: 20,
      gap: 20,
    },
    checkmark: {
      color: colors.amber,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
