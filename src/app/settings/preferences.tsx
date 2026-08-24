import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { setLanguage, type SupportedLanguage } from '@/configs/i18n';
import { colors } from '@/theme/colors';
import type { DistanceUnit } from '@/types/models';

const LANGUAGES: { code: SupportedLanguage; labelKey: 'settingsLanguage.english' | 'settingsLanguage.romanian' }[] = [
  { code: 'en', labelKey: 'settingsLanguage.english' },
  { code: 'ro', labelKey: 'settingsLanguage.romanian' },
];

const CURRENCIES = ['EUR', 'RON', 'USD'] as const;

type Theme = 'system' | 'dark' | 'light';

const THEMES: { key: Theme; labelKey: 'settings.themeSystem' | 'settings.themeDark' | 'settings.themeLight' }[] = [
  { key: 'system', labelKey: 'settings.themeSystem' },
  { key: 'dark', labelKey: 'settings.themeDark' },
  { key: 'light', labelKey: 'settings.themeLight' },
];

const UNITS: { key: DistanceUnit; labelKey: 'settings.unitsMetric' | 'settings.unitsImperial' }[] = [
  { key: 'km', labelKey: 'settings.unitsMetric' },
  { key: 'mi', labelKey: 'settings.unitsImperial' },
];

export default function SettingsPreferencesScreen() {
  const { t, i18n } = useTranslation();
  // Local-only UI state — none of these persist yet.
  const [unit, setUnit] = useState<DistanceUnit>('km');
  const [theme, setTheme] = useState<Theme>('system');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('EUR');

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.preferences') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title={t('settings.units')}>
          {UNITS.map((option) => (
            <SettingsRow
              key={option.key}
              label={t(option.labelKey)}
              onPress={() => setUnit(option.key)}
              right={unit === option.key ? <Text style={styles.checkmark}>✓</Text> : undefined}
            />
          ))}
        </SettingsSection>

        <SettingsSection title={t('settings.theme')}>
          {THEMES.map((option) => (
            <SettingsRow
              key={option.key}
              label={t(option.labelKey)}
              onPress={() => setTheme(option.key)}
              right={theme === option.key ? <Text style={styles.checkmark}>✓</Text> : undefined}
            />
          ))}
        </SettingsSection>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  checkmark: {
    color: colors.amber,
    fontSize: 15,
    fontWeight: '700',
  },
});
