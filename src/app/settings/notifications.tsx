import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { TimePickerField } from '@/components/TimePickerField';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';
import { formatCronTime, parseCronTime } from '@/utils/notificationCron';

export default function SettingsNotificationsScreen() {
  const { t } = useTranslation();
  const { styles } = useStyles(getStyles);
  const { settings, updateNotificationSettings } = useStorage();
  const { cron } = settings.notifications;
  const enabled = cron !== null;
  const time = parseCronTime(cron);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsNotifications.title') }} />
      <ScreenScrollView contentStyle={styles.content}>
        <SettingsSection>
          <SettingsRow
            label={t('settingsNotifications.enabled')}
            right={
              <ThemedSwitch
                value={enabled}
                onValueChange={(next) => updateNotificationSettings({ cron: next ? formatCronTime(time) : null })}
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
      </ScreenScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      gap: 10,
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
