import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { getBleManager } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import type { ObdConfig } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { notify } from '@/utils/confirm';
import { formatDateDMY } from '@/utils/date';

/** Stop scanning after this long even if nothing (more) was found. */
const SCAN_TIMEOUT_MS = 15000;

/**
 * Card offering to scan for/pair a BLE OBD2 adapter, shown on the car form.
 * When `obd` is already persisted for the car, it's displayed instead of the
 * scan prompt, with a button to pair a different adapter. Tapping scan lists
 * nearby BLE devices right in the card — tapping one pairs it.
 * BLE isn't available on web, so this renders nothing there.
 */
export function ObdConfigCard({ obd, onObdChange }: { obd: ObdConfig | null; onObdChange: (obd: ObdConfig) => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    getBleManager()?.stopDeviceScan();
    setScanning(false);
  }, []);

  // Stop any in-flight scan when the card leaves the screen.
  useEffect(() => stopScan, [stopScan]);

  const startScan = useCallback(async () => {
    const manager = getBleManager();
    if (!manager) return;

    const granted = await requestBlePermissions();
    if (!granted) {
      notify(t('common.error'), t('carForm.obdPermissionDenied'));
      return;
    }

    setDevices([]);
    setScanning(true);
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        stopScan();
        notify(t('common.error'), t('carForm.obdScanFailed'));
        return;
      }
      if (!device?.name) return;
      setDevices((prev) => (prev.some((existing) => existing.id === device.id) ? prev : [...prev, device]));
    });

    scanTimeoutRef.current = setTimeout(stopScan, SCAN_TIMEOUT_MS);
  }, [stopScan, t]);

  const selectDevice = useCallback(
    (device: Device) => {
      stopScan();
      onObdChange({ deviceName: device.name ?? device.id, deviceAddress: device.id, lastSyncedAt: null });
      setDevices([]);
    },
    [stopScan, onObdChange]
  );

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.obdCard}>
      <View style={styles.obdHeader}>
        <Text style={styles.obdTitle}>{t('carForm.obdTitle')}</Text>
      </View>
      <View style={styles.obdBody}>
        {obd ? (
          <View style={styles.obdDeviceInfo}>
            <Text style={styles.obdDeviceName}>{obd.deviceName}</Text>
            <Text style={styles.obdSubtitle}>
              {obd.lastSyncedAt ? t('carForm.obdLastSynced', { date: formatDateDMY(obd.lastSyncedAt) }) : t('carForm.obdNeverSynced')}
            </Text>
          </View>
        ) : (
          <Text style={styles.obdSubtitle}>{t('carForm.obdSubtitle')}</Text>
        )}
        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          onPress={scanning ? stopScan : startScan}
        >
          {scanning ? (
            <ActivityIndicator size="small" color={colors.onAmber} />
          ) : (
            <Text style={styles.scanButtonText}>{obd ? t('carForm.change') : t('carForm.scan')}</Text>
          )}
        </Pressable>
      </View>

      {scanning && (
        <View style={styles.scanList}>
          {devices.length === 0 && <Text style={styles.scanEmpty}>{t('carForm.obdScanning')}</Text>}
          {devices.map((device) => (
            <Pressable
              key={device.id}
              style={({ pressed }) => [styles.deviceRow, pressed && styles.deviceRowPressed]}
              onPress={() => selectDevice(device)}
            >
              <Text style={styles.deviceName} numberOfLines={1}>
                {device.name}
              </Text>
              <Text style={styles.deviceAddress} numberOfLines={1}>
                {device.id}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    obdCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      overflow: 'hidden',
    },
    obdHeader: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    obdTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    obdBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    obdDeviceInfo: {
      flex: 1,
      paddingRight: 12,
      gap: 2,
    },
    obdDeviceName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    obdSubtitle: {
      color: colors.textFaint,
      fontSize: 12,
      flex: 1,
      paddingRight: 12,
    },
    scanButton: {
      backgroundColor: colors.amber,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      minWidth: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanButtonPressed: {
      opacity: 0.85,
    },
    scanButtonText: {
      color: colors.onAmber,
      fontSize: 12,
      fontWeight: '700',
    },
    scanList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    scanEmpty: {
      color: colors.textFaint,
      fontSize: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    deviceRow: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    deviceRowPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    deviceName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    deviceAddress: {
      color: colors.textFaint,
      fontSize: 11,
    },
  });
}
