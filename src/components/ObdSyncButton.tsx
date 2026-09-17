import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useObdSyncNow } from '@/ble/useObdSyncNow';
import { Button, type ButtonSize } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/theme/ThemeContext';

/**
 * "Sync odometer via OBD now" button, for one car (`vin`) or all paired cars.
 * Renders nothing on web (no BLE there) - callers only need to decide
 * whether an adapter is paired at all.
 */
export function ObdSyncButton({ vin, size = 'md' }: { vin?: string; size?: ButtonSize }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { syncing, syncNow } = useObdSyncNow(vin);

  if (Platform.OS === 'web') return null;

  return (
    <Button
      label={syncing ? t('home.obdSyncing') : vin ? t('car.obdSyncNow') : t('home.obdSyncNow')}
      variant="accent"
      size={size}
      fullWidth={size === 'md'}
      loading={syncing}
      icon={<Icon name="bluetooth-outline" size={16} color={colors.amber} />}
      onPress={syncNow}
    />
  );
}
