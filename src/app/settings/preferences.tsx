import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { setLanguage, type SupportedLanguage } from '@/configs/i18n';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors, useThemePreference, type ThemePreference } from '@/theme/ThemeContext';
import type { DistanceUnit } from '@/utils/units';

const LANGUAGES: { code: SupportedLanguage; labelKey: 'settingsLanguage.english' | 'settingsLanguage.romanian' }[] = [
  { code: 'en', labelKey: 'settingsLanguage.english' },
  { code: 'ro', labelKey: 'settingsLanguage.romanian' },
];

const CURRENCIES = ['EUR', 'RON', 'USD'] as const;

const THEMES: { key: ThemePreference; labelKey: 'settings.themeSystem' | 'settings.themeDark' | 'settings.themeLight' }[] = [
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
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { preference: theme, setPreference: setTheme } = useThemePreference();
  const { settings, updateSettings } = useStorage();
  const unit: DistanceUnit = settings.useImperialUnits ? 'mi' : 'km';
  const currency = settings.currency;

  const setUnit = (next: DistanceUnit) => updateSettings({ useImperialUnits: next === 'mi' });
  const setCurrency = (next: string) => updateSettings({ currency: next });

  const setLanguageAndPersist = (code: SupportedLanguage) => {
    void setLanguage(code);
    updateSettings({ language: code });
  };

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
              right={unit === option.key ? <Icon name="checkmark" size={18} color={colors.amber} /> : undefined}
            />
          ))}
        </SettingsSection>

        <SettingsSection title={t('settings.theme')}>
          {THEMES.map((option) => (
            <SettingsRow
              key={option.key}
              label={t(option.labelKey)}
              onPress={() => setTheme(option.key)}
              right={theme === option.key ? <Icon name="checkmark" size={18} color={colors.amber} /> : undefined}
            />
          ))}
        </SettingsSection>

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
              onPress={() => setCurrency(code)}
              right={currency === code ? <Icon name="checkmark" size={18} color={colors.amber} /> : undefined}
            />
          ))}
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 20,
      paddingBottom: 32,
    },
  });
}
