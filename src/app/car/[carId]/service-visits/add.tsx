import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { ServiceVisitForm } from '@/components/ServiceVisitForm';
import { useStorage } from '@/storage';
import { distanceUnitFor } from '@/utils/units';

export default function AddServiceVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, addServiceVisit, setCarOdometer } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addServiceVisit.title') }} />
      <ServiceVisitForm
        car={car}
        distanceUnit={distanceUnit}
        currency={settings.currency}
        useUnknownServiceStatus={settings.useUnknownServiceStatus}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(parsed) => {
          if (!car) return;
          addServiceVisit(car.vin, parsed);
          if (parsed.odometerKm > car.odometerKm) {
            setCarOdometer(car.vin, parsed.odometerKm);
          }
          router.back();
        }}
        submitLabel={t('addServiceVisit.saveVisit')}
      />
    </Screen>
  );
}
