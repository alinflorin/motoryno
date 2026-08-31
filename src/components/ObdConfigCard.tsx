import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import type { ScanStep, VehicleScanResult } from '@/obd';
import { scanVehicleInfo } from '@/obd';
import type { ObdConfig } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { notify } from '@/utils/confirm';
import { formatDateDMY } from '@/utils/date';

/** Stop scanning after this long even if nothing (more) was found. */
const SCAN_TIMEOUT_MS = 15000;

function scanStepLabelKey(step: ScanStep) {
  switch (step) {
    case 'connecting':
      return 'carForm.obdConnecting' as const;
    case 'reading-vin':
      return 'carForm.obdReadingVin' as const;
    case 'reading-odometer':
      return 'carForm.obdReadingOdometer' as const;
  }
}

/**
 * Card offering to scan for/pair a BLE OBD2 adapter, shown on the car form.
 * When `obd` is already persisted for the car, it's displayed instead of the
 * scan prompt, with a button to pair a different adapter. Tapping scan lists
 * nearby BLE devices right in the card — tapping one pairs it, then the
 * adapter is briefly connected to read the VIN/make/model/year/odometer,
 * reported back via `onScanResult` for the form to prefill.
 * BLE isn't available on web, so this renders nothing there.
 */
export function ObdConfigCard({
  obd,
  onObdChange,
  onScanResult,
}: {
  obd: ObdConfig | null;
  onObdChange: (obd: ObdConfig) => void;
  /** Called with whatever the post-pairing vehicle scan found (fields not read come back null). */
  onScanResult: (result: VehicleScanResult) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [scanning, setScanning] = useState(false);
  // Set once a scan stops on its own (timeout or error) rather than because the
  // user picked a device or cancelled - keeps `devices` on screen instead of
  // wiping them, and switches the scan area to a "retry" affordance.
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [readingStep, setReadingStep] = useState<ScanStep | null>(null);
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

    // On iOS the permission prompt (triggered by creating the manager) and
    // the adapter powering on both happen asynchronously in native code -
    // wait for that to settle before scanning, or the first-ever scan fails
    // immediately even though the user is about to grant access.
    const poweredOn = await waitForPoweredOn(manager);
    if (!poweredOn) {
      notify(t('common.error'), t('carForm.obdScanFailed'));
      return;
    }

    setDevices([]);
    setScanTimedOut(false);
    setScanning(true);
    // allowDuplicates: true - with `false`, react-native-ble-plx (particularly on
    // Android) suppresses devices it has already reported once for the lifetime of
    // the manager, not just within a single scan call. That means a device picked
    // in an earlier scan (or any other already-seen peripheral) silently stops being
    // reported on a later "Change device" scan, leaving the list empty. Dedup is
    // already done in JS below (`setDevices` checks `existing.id`), so ask the
    // native side to keep reporting everything and let that handle duplicates.
    manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        stopScan();
        setScanTimedOut(true);
        notify(t('common.error'), t('carForm.obdScanFailed'));
        return;
      }
      if (!device?.name) return;
      setDevices((prev) => (prev.some((existing) => existing.id === device.id) ? prev : [...prev, device]));
    });

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
      setScanTimedOut(true);
    }, SCAN_TIMEOUT_MS);
  }, [stopScan, t]);

  const selectDevice = useCallback(
    async (device: Device) => {
      stopScan();
      setScanTimedOut(false);
      setDevices([]);
      onObdChange({ deviceName: device.name ?? device.id, deviceAddress: device.id, lastSyncedAt: null });

      try {
        const result = await scanVehicleInfo(device, setReadingStep);
        if (result.connectionFailed) {
          notify(t('common.error'), t('carForm.obdScanInfoFailed'));
        }
        onScanResult(result);
      } finally {
        setReadingStep(null);
      }
    },
    [stopScan, onObdChange, onScanResult, t]
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
        {readingStep ? (
          <View style={styles.obdDeviceInfo}>
            <Text style={styles.obdSubtitle}>{t(scanStepLabelKey(readingStep))}</Text>
          </View>
        ) : obd ? (
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
          disabled={!!readingStep}
        >
          {readingStep ? (
            <ActivityIndicator size="small" color={colors.onAmber} />
          ) : scanning ? (
            <View style={styles.scanButtonRow}>
              <ActivityIndicator size="small" color={colors.onAmber} />
              <Text style={styles.scanButtonText}>{t('carForm.obdStop')}</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>{obd ? t('carForm.change') : t('carForm.scan')}</Text>
          )}
        </Pressable>
      </View>

      {(scanning || scanTimedOut) && (
        <View style={styles.scanList}>
          {scanning && devices.length === 0 && (
            <Text style={styles.scanEmpty}>{t('carForm.obdScanning')}</Text>
          )}
          {scanTimedOut && devices.length === 0 && (
            <Text style={styles.scanEmpty}>{t('carForm.obdScanNoneFound')}</Text>
          )}
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
    scanButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
