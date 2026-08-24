import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TrackedItemForm } from '@/components/TrackedItemForm';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { confirmAsync } from '@/utils/confirm';
import { distanceUnitFor } from '@/utils/units';

export default function EditTrackedItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId, itemName } = useLocalSearchParams<{ carId: string; itemName: string }>();
  const { settings, getCar, updateTrackedServiceItem, removeTrackedServiceItem } = useStorage();
  const car = getCar(carId);
  const item = car?.trackedServiceItems.find((existing) => existing.name === itemName);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const existingNames =
    car?.trackedServiceItems
      .filter((existing) => existing.name !== itemName)
      .map((existing) => existing.name.trim().toLowerCase()) ?? [];

  const confirmDelete = async () => {
    if (!car || !item) return;
    const confirmed = await confirmAsync(
      t('editTrackedItem.deleteItem'),
      t('editTrackedItem.deleteItemConfirm', { item: item.name }),
      t('common.delete'),
      t('common.cancel')
    );
    if (confirmed) {
      removeTrackedServiceItem(car.vin, item.name);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('editTrackedItem.title'),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <Pressable hitSlop={8} onPress={confirmDelete}>
                <Icon name="trash-outline" size={18} color={colors.red} />
              </Pressable>
            </View>
          ),
        }}
      />
      <TrackedItemForm
        item={item}
        distanceUnit={distanceUnit}
        existingNames={existingNames}
        insetBottom={insets.bottom}
        onCancel={() => router.back()}
        onSubmit={(parsed) => {
          if (!car || !item) return;
          updateTrackedServiceItem(car.vin, item.name, parsed);
          router.back();
        }}
        submitLabel={t('editTrackedItem.saveItem')}
      />
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    headerRightContainer: {
      paddingRight: 16,
    },
  });
}
