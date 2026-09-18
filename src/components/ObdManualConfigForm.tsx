import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldErrors, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { connectPairedAdapter } from '@/ble/connectPairedAdapter';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips, type ChoiceChip } from '@/components/ChoiceChips';
import { FormField } from '@/components/FormField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import type { BusProtocol, ManualTestResult, ObdReadConfig } from '@/obd';
import { BUS_PROTOCOLS, testOdometerSource, testVinSource } from '@/obd';
import {
  applyManualForm,
  buildOdometerSource,
  buildVinSource,
  isCanId,
  isHexBytes,
  isHexLines,
  manualFormFromObd,
  type ManualObdFormValues,
  type ProtocolChoice,
} from '@/obd/manualConfig';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';
import { notify } from '@/utils/confirm';
import { sanitizeIntegerInput } from '@/utils/numericInput';

const PROTOCOL_LABEL_KEYS = {
  'can-11-500': 'obdSetup.protocolCan11500',
  'can-29-500': 'obdSetup.protocolCan29500',
  'can-11-250': 'obdSetup.protocolCan11250',
  'can-29-250': 'obdSetup.protocolCan29250',
  'kwp-fast': 'obdSetup.protocolKwpFast',
  'kwp-5baud': 'obdSetup.protocolKwp5Baud',
  iso9141: 'obdSetup.protocolIso9141',
  'j1850-pwm': 'obdSetup.protocolPwm',
  'j1850-vpw': 'obdSetup.protocolVpw',
} as const satisfies Record<BusProtocol, string>;

const PROTOCOL_CHOICES = ['auto', ...BUS_PROTOCOLS] as [ProtocolChoice, ...ProtocolChoice[]];

function requestSchema(t: TFunction) {
  return z.object({
    enabled: z.boolean(),
    protocol: z.enum(PROTOCOL_CHOICES),
    header: z.string(),
    receiveAddress: z.string(),
    atCommands: z.string(),
    session: z.string(),
    setup: z.string(),
    request: z.string(),
  });
}

/** Validates the addressing/request fields of one override; `path` prefixes the issue paths. */
function checkRequest(values: z.infer<ReturnType<typeof requestSchema>>, ctx: z.RefinementCtx, t: TFunction, requireRequest: boolean) {
  if (requireRequest && !isHexBytes(values.request))
    ctx.addIssue({ path: ['request'], code: z.ZodIssueCode.custom, message: t('validation.invalidHex') });
  if (values.header.trim() && !isCanId(values.header))
    ctx.addIssue({ path: ['header'], code: z.ZodIssueCode.custom, message: t('validation.invalidCanId') });
  if (values.receiveAddress.trim() && !isCanId(values.receiveAddress))
    ctx.addIssue({ path: ['receiveAddress'], code: z.ZodIssueCode.custom, message: t('validation.invalidCanId') });
  if (values.session.trim() && !isHexBytes(values.session))
    ctx.addIssue({ path: ['session'], code: z.ZodIssueCode.custom, message: t('validation.invalidHex') });
  if (!isHexLines(values.setup)) ctx.addIssue({ path: ['setup'], code: z.ZodIssueCode.custom, message: t('validation.invalidHexLines') });
}

function buildSchema(t: TFunction) {
  return z.object({
    initCommands: z.string(),
    vin: requestSchema(t).superRefine((values, ctx) => {
      if (values.enabled) checkRequest(values, ctx, t, true);
    }),
    odometer: requestSchema(t)
      .and(
        z.object({
          mode: z.enum(['request', 'broadcast']),
          canId: z.string(),
          offset: z.string(),
          length: z.string(),
          endian: z.enum(['be', 'le']),
          encoding: z.enum(['uint', 'bcd']),
          scale: z.string(),
          add: z.string(),
          unit: z.enum(['km', 'mi']),
        })
      )
      .superRefine((values, ctx) => {
        if (!values.enabled) return;
        if (values.mode === 'request') checkRequest(values, ctx, t, true);
        else if (!isCanId(values.canId))
          ctx.addIssue({ path: ['canId'], code: z.ZodIssueCode.custom, message: t('validation.invalidCanId') });
        const offset = Number(values.offset);
        const length = Number(values.length);
        const scale = Number(values.scale);
        if (!/^\d+$/.test(values.offset.trim()) || !Number.isFinite(offset))
          ctx.addIssue({ path: ['offset'], code: z.ZodIssueCode.custom, message: t('validation.invalidOffset') });
        if (!Number.isInteger(length) || length < 2 || length > 4)
          ctx.addIssue({ path: ['length'], code: z.ZodIssueCode.custom, message: t('validation.invalidByteLength') });
        if (!Number.isFinite(scale) || scale <= 0)
          ctx.addIssue({ path: ['scale'], code: z.ZodIssueCode.custom, message: t('validation.invalidScale') });
        if (values.add.trim() && !Number.isFinite(Number(values.add)))
          ctx.addIssue({ path: ['add'], code: z.ZodIssueCode.custom, message: t('validation.invalidNumber') });
      }),
  });
}

/**
 * The hand-configuration form for an adapter: extra init commands, a custom
 * VIN request and a custom odometer request (or broadcast frame), each with
 * the full addressing, setup sequence and byte-field decoding, and a Test
 * button that runs it live against the car. Used both on the OBD setup
 * screen of a saved car and in the car form's setup sheet (where the config
 * is still a draft and may not even have an adapter paired yet).
 */
export function ObdManualConfigForm({
  config,
  deviceAddress,
  onSave,
  disabled = false,
  onBusyChange,
}: {
  config: ObdReadConfig;
  /** The paired adapter to test against; null disables the Test buttons. */
  deviceAddress: string | null;
  onSave: (next: ObdReadConfig) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useStyles(getStyles);
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
    defaultValues: manualFormFromObd(config),
  });
  const [vinEnabled, odometerEnabled, odometerMode] = useWatch({ control, name: ['vin.enabled', 'odometer.enabled', 'odometer.mode'] });
  const [testing, setTesting] = useState<'vin' | 'odometer' | null>(null);
  const [testResults, setTestResults] = useState<{ vin?: ManualTestResult; odometer?: ManualTestResult }>({});

  // The config can change underneath the form (the learn flow found a source, a new adapter was
  // paired) - re-seed then, but never over the user's unsaved edits.
  useEffect(() => {
    if (!isDirty) reset(manualFormFromObd(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => onBusyChange?.(testing !== null), [testing, onBusyChange]);

  const save = handleSubmit((values) => {
    onSave(applyManualForm(config, values));
    reset(values);
  });

  const runTest = async (which: 'vin' | 'odometer') => {
    if (!deviceAddress) return;
    if (!(await trigger(which))) return;
    setTesting(which);
    try {
      const connection = await connectPairedAdapter(deviceAddress);
      if ('error' in connection) {
        if (connection.error === 'permission-denied') notify(t('common.error'), t('carForm.obdPermissionDenied'));
        else if (connection.error === 'bluetooth-off') notify(t('common.error'), t('carForm.obdScanFailed'));
        else if (connection.error === 'connection-failed') notify(t('common.error'), t('obdSetup.connectionFailed'));
        return;
      }
      const values = getValues();
      const initCommands = applyManualForm(config, values).initCommands;
      const result =
        which === 'vin'
          ? await testVinSource(connection.device, initCommands, buildVinSource({ ...values.vin, enabled: true })!)
          : await testOdometerSource(connection.device, initCommands, buildOdometerSource({ ...values.odometer, enabled: true })!);
      setTestResults((prev) => ({ ...prev, [which]: result }));
      if (result.connectionFailed) notify(t('common.error'), t('obdSetup.connectionFailed'));
    } catch {
      notify(t('common.error'), t('obdSetup.connectionFailed'));
    } finally {
      setTesting(null);
    }
  };

  const busy = disabled || testing !== null;
  const lines = (name: Path<ManualObdFormValues>, placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <TextField
          value={String(value)}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.multiline}
        />
      )}
    />
  );

  return (
    <Card title={t('obdSetup.manualTitle')}>
      <Text style={styles.hint}>{t('obdSetup.manualHint')}</Text>

      <FormField label={t('obdSetup.initCommands')}>
        {lines('initCommands', t('obdSetup.initCommandsPlaceholder'))}
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
          <Text style={styles.fieldHint}>{t('obdSetup.vinDecodeHint')}</Text>
          <TestRow
            testing={testing === 'vin'}
            disabled={busy || !deviceAddress}
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
          <FormField label={t('obdSetup.odometerMode')}>
            <Controller
              control={control}
              name="odometer.mode"
              render={({ field: { value, onChange } }) => (
                <SegmentedControl
                  value={value}
                  onChange={onChange}
                  options={[
                    { value: 'request', label: t('obdSetup.modeRequest') },
                    { value: 'broadcast', label: t('obdSetup.modeBroadcast') },
                  ]}
                />
              )}
            />
            <Text style={styles.fieldHint}>
              {odometerMode === 'broadcast' ? t('obdSetup.modeBroadcastHint') : t('obdSetup.modeRequestHint')}
            </Text>
          </FormField>
          {odometerMode === 'broadcast' ? (
            <FormField label={t('obdSetup.canId')} error={errors.odometer?.canId?.message}>
              <Controller
                control={control}
                name="odometer.canId"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="3D0"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                )}
              />
            </FormField>
          ) : (
            <RequestFields control={control} errors={errors} prefix="odometer" t={t} />
          )}

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
            <Text style={styles.fieldHint}>{t('obdSetup.byteFieldHint')}</Text>
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
          <FormField label={t('obdSetup.encoding')}>
            <Controller
              control={control}
              name="odometer.encoding"
              render={({ field: { value, onChange } }) => (
                <SegmentedControl
                  value={value}
                  onChange={onChange}
                  options={[
                    { value: 'uint', label: t('obdSetup.encodingUint') },
                    { value: 'bcd', label: t('obdSetup.encodingBcd') },
                  ]}
                />
              )}
            />
          </FormField>
          <View style={styles.twoCol}>
            <View style={styles.twoColItem}>
              <FormField label={t('obdSetup.scale')} error={errors.odometer?.scale?.message}>
                <Controller
                  control={control}
                  name="odometer.scale"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextField value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="1" />
                  )}
                />
              </FormField>
            </View>
            <View style={styles.twoColItem}>
              <FormField label={t('obdSetup.add')} error={errors.odometer?.add?.message}>
                <Controller
                  control={control}
                  name="odometer.add"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextField
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numbers-and-punctuation"
                      placeholder="0"
                    />
                  )}
                />
              </FormField>
            </View>
          </View>
          <FormField label={t('obdSetup.unit')}>
            <Controller
              control={control}
              name="odometer.unit"
              render={({ field: { value, onChange } }) => (
                <SegmentedControl
                  value={value}
                  onChange={onChange}
                  options={[
                    { value: 'km', label: t('common.km') },
                    { value: 'mi', label: t('common.mi') },
                  ]}
                />
              )}
            />
            <Text style={styles.fieldHint}>{t('obdSetup.transformHint')}</Text>
          </FormField>
          <TestRow
            testing={testing === 'odometer'}
            disabled={busy || !deviceAddress}
            onPress={() => runTest('odometer')}
            result={testResults.odometer}
            t={t}
            styles={styles}
            formatValue={(value) => `${value} km`}
          />
        </>
      )}

      {!deviceAddress && (vinEnabled || odometerEnabled) && <Text style={styles.fieldHint}>{t('obdSetup.testNeedsAdapter')}</Text>}

      <Button label={t('obdSetup.save')} onPress={save} disabled={!isDirty || !isValid || busy} />
    </Card>
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
  const protocolOptions = useMemo<ChoiceChip<ProtocolChoice>[]>(
    () => [
      { value: 'auto', label: t('obdSetup.protocolAuto') },
      ...BUS_PROTOCOLS.map((value) => ({ value, label: t(PROTOCOL_LABEL_KEYS[value]) })),
    ],
    [t]
  );

  const hexField = (field: string, placeholder: string, error: string | undefined, label: string, multiline = false) => (
    <FormField label={label} error={error}>
      <Controller
        control={control}
        name={name(field)}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextField
            value={String(value)}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            multiline={multiline}
            style={multiline ? styles.multiline : undefined}
          />
        )}
      />
    </FormField>
  );

  return (
    <>
      <FormField label={t('obdSetup.protocol')}>
        <Controller
          control={control}
          name={name('protocol')}
          render={({ field: { value, onChange } }) => (
            <ChoiceChips value={value as ProtocolChoice} onChange={onChange} options={protocolOptions} />
          )}
        />
      </FormField>
      <View style={styles.twoCol}>
        <View style={styles.twoColItem}>
          {hexField('header', t('obdSetup.headerPlaceholder'), sectionErrors?.header?.message, t('obdSetup.header'))}
        </View>
        <View style={styles.twoColItem}>
          {hexField(
            'receiveAddress',
            t('obdSetup.receivePlaceholder'),
            sectionErrors?.receiveAddress?.message,
            t('obdSetup.receiveAddress')
          )}
        </View>
      </View>
      <FormField label={t('obdSetup.atCommands')}>
        <Controller
          control={control}
          name={name('atCommands')}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              value={String(value)}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('obdSetup.atCommandsPlaceholder')}
              multiline
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.multiline}
            />
          )}
        />
        <Text style={styles.fieldHint}>{t('obdSetup.atCommandsHint')}</Text>
      </FormField>
      {hexField('session', t('obdSetup.sessionPlaceholder'), sectionErrors?.session?.message, t('obdSetup.session'))}
      <View>
        {hexField('setup', t('obdSetup.setupPlaceholder'), sectionErrors?.setup?.message, t('obdSetup.setup'), true)}
        <Text style={styles.fieldHint}>{t('obdSetup.setupHint')}</Text>
      </View>
      {hexField('request', t('obdSetup.requestPlaceholder'), sectionErrors?.request?.message, t('obdSetup.request'))}
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
    hint: {
      color: colors.textFaint,
      fontSize: fontSize.small,
      lineHeight: 17,
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
