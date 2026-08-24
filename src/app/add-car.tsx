import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarForm } from '@/components/CarForm';
import { Screen } from '@/components/Screen';

export default function AddCarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('carForm.addTitle') }} />
      <CarForm
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={() => router.back()}
        submitLabel={t('carForm.saveCar')}
      />
    </Screen>
  );
}
