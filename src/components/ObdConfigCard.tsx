import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import type { LearnProgress, ScanStep, VehicleScanResult } from '@/obd';
import { formatObdLog, getObdLog, learnOdometerSource, scanVehicleInfo } from '@/obd';
import type { ObdConfig } from '@/storage';
import { shareTextFile } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';
import { notify } from '@/utils/confirm';
import { formatDateDMY } from '@/utils/date';

/** Stop scanning after this long even if nothing (more) was found. */
const SCAN_TIMEOUT_MS = 15000;
/** How long to wait for a direct connect to an already-paired adapter before giving up on a learn. */
const LEARN_CONNECT_TIMEOUT_MS = 15000;

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

function learnStepLabelKey(step: LearnProgress['step']) {
  switch (step) {
    case 'connecting':
      return 'carForm.obdLearnStepConnecting' as const;
    case 'known-candidates':
      return 'carForm.obdLearnStepKnownCandidates' as const;
    case 'monitoring':
      return 'carForm.obdLearnStepMonitoring' as const;
    case 'discovering':
      return 'carForm.obdLearnStepDiscovering' as const;
    case 'sweeping':
      return 'carForm.obdLearnStepSweeping' as const;
    case 'verifying':
      return 'carForm.obdLearnStepVerifying' as const;
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
 * Once paired, the card also offers "Find odometer" (see
 * `src/obd/odometer/learn.ts`): with the dashboard reading typed into the
 * form as a reference, it discovers where this car keeps its odometer and
 * stores that on the `ObdConfig` so silent syncs can read it directly.
 *
 * BLE isn't available on web, so this renders nothing there.
 */
export function ObdConfigCard({
  obd,
  onObdChange,
  onScanResult,
  referenceOdometerKm,
  vehicle,
}: {
  obd: ObdConfig | null;
  onObdChange: (obd: ObdConfig) => void;
  /** Called with whatever the post-pairing vehicle scan found (fields not read come back null). */
  onScanResult: (result: VehicleScanResult) => void;
  /** The odometer currently typed into the form, in km - the reference value the learn flow searches for. Null if empty/invalid. */
  referenceOdometerKm: number | null;
  /** What's currently in the form's VIN/make fields, to pick the right make-specific strategy. */
  vehicle: { vin: string | null; make: string | null };
}) {
  const { t } = useTranslation();
  const { colors, styles } = useStyles(getStyles);

  const [scanning, setScanning] = useState(false);
  // Set once a scan stops on its own (timeout or error) rather than because the
  // user picked a device or cancelled - keeps `devices` on screen instead of
  // wiping them, and switches the scan area to a "retry" affordance.
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [readingStep, setReadingStep] = useState<ScanStep | null>(null);
  const [learnProgress, setLearnProgress] = useState<LearnProgress | null>(null);
  const [hasLog, setHasLog] = useState(() => getObdLog().length > 0);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const learnAbortRef = useRef<AbortController | null>(null);

  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    getBleManager()?.stopDeviceScan();
    setScanning(false);
  }, []);

  // Stop any in-flight scan/learn when the card leaves the screen.
  useEffect(
    () => () => {
      stopScan();
      learnAbortRef.current?.abort();
    },
    [stopScan]
  );

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
      const paired: ObdConfig = {
        deviceName: device.name ?? device.id,
        deviceAddress: device.id,
        lastSyncedAt: null,
        odometerSource: null,
      };
      onObdChange(paired);

      try {
        const result = await scanVehicleInfo(device, setReadingStep);
        if (result.connectionFailed) {
          notify(t('common.error'), t('carForm.obdScanInfoFailed'));
        }
        if (result.odometerSource) onObdChange({ ...paired, odometerSource: result.odometerSource });
        onScanResult(result);
      } finally {
        setReadingStep(null);
        setHasLog(getObdLog().length > 0);
      }
    },
    [stopScan, onObdChange, onScanResult, t]
  );

  const startLearn = useCallback(async () => {
    const manager = getBleManager();
    if (!manager || !obd) return;
    if (referenceOdometerKm === null || referenceOdometerKm <= 0) {
      notify(t('carForm.obdLearn'), t('carForm.obdLearnNeedsOdometer'));
      return;
    }

    const granted = await requestBlePermissions();
    if (!granted) {
      notify(t('common.error'), t('carForm.obdPermissionDenied'));
      return;
    }
    if (!(await waitForPoweredOn(manager))) {
      notify(t('common.error'), t('carForm.obdScanFailed'));
      return;
    }

    const abort = new AbortController();
    learnAbortRef.current = abort;
    setLearnProgress({ step: 'connecting' });
    try {
      const device = await manager.connectToDevice(obd.deviceAddress, { timeout: LEARN_CONNECT_TIMEOUT_MS });
      const result = await learnOdometerSource(device, vehicle, referenceOdometerKm, {
        signal: abort.signal,
        onProgress: (progress) => {
          if (!abort.signal.aborted) setLearnProgress(progress);
        },
      });
      if (abort.signal.aborted) return;
      if (result) {
        onObdChange({ ...obd, odometerSource: result.source });
        notify(t('carForm.obdLearn'), t('carForm.obdLearnSuccess', { km: result.odometerKm }));
      } else {
        notify(t('carForm.obdLearn'), t('carForm.obdLearnFailed'));
      }
    } catch {
      if (!abort.signal.aborted) notify(t('common.error'), t('carForm.obdLearnConnectionFailed'));
    } finally {
      learnAbortRef.current = null;
      setLearnProgress(null);
      setHasLog(getObdLog().length > 0);
    }
  }, [obd, referenceOdometerKm, vehicle, onObdChange, t]);

  const cancelLearn = useCallback(() => {
    learnAbortRef.current?.abort();
    setLearnProgress(null);
  }, []);

  const shareLog = useCallback(async () => {
    const fileName = `motoryno-obd-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    const shared = await shareTextFile(formatObdLog(), fileName, 'text/plain');
    if (!shared) notify(t('common.error'), t('carForm.obdShareLogUnavailable'));
  }, [t]);

  if (Platform.OS === 'web') {
    return null;
  }

  const busy = readingStep !== null || learnProgress !== null;
  const canLearn = obd !== null && referenceOdometerKm !== null && referenceOdometerKm > 0;

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
          disabled={busy}
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

      {obd && !scanning && !readingStep && (
        <View style={styles.learnSection}>
          {learnProgress ? (
            <View style={styles.learnRow}>
              <ActivityIndicator size="small" color={colors.amber} />
              <Text style={styles.learnProgressText} numberOfLines={2}>
                {t(learnStepLabelKey(learnProgress.step), {
                  detail: learnProgress.detail ?? '',
                  percent: Math.round((learnProgress.fraction ?? 0) * 100),
                })}
              </Text>
              <Pressable onPress={cancelLearn} hitSlop={8}>
                <Text style={styles.learnLink}>{t('carForm.obdLearnCancel')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.learnStatus} numberOfLines={2}>
                {obd.odometerSource ? t('carForm.obdLearnKnown', { label: obd.odometerSource.label }) : t('carForm.obdLearnUnknown')}
              </Text>
              <Text style={styles.learnHint}>{t('carForm.obdLearnHint')}</Text>
              <View style={styles.learnRow}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.learnButton,
                    !canLearn && styles.learnButtonDisabled,
                    pressed && styles.scanButtonPressed,
                  ]}
                  onPress={startLearn}
                  disabled={!canLearn}
                >
                  <Text style={styles.learnButtonText}>{t('carForm.obdLearn')}</Text>
                </Pressable>
                {hasLog && (
                  <Pressable onPress={shareLog} hitSlop={8}>
                    <Text style={styles.learnLink}>{t('carForm.obdShareLog')}</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
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
    learnSection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    learnStatus: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    learnHint: {
      color: colors.textFaint,
      fontSize: 12,
      lineHeight: 17,
    },
    learnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    learnProgressText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
    },
    learnButton: {
      borderWidth: 1,
      borderColor: colors.amberBorder,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    learnButtonDisabled: {
      opacity: 0.5,
    },
    learnButtonText: {
      color: colors.amber,
      fontSize: 12,
      fontWeight: '700',
    },
    learnLink: {
      color: colors.amber,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
