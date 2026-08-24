import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarForm } from '@/components/CarForm';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import { distanceUnitFor } from '@/utils/units';

export default function AddCarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, cars, addCar } = useStorage();
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('carForm.addTitle') }} />
      <CarForm
        distanceUnit={distanceUnit}
        existingVins={cars.map((car) => car.vin)}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(parsed) => {
          addCar(parsed);
          router.back();
        }}
        submitLabel={t('carForm.saveCar')}
      />
    </Screen>
  );
}
