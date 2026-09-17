import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useObdSyncNow } from '@/ble/useObdSyncNow';
import { Icon } from '@/components/Icon';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';

/**
 * "Sync odometer via OBD now" button, for one car (`vin`) or all paired cars.
 * Renders nothing on web (no BLE there) - callers only need to decide
 * whether an adapter is paired at all.
 */
export function ObdSyncButton({ vin }: { vin?: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useStyles(getStyles);
  const { syncing, syncNow } = useObdSyncNow(vin);

  if (Platform.OS === 'web') return null;

  const label = vin ? t('car.obdSyncNow') : t('home.obdSyncNow');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={syncing}
      onPress={syncNow}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {syncing ? (
        <>
          <ActivityIndicator size="small" color={colors.amber} />
          <Text style={styles.text}>{t('home.obdSyncing')}</Text>
        </>
      ) : (
        <>
          <Icon name="bluetooth-outline" size={16} color={colors.amber} />
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.amberBorder,
      borderRadius: 12,
      paddingVertical: 12,
    },
    buttonPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    text: {
      color: colors.amber,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
