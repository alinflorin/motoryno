import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { useLearnOdometer } from '@/ble/useLearnOdometer';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { ObdConsole } from '@/components/ObdConsole';
import { ObdManualConfigForm } from '@/components/ObdManualConfigForm';
import { ObdSyncButton } from '@/components/ObdSyncButton';
import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { TextField } from '@/components/TextField';
import type { LearnProgress } from '@/obd';
import { formatObdLog } from '@/obd';
import { shareTextFile, useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';
import { notify } from '@/utils/confirm';
import { formatDateDMY } from '@/utils/date';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, distanceUnitFor, kmToDisplay } from '@/utils/units';

function learnStepLabelKey(step: LearnProgress['step']) {
  switch (step) {
    case 'connecting':
      return 'obdSetup.learnStepConnecting' as const;
    case 'known-candidates':
      return 'obdSetup.learnStepKnownCandidates' as const;
    case 'monitoring':
      return 'obdSetup.learnStepMonitoring' as const;
    case 'discovering':
      return 'obdSetup.learnStepDiscovering' as const;
    case 'sweeping':
      return 'obdSetup.learnStepSweeping' as const;
    case 'verifying':
      return 'obdSetup.learnStepVerifying' as const;
  }
}

/**
 * A saved car's OBD setup: the paired adapter, the learn-by-reference
 * odometer search, the manual overrides and the console. The overrides and
 * console are the same components the car form's setup sheet shows; the
 * learn flow lives only here because it needs the car's VIN/make persisted.
 */
export default function ObdSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, updateCar, setCarObd } = useStorage();
  const car = getCar(carId);
  const obd = car?.obd ?? null;
  const { colors, styles } = useStyles(getStyles);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  const vehicle = useMemo(() => ({ vin: car?.vin ?? null, make: car?.make ?? null }), [car?.vin, car?.make]);
  const learn = useLearnOdometer(obd, vehicle);
  const [referenceText, setReferenceText] = useState(() => (car ? String(Math.round(kmToDisplay(car.odometerKm, distanceUnit))) : ''));
  const referenceKm = /^\d+$/.test(referenceText.trim()) ? Math.round(displayToKm(Number(referenceText.trim()), distanceUnit)) : null;
  const [toolsBusy, setToolsBusy] = useState(false);

  const handleLearn = async () => {
    if (!car || !obd) return;
    if (referenceKm === null || referenceKm <= 0) {
      notify(t('obdSetup.learn'), t('obdSetup.learnNeedsOdometer'));
      return;
    }
    const outcome = await learn.start(referenceKm);
    if (!outcome) return;
    switch (outcome.status) {
      case 'found':
        if (obd.odometerSource?.manual) {
          // The user pinned a source by hand - report the find, but don't override their decision.
          updateCar(car.vin, { odometerKm: outcome.result.odometerKm });
          notify(
            t('obdSetup.learn'),
            t('obdSetup.learnSuccessKeptManual', { km: outcome.result.odometerKm, label: outcome.result.source.label })
          );
        } else {
          updateCar(car.vin, { odometerKm: outcome.result.odometerKm, obd: { ...obd, odometerSource: outcome.result.source } });
          notify(t('obdSetup.learn'), t('obdSetup.learnSuccess', { km: outcome.result.odometerKm }));
        }
        break;
      case 'not-found':
        notify(t('obdSetup.learn'), t('obdSetup.learnFailed'));
        break;
      case 'permission-denied':
        notify(t('common.error'), t('carForm.obdPermissionDenied'));
        break;
      case 'bluetooth-off':
        notify(t('common.error'), t('carForm.obdScanFailed'));
        break;
      case 'connection-failed':
        notify(t('common.error'), t('obdSetup.connectionFailed'));
        break;
    }
  };

  const shareLog = async () => {
    const fileName = `motoryno-obd-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    if (!(await shareTextFile(formatObdLog(), fileName, 'text/plain'))) notify(t('common.error'), t('carForm.obdShareLogUnavailable'));
  };

  if (!car) return null;

  const busy = learn.running || toolsBusy;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('obdSetup.title') }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenScrollView keyboardShouldPersistTaps="handled">
          <Card title={t('obdSetup.adapterTitle')}>
            {obd ? (
              <>
                <View>
                  <Text style={styles.deviceName}>{obd.deviceName}</Text>
                  <Text style={styles.faint}>{obd.deviceAddress}</Text>
                  <Text style={styles.faint}>
                    {obd.lastSyncedAt ? t('carForm.obdLastSynced', { date: formatDateDMY(obd.lastSyncedAt) }) : t('carForm.obdNeverSynced')}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <ObdSyncButton vin={car.vin} size="sm" />
                  <Button
                    label={t('obdSetup.changeAdapter')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => router.push({ pathname: '/car/[carId]/edit', params: { carId: car.vin } })}
                  />
                  <Button label={t('obdSetup.shareLog')} variant="ghost" size="sm" fullWidth={false} onPress={shareLog} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.hint}>{t('obdSetup.noAdapter')}</Text>
                <Button
                  label={t('obdSetup.pairAdapter')}
                  fullWidth={false}
                  onPress={() => router.push({ pathname: '/car/[carId]/edit', params: { carId: car.vin } })}
                />
              </>
            )}
          </Card>

          {obd && (
            <>
              <Card title={t('obdSetup.learnTitle')}>
                <Text style={styles.hint}>{t('obdSetup.learnHint')}</Text>
                <Text style={styles.status} numberOfLines={2}>
                  {obd.odometerSource
                    ? t(obd.odometerSource.manual ? 'obdSetup.sourceManual' : 'obdSetup.sourceKnown', { label: obd.odometerSource.label })
                    : t('obdSetup.sourceUnknown')}
                </Text>
                <FormField label={t('obdSetup.referenceOdometer')}>
                  <TextField
                    keyboardType="number-pad"
                    value={referenceText}
                    onChangeText={(text) => setReferenceText(sanitizeIntegerInput(text))}
                    suffix={t(`common.${distanceUnit}`)}
                    editable={!learn.running}
                  />
                </FormField>
                {learn.progress ? (
                  <View style={styles.progressRow}>
                    <ActivityIndicator size="small" color={colors.amber} />
                    <Text style={styles.progressText} numberOfLines={2}>
                      {t(learnStepLabelKey(learn.progress.step), {
                        detail: learn.progress.detail ?? '',
                        percent: Math.round((learn.progress.fraction ?? 0) * 100),
                      })}
                    </Text>
                    <Button label={t('obdSetup.learnCancel')} variant="ghost" size="sm" fullWidth={false} onPress={learn.cancel} />
                  </View>
                ) : (
                  <Button label={t('obdSetup.learn')} onPress={handleLearn} disabled={busy || referenceKm === null || referenceKm <= 0} />
                )}
              </Card>

              <ObdManualConfigForm
                config={obd}
                deviceAddress={obd.deviceAddress}
                disabled={learn.running}
                onBusyChange={setToolsBusy}
                onSave={(next) => {
                  setCarObd(car.vin, { ...obd, ...next });
                  notify(t('obdSetup.title'), t('obdSetup.saved'));
                }}
              />

              <ObdConsole
                deviceAddress={obd.deviceAddress}
                initCommands={obd.initCommands}
                disabled={learn.running}
                onBusyChange={setToolsBusy}
              />
            </>
          )}
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    deviceName: {
      color: colors.textPrimary,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    faint: {
      color: colors.textFaint,
      fontSize: fontSize.small,
      marginTop: 2,
    },
    hint: {
      color: colors.textFaint,
      fontSize: fontSize.small,
      lineHeight: 17,
    },
    status: {
      color: colors.textSecondary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.semibold,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    progressText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: fontSize.small,
    },
  });
}
