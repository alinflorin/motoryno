import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection>
          <SettingsRow label={t('settings.preferences')} onPress={() => router.push('/settings/preferences')} />
          <SettingsRow label={t('settings.account')} onPress={() => router.push('/settings/account')} />
          <SettingsRow label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} />
          <SettingsRow label={t('settings.reset')} onPress={() => router.push('/settings/reset')} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow label={t('settings.viewOnboarding')} onPress={() => router.push('/onboarding/welcome')} />
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
});
