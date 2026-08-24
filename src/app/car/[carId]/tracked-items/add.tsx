import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { TrackedItemForm } from '@/components/TrackedItemForm';
import { useStorage } from '@/storage';
import { distanceUnitFor } from '@/utils/units';

export default function AddTrackedItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, addTrackedServiceItem } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  // `car` comes from a ref-backed lookup (not render state), so it isn't a safe useMemo
  // dependency — the list (cheap to build) is simply recomputed on every render instead.
  const existingNames = car?.trackedServiceItems.map((item) => item.name.trim().toLowerCase()) ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addTrackedItem.title') }} />
      <TrackedItemForm
        distanceUnit={distanceUnit}
        existingNames={existingNames}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(parsed) => {
          if (!car) return;
          addTrackedServiceItem(carId, { ...parsed, isActive: true });
          router.back();
        }}
        submitLabel={t('addTrackedItem.addItem')}
      />
    </Screen>
  );
}
