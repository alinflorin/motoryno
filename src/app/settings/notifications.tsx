import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function SettingsNotificationsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Local-only UI state — not wired to real scheduling yet.
  const [enabled, setEnabled] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsNotifications.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection>
          <SettingsRow
            label={t('settingsNotifications.enabled')}
            right={
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ true: colors.amber, false: colors.borderStrong }}
                thumbColor={colors.textPrimary}
              />
            }
          />
        </SettingsSection>
        <Text style={styles.footnote}>{t('settingsNotifications.enabledSubtitle')}</Text>

        <SettingsSection>
          <SettingsRow label={t('settingsNotifications.time')} value="08:00" />
          <SettingsRow
            label={t('settingsNotifications.sound')}
            right={
              <Switch
                value={sound}
                onValueChange={setSound}
                trackColor={{ true: colors.amber, false: colors.borderStrong }}
                thumbColor={colors.textPrimary}
              />
            }
          />
          <SettingsRow
            label={t('settingsNotifications.vibrate')}
            right={
              <Switch
                value={vibrate}
                onValueChange={setVibrate}
                trackColor={{ true: colors.amber, false: colors.borderStrong }}
                thumbColor={colors.textPrimary}
              />
            }
          />
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 10,
      paddingBottom: 32,
    },
    footnote: {
      color: colors.textFaint,
      fontSize: 12,
      paddingHorizontal: 4,
      marginTop: -4,
      marginBottom: 6,
    },
  });
}
