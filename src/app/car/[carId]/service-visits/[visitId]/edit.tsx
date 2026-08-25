import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Screen } from '@/components/Screen';
import { ServiceVisitForm } from '@/components/ServiceVisitForm';
import { useStorage } from '@/storage';
import { useThemeColors } from '@/theme/ThemeContext';
import { confirmAsync } from '@/utils/confirm';
import { distanceUnitFor } from '@/utils/units';

export default function EditServiceVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId, visitId } = useLocalSearchParams<{ carId: string; visitId: string }>();
  const { settings, getCar, updateServiceVisit, removeServiceVisit, setCarOdometer } = useStorage();
  const car = getCar(carId);
  const visit = car?.serviceVisits.find((existing) => existing.uuid === visitId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const colors = useThemeColors();

  const confirmDelete = async () => {
    if (!car || !visit) return;
    const confirmed = await confirmAsync(
      t('editServiceVisit.deleteVisit'),
      t('editServiceVisit.deleteVisitConfirm', { shop: visit.shopName }),
      t('common.delete'),
      t('common.cancel')
    );
    if (confirmed) {
      removeServiceVisit(car.vin, visit.uuid);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('editServiceVisit.title'),
          headerRight: () => <HeaderIconButton name="trash-outline" size={18} color={colors.red} onPress={confirmDelete} />,
        }}
      />
      <ServiceVisitForm
        visit={visit}
        car={car}
        distanceUnit={distanceUnit}
        currency={settings.currency}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(parsed) => {
          if (!car || !visit) return;
          updateServiceVisit(car.vin, visit.uuid, parsed);
          if (parsed.odometerKm > car.odometerKm) {
            setCarOdometer(car.vin, parsed.odometerKm);
          }
          router.back();
        }}
        submitLabel={t('editServiceVisit.saveVisit')}
      />
    </Screen>
  );
}
