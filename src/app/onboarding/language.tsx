import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { setLanguage, type SupportedLanguage } from '@/configs/i18n';
import { useStorage } from '@/storage';
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
  const { settings, updateSettings } = useStorage();
  const currency = settings.currency;
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const setLanguageAndPersist = (code: SupportedLanguage) => {
    void setLanguage(code);
    updateSettings({ language: code });
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.languageTitle')} right={<Icon name="globe-outline" size={20} color={colors.textMuted} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title={t('settingsLanguage.language')}>
          {LANGUAGES.map((language) => (
            <SettingsRow
              key={language.code}
              label={t(language.labelKey)}
              onPress={() => setLanguageAndPersist(language.code)}
              right={i18n.language === language.code ? <Icon name="checkmark" size={18} color={colors.amber} /> : undefined}
            />
          ))}
        </SettingsSection>

        <SettingsSection title={t('settingsLanguage.currency')}>
          {CURRENCIES.map((code) => (
            <SettingsRow
              key={code}
              label={code}
              onPress={() => updateSettings({ currency: code })}
              right={currency === code ? <Icon name="checkmark" size={18} color={colors.amber} /> : undefined}
            />
          ))}
        </SettingsSection>
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => {
          updateSettings({ onboardingDone: true });
          router.replace('/');
        }}
        onNext={() => router.push('/onboarding/account')}
      />
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 20,
      gap: 20,
    },
  });
}
