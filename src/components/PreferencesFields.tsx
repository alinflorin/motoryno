import { useTranslation } from 'react-i18next';
import { Switch, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { setLanguage, type SupportedLanguage } from '@/configs/i18n';
import { useStorage } from '@/storage';
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

/**
 * Units / theme / language / currency pickers, shared by Settings > Preferences
 * and the onboarding preferences step so both stay in sync.
 */
export function PreferencesFields() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
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
    <>
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

      <SettingsSection title={t('settings.overdueAlerts')}>
        <SettingsRow
          label={t('settings.useUnknownServiceStatus')}
          right={
            <Switch
              value={settings.useUnknownServiceStatus}
              onValueChange={(next) => updateSettings({ useUnknownServiceStatus: next })}
              trackColor={{ true: colors.amber, false: colors.borderStrong }}
              thumbColor={colors.textPrimary}
            />
          }
        />
      </SettingsSection>
      <Text style={{ color: colors.textFaint, fontSize: 12, paddingHorizontal: 4, marginTop: -12 }}>
        {t('settings.useUnknownServiceStatusSubtitle')}
      </Text>
    </>
  );
}
