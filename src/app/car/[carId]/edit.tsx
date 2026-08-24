import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarForm } from '@/components/CarForm';
import { Screen } from '@/components/Screen';
import { getCarById } from '@/data/seed';

export default function EditCarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const car = getCarById(carId);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('carForm.editTitle') }} />
      <CarForm
        car={car}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={() => router.back()}
        submitLabel={t('carForm.saveCar')}
      />
    </Screen>
  );
}
