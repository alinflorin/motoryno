import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarForm, parseCarFormValues } from '@/components/CarForm';
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
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(values) => {
          const parsed = parseCarFormValues(values, distanceUnit);
          if (!parsed) return;
          if (cars.some((car) => car.vin === parsed.vin)) {
            // TODO: surface a proper inline error once form validation UX is designed.
            console.warn(`[add-car] A car with VIN ${parsed.vin} already exists.`);
            return;
          }
          addCar(parsed);
          router.back();
        }}
        submitLabel={t('carForm.saveCar')}
      />
    </Screen>
  );
}
