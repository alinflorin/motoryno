import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarForm, parseCarFormValues } from '@/components/CarForm';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import { distanceUnitFor } from '@/utils/units';

export default function EditCarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, cars, getCar, updateCar } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('carForm.editTitle') }} />
      <CarForm
        car={car}
        distanceUnit={distanceUnit}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(values) => {
          const parsed = parseCarFormValues(values, distanceUnit);
          if (!parsed || !car) return;
          if (parsed.vin !== car.vin && cars.some((existing) => existing.vin === parsed.vin)) {
            console.warn(`[edit-car] A car with VIN ${parsed.vin} already exists.`);
            return;
          }
          const vinChanged = parsed.vin !== car.vin;
          updateCar(car.vin, parsed);
          // The detail screen below us on the stack is keyed by the old vin — replace it
          // instead of going back to it when the vin (its route param) has changed.
          if (vinChanged) {
            router.replace({ pathname: '/car/[carId]', params: { carId: parsed.vin } });
          } else {
            router.back();
          }
        }}
        submitLabel={t('carForm.saveCar')}
      />
    </Screen>
  );
}
