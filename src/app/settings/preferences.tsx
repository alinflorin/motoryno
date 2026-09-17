import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PreferencesFields } from '@/components/PreferencesFields';
import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';

export default function SettingsPreferencesScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.preferences') }} />
      <ScreenScrollView>
        <PreferencesFields />
      </ScreenScrollView>
    </Screen>
  );
}
