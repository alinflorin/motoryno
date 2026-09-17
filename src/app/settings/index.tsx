import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScreenScrollView>
        <SettingsSection>
          <SettingsRow label={t('settings.preferences')} onPress={() => router.push('/settings/preferences')} />
          <SettingsRow label={t('settings.data')} onPress={() => router.push('/settings/data')} />
          <SettingsRow label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} />
          <SettingsRow label={t('settings.reset')} onPress={() => router.push('/settings/reset')} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow label={t('settings.viewOnboarding')} onPress={() => router.push('/onboarding/welcome')} />
        </SettingsSection>
      </ScreenScrollView>
    </Screen>
  );
}
