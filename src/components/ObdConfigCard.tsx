import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { ScanStep, VehicleScanResult } from '@/obd';
import { scanVehicleInfo } from '@/obd';
import type { ObdConfig } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';
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
 *
 * Everything beyond pairing (finding the odometer, manual request
 * configuration, the log) lives on the OBD setup screen, linked from here
 * once the car exists (`carId`). BLE isn't available on web, so this
 * renders nothing there.
 */
export function ObdConfigCard({
  obd,
  onObdChange,
  onScanResult,
  carId,
}: {
  obd: ObdConfig | null;
  onObdChange: (obd: ObdConfig) => void;
  /** Called with whatever the post-pairing vehicle scan found (fields not read come back null). */
  onScanResult: (result: VehicleScanResult) => void;
  /** The persisted car's VIN, when editing an existing car - enables the link to its OBD setup screen. */
  carId?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, styles } = useStyles(getStyles);

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
      // A new adapter keeps the car's custom init commands (they're about the car as much as
      // the dongle) but drops learned/manual request sources that may have been adapter-specific.
      const paired: ObdConfig = {
        deviceName: device.name ?? device.id,
        deviceAddress: device.id,
        lastSyncedAt: null,
        initCommands: obd?.initCommands ?? [],
        vinSource: obd?.vinSource ?? null,
        odometerSource: null,
      };
      onObdChange(paired);

      try {
        const result = await scanVehicleInfo(device, paired, setReadingStep);
        if (result.connectionFailed) {
          notify(t('common.error'), t('carForm.obdScanInfoFailed'));
        }
        if (result.odometerSource) onObdChange({ ...paired, odometerSource: result.odometerSource });
        onScanResult(result);
      } finally {
        setReadingStep(null);
      }
    },
    [stopScan, obd, onObdChange, onScanResult, t]
  );

  if (Platform.OS === 'web') {
    return null;
  }

  const scanButton = readingStep ? (
    <ActivityIndicator size="small" color={colors.amber} />
  ) : (
    <Button
      label={scanning ? t('carForm.obdStop') : obd ? t('carForm.change') : t('carForm.scan')}
      variant={scanning ? 'secondary' : 'primary'}
      size="sm"
      fullWidth={false}
      loading={false}
      onPress={scanning ? stopScan : startScan}
    />
  );

  return (
    <Card title={t('carForm.obdTitle')} right={scanButton} padded={false}>
      <View style={styles.body}>
        {readingStep ? (
          <Text style={styles.subtitle}>{t(scanStepLabelKey(readingStep))}</Text>
        ) : obd ? (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{obd.deviceName}</Text>
            <Text style={styles.subtitle}>
              {obd.lastSyncedAt ? t('carForm.obdLastSynced', { date: formatDateDMY(obd.lastSyncedAt) }) : t('carForm.obdNeverSynced')}
            </Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>{t('carForm.obdSubtitle')}</Text>
        )}
        {obd && !readingStep && !scanning && (
          <View style={styles.setupRow}>
            {carId ? (
              <Button
                label={t('carForm.obdSetupLink')}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => router.push({ pathname: '/car/[carId]/obd', params: { carId } })}
              />
            ) : (
              <Text style={styles.hint}>{t('carForm.obdSetupHint')}</Text>
            )}
          </View>
        )}
      </View>

      {(scanning || scanTimedOut) && (
        <View style={styles.scanList}>
          {scanning && devices.length === 0 && <Text style={styles.scanEmpty}>{t('carForm.obdScanning')}</Text>}
          {scanTimedOut && devices.length === 0 && <Text style={styles.scanEmpty}>{t('carForm.obdScanNoneFound')}</Text>}
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
    </Card>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    body: {
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    deviceInfo: {
      gap: 2,
    },
    deviceName: {
      color: colors.textPrimary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
    },
    subtitle: {
      color: colors.textFaint,
      fontSize: fontSize.small,
    },
    setupRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    hint: {
      color: colors.textFainter,
      fontSize: fontSize.caption,
      lineHeight: 15,
    },
    scanList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    scanEmpty: {
      color: colors.textFaint,
      fontSize: fontSize.small,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
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
    deviceAddress: {
      color: colors.textFaint,
      fontSize: fontSize.caption,
    },
  });
}
