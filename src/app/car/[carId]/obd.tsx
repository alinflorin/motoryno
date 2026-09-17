import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldErrors, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import { useLearnOdometer } from '@/ble/useLearnOdometer';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { ObdSyncButton } from '@/components/ObdSyncButton';
import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import type { LearnProgress, ManualTestResult } from '@/obd';
import { formatObdLog, testOdometerSource, testVinSource } from '@/obd';
import {
  applyManualForm,
  buildOdometerSource,
  buildVinSource,
  isCanId,
  isHexBytes,
  manualFormFromObd,
  type ManualObdFormValues,
} from '@/obd/manualConfig';
import { shareTextFile, useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';
import { notify } from '@/utils/confirm';
import { formatDateDMY } from '@/utils/date';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, distanceUnitFor, kmToDisplay } from '@/utils/units';

/** How long to wait for a direct connect to the paired adapter before a test gives up. */
const TEST_CONNECT_TIMEOUT_MS = 15000;

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

function requestSchema(t: TFunction) {
  return z
    .object({
      enabled: z.boolean(),
      protocol: z.enum(['auto', 'can-11-500']),
      header: z.string(),
      receiveAddress: z.string(),
      session: z.string(),
      request: z.string(),
    })
    .superRefine((values, ctx) => {
      if (!values.enabled) return;
      if (!isHexBytes(values.request))
        ctx.addIssue({ path: ['request'], code: z.ZodIssueCode.custom, message: t('validation.invalidHex') });
      if (values.header.trim() && !isCanId(values.header))
        ctx.addIssue({ path: ['header'], code: z.ZodIssueCode.custom, message: t('validation.invalidCanId') });
      if (values.receiveAddress.trim() && !isCanId(values.receiveAddress)) {
        ctx.addIssue({ path: ['receiveAddress'], code: z.ZodIssueCode.custom, message: t('validation.invalidCanId') });
      }
      if (values.session.trim() && !isHexBytes(values.session))
        ctx.addIssue({ path: ['session'], code: z.ZodIssueCode.custom, message: t('validation.invalidHex') });
    });
}

function buildSchema(t: TFunction) {
  return z.object({
    initCommands: z.string(),
    vin: requestSchema(t),
    odometer: requestSchema(t)
      .and(
        z.object({
          offset: z.string(),
          length: z.string(),
          endian: z.enum(['be', 'le']),
          scale: z.string(),
        })
      )
      .superRefine((values, ctx) => {
        if (!values.enabled) return;
        const offset = Number(values.offset);
        const length = Number(values.length);
        const scale = Number(values.scale);
        if (!/^\d+$/.test(values.offset.trim()))
          ctx.addIssue({ path: ['offset'], code: z.ZodIssueCode.custom, message: t('validation.invalidOffset') });
        if (!Number.isInteger(length) || length < 2 || length > 4)
          ctx.addIssue({ path: ['length'], code: z.ZodIssueCode.custom, message: t('validation.invalidByteLength') });
        if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(offset))
          ctx.addIssue({ path: ['scale'], code: z.ZodIssueCode.custom, message: t('validation.invalidScale') });
      }),
  });
}

export default function ObdSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, updateCar, setCarObd } = useStorage();
  const car = getCar(carId);
  const obd = car?.obd ?? null;
  const { colors, styles } = useStyles(getStyles);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);

  // --- Find odometer ---
  const vehicle = useMemo(() => ({ vin: car?.vin ?? null, make: car?.make ?? null }), [car?.vin, car?.make]);
  const learn = useLearnOdometer(obd, vehicle);
  const [referenceText, setReferenceText] = useState(() => (car ? String(Math.round(kmToDisplay(car.odometerKm, distanceUnit))) : ''));
  const referenceKm = /^\d+$/.test(referenceText.trim()) ? Math.round(displayToKm(Number(referenceText.trim()), distanceUnit)) : null;

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
        updateCar(car.vin, { odometerKm: outcome.result.odometerKm, obd: { ...obd, odometerSource: outcome.result.source } });
        notify(t('obdSetup.learn'), t('obdSetup.learnSuccess', { km: outcome.result.odometerKm }));
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

  // --- Manual configuration form ---
  const schema = useMemo(() => buildSchema(t), [t]);
  const {
    control,
    handleSubmit,
    getValues,
    reset,
    trigger,
    formState: { errors, isDirty, isValid },
  } = useForm<ManualObdFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: obd ? manualFormFromObd(obd) : undefined,
  });
  const [vinEnabled, odometerEnabled] = useWatch({ control, name: ['vin.enabled', 'odometer.enabled'] });
  const [testing, setTesting] = useState<'vin' | 'odometer' | null>(null);
  const [testResults, setTestResults] = useState<{ vin?: ManualTestResult; odometer?: ManualTestResult }>({});

  const save = handleSubmit((values) => {
    if (!car || !obd) return;
    setCarObd(car.vin, applyManualForm(obd, values));
    reset(values);
    notify(t('obdSetup.title'), t('obdSetup.saved'));
  });

  const runTest = async (which: 'vin' | 'odometer') => {
    if (!obd) return;
    if (!(await trigger(which))) return;
    const manager = getBleManager();
    if (!manager) return;
    if (!(await requestBlePermissions())) {
      notify(t('common.error'), t('carForm.obdPermissionDenied'));
      return;
    }
    if (!(await waitForPoweredOn(manager))) {
      notify(t('common.error'), t('carForm.obdScanFailed'));
      return;
    }
    const values = getValues();
    const initCommands = applyManualForm(obd, values).initCommands;
    setTesting(which);
    try {
      const device = await manager.connectToDevice(obd.deviceAddress, { timeout: TEST_CONNECT_TIMEOUT_MS });
      const result =
        which === 'vin'
          ? await testVinSource(device, initCommands, buildVinSource({ ...values.vin, enabled: true })!)
          : await testOdometerSource(device, initCommands, buildOdometerSource({ ...values.odometer, enabled: true })!);
      setTestResults((prev) => ({ ...prev, [which]: result }));
      if (result.connectionFailed) notify(t('common.error'), t('obdSetup.connectionFailed'));
    } catch {
      notify(t('common.error'), t('obdSetup.connectionFailed'));
    } finally {
      setTesting(null);
    }
  };

  const shareLog = async () => {
    const fileName = `motoryno-obd-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    if (!(await shareTextFile(formatObdLog(), fileName, 'text/plain'))) notify(t('common.error'), t('carForm.obdShareLogUnavailable'));
  };

  if (!car) return null;

  const busy = learn.running || testing !== null;

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
                  {obd.odometerSource ? t('obdSetup.sourceKnown', { label: obd.odometerSource.label }) : t('obdSetup.sourceUnknown')}
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

              <Card title={t('obdSetup.manualTitle')}>
                <Text style={styles.hint}>{t('obdSetup.manualHint')}</Text>

                <FormField label={t('obdSetup.initCommands')}>
                  <Controller
                    control={control}
                    name="initCommands"
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextField
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder={t('obdSetup.initCommandsPlaceholder')}
                        multiline
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={styles.multiline}
                      />
                    )}
                  />
                  <Text style={styles.fieldHint}>{t('obdSetup.initCommandsHint')}</Text>
                </FormField>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{t('obdSetup.vinOverride')}</Text>
                  <Controller
                    control={control}
                    name="vin.enabled"
                    render={({ field: { value, onChange } }) => <ThemedSwitch value={value} onValueChange={onChange} />}
                  />
                </View>
                {vinEnabled && (
                  <>
                    <RequestFields control={control} errors={errors} prefix="vin" t={t} />
                    <TestRow
                      testing={testing === 'vin'}
                      disabled={busy}
                      onPress={() => runTest('vin')}
                      result={testResults.vin}
                      t={t}
                      styles={styles}
                      formatValue={(value) => String(value)}
                    />
                  </>
                )}

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{t('obdSetup.odometerOverride')}</Text>
                  <Controller
                    control={control}
                    name="odometer.enabled"
                    render={({ field: { value, onChange } }) => <ThemedSwitch value={value} onValueChange={onChange} />}
                  />
                </View>
                {odometerEnabled && (
                  <>
                    <RequestFields control={control} errors={errors} prefix="odometer" t={t} />
                    <FormField label={t('obdSetup.byteField')}>
                      <View style={styles.twoCol}>
                        <View style={styles.twoColItem}>
                          <Controller
                            control={control}
                            name="odometer.offset"
                            render={({ field: { value, onChange, onBlur } }) => (
                              <TextField
                                value={value}
                                onChangeText={(text) => onChange(sanitizeIntegerInput(text))}
                                onBlur={onBlur}
                                keyboardType="number-pad"
                                suffix={t('obdSetup.offset')}
                              />
                            )}
                          />
                        </View>
                        <View style={styles.twoColItem}>
                          <Controller
                            control={control}
                            name="odometer.length"
                            render={({ field: { value, onChange, onBlur } }) => (
                              <TextField
                                value={value}
                                onChangeText={(text) => onChange(sanitizeIntegerInput(text))}
                                onBlur={onBlur}
                                keyboardType="number-pad"
                                suffix={t('obdSetup.length')}
                              />
                            )}
                          />
                        </View>
                      </View>
                      <FieldError message={errors.odometer?.offset?.message ?? errors.odometer?.length?.message} styles={styles} />
                    </FormField>
                    <FormField label={t('obdSetup.endian')}>
                      <Controller
                        control={control}
                        name="odometer.endian"
                        render={({ field: { value, onChange } }) => (
                          <SegmentedControl
                            value={value}
                            onChange={onChange}
                            options={[
                              { value: 'be', label: t('obdSetup.endianBe') },
                              { value: 'le', label: t('obdSetup.endianLe') },
                            ]}
                          />
                        )}
                      />
                    </FormField>
                    <FormField label={t('obdSetup.scale')} error={errors.odometer?.scale?.message}>
                      <Controller
                        control={control}
                        name="odometer.scale"
                        render={({ field: { value, onChange, onBlur } }) => (
                          <TextField value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="1" />
                        )}
                      />
                      <Text style={styles.fieldHint}>{t('obdSetup.scaleHint')}</Text>
                    </FormField>
                    <TestRow
                      testing={testing === 'odometer'}
                      disabled={busy}
                      onPress={() => runTest('odometer')}
                      result={testResults.odometer}
                      t={t}
                      styles={styles}
                      formatValue={(value) => `${value} km`}
                    />
                  </>
                )}

                <Button label={t('obdSetup.save')} onPress={save} disabled={!isDirty || !isValid || busy} />
              </Card>
            </>
          )}
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldError({ message, styles }: { message: string | undefined; styles: ReturnType<typeof getStyles> }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

/** The addressing/request fields shared by the VIN and odometer overrides. */
function RequestFields({
  control,
  errors,
  prefix,
  t,
}: {
  control: Control<ManualObdFormValues>;
  errors: FieldErrors<ManualObdFormValues>;
  prefix: 'vin' | 'odometer';
  t: TFunction;
}) {
  const { styles } = useStyles(getStyles);
  const name = <K extends string>(field: K) => `${prefix}.${field}` as Path<ManualObdFormValues>;
  const sectionErrors = errors[prefix];

  return (
    <>
      <FormField label={t('obdSetup.protocol')}>
        <Controller
          control={control}
          name={name('protocol')}
          render={({ field: { value, onChange } }) => (
            <SegmentedControl
              value={value as 'auto' | 'can-11-500'}
              onChange={onChange}
              options={[
                { value: 'auto', label: t('obdSetup.protocolAuto') },
                { value: 'can-11-500', label: t('obdSetup.protocolCan') },
              ]}
            />
          )}
        />
      </FormField>
      <View style={styles.twoCol}>
        <View style={styles.twoColItem}>
          <FormField label={t('obdSetup.header')} error={sectionErrors?.header?.message}>
            <Controller
              control={control}
              name={name('header')}
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  value={String(value)}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={t('obdSetup.headerPlaceholder')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              )}
            />
          </FormField>
        </View>
        <View style={styles.twoColItem}>
          <FormField label={t('obdSetup.receiveAddress')} error={sectionErrors?.receiveAddress?.message}>
            <Controller
              control={control}
              name={name('receiveAddress')}
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  value={String(value)}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={t('obdSetup.receivePlaceholder')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              )}
            />
          </FormField>
        </View>
      </View>
      <FormField label={t('obdSetup.session')} error={sectionErrors?.session?.message}>
        <Controller
          control={control}
          name={name('session')}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              value={String(value)}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('obdSetup.sessionPlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          )}
        />
      </FormField>
      <FormField label={t('obdSetup.request')} error={sectionErrors?.request?.message}>
        <Controller
          control={control}
          name={name('request')}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              value={String(value)}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('obdSetup.requestPlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          )}
        />
      </FormField>
    </>
  );
}

function TestRow({
  testing,
  disabled,
  onPress,
  result,
  t,
  styles,
  formatValue,
}: {
  testing: boolean;
  disabled: boolean;
  onPress: () => void;
  result: ManualTestResult | undefined;
  t: TFunction;
  styles: ReturnType<typeof getStyles>;
  formatValue: (value: string | number) => string;
}) {
  return (
    <View style={styles.testBlock}>
      <Button
        label={testing ? t('obdSetup.testing') : t('obdSetup.test')}
        variant="accent"
        size="sm"
        fullWidth={false}
        loading={testing}
        disabled={disabled}
        onPress={onPress}
      />
      {result && !result.connectionFailed && (
        <View style={styles.testResult}>
          {result.payloadHex ? (
            <>
              <Text style={styles.mono}>{t('obdSetup.testReply', { payload: result.payloadHex })}</Text>
              <Text style={styles.testDecoded}>
                {result.value !== null ? t('obdSetup.testDecoded', { value: formatValue(result.value) }) : t('obdSetup.testNotDecoded')}
              </Text>
            </>
          ) : (
            <Text style={styles.testDecoded}>{t('obdSetup.testNoReply')}</Text>
          )}
        </View>
      )}
    </View>
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xs,
    },
    toggleLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    twoCol: {
      flexDirection: 'row',
      gap: spacing.sm + 2,
    },
    twoColItem: {
      flex: 1,
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    fieldHint: {
      color: colors.textFaint,
      fontSize: fontSize.caption,
      lineHeight: 15,
    },
    error: {
      color: colors.red,
      fontSize: fontSize.small,
      fontWeight: fontWeight.medium,
    },
    testBlock: {
      gap: spacing.sm,
    },
    testResult: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: spacing.md,
      gap: spacing.xs,
    },
    mono: {
      color: colors.textSecondary,
      fontSize: fontSize.small,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    testDecoded: {
      color: colors.textPrimary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
    },
  });
}
