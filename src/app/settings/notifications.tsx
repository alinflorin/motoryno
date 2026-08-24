import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { TimePickerField } from '@/components/TimePickerField';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { formatCronTime, parseCronTime } from '@/utils/notificationCron';

export default function SettingsNotificationsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { settings, updateNotificationSettings } = useStorage();
  const { cron } = settings.notifications;
  const enabled = cron !== null;
  const time = parseCronTime(cron);

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
                onValueChange={(next) => updateNotificationSettings({ cron: next ? formatCronTime(time) : null })}
                trackColor={{ true: colors.amber, false: colors.borderStrong }}
                thumbColor={colors.textPrimary}
              />
            }
          />
        </SettingsSection>
        <Text style={styles.footnote}>{t('settingsNotifications.enabledSubtitle')}</Text>

        <SettingsSection>
          <TimePickerField
            label={t('settingsNotifications.time')}
            value={time}
            disabled={!enabled}
            onChange={(next) => updateNotificationSettings({ cron: formatCronTime(next) })}
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
