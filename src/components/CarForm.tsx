import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import { ObdConfigCard } from '@/components/ObdConfigCard';
import type { VehicleScanResult } from '@/obd';
import type { Car, ObdConfig } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, kmToDisplay, type DistanceUnit } from '@/utils/units';
import { MAX_ODOMETER, isValidVin, isValidYear, sanitizeVinInput } from '@/utils/validation';

export interface CarFormValues {
  nickname: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
  vin: string;
}

function carToFormValues(car: Car | undefined, distanceUnit: DistanceUnit): CarFormValues {
  return {
    nickname: car?.displayName ?? '',
    make: car?.make ?? '',
    model: car?.model ?? '',
    year: car ? String(car.year) : '',
    // Plain digits, no thousands separators — `formatDistance` is for display, but this
    // seeds an editable input, and its comma (e.g. "12,345") would fail the digits-only schema.
    odometer: car ? String(Math.round(kmToDisplay(car.odometerKm, distanceUnit))) : '',
    vin: car?.vin ?? '',
  };
}

export interface ParsedCarFormValues {
  vin: string;
  displayName: string;
  make: string;
  model: string;
  year: number;
  odometerKm: number;
  obd: ObdConfig | null;
}

/**
 * Converts already-validated form text into storage-ready values. Only call
 * this with values that passed `carFormSchema` — it assumes well-formed input.
 */
export function toParsedCarFormValues(
  values: CarFormValues,
  distanceUnit: DistanceUnit,
  obd: ObdConfig | null
): ParsedCarFormValues {
  return {
    vin: values.vin.trim(),
    displayName: values.nickname.trim(),
    make: values.make.trim(),
    model: values.model.trim(),
    year: Number(values.year.trim()),
    odometerKm: Math.round(displayToKm(Number(values.odometer.trim()), distanceUnit)),
    obd,
  };
}

const MAX_NAME_LENGTH = 60;

function trimmedLength(value: string): number {
  return value.trim().length;
}

/** Zod schema for the raw form text. Built per-render so messages follow the active language. */
function buildCarFormSchema(t: TFunction, existingVins: string[]) {
  const normalizedExistingVins = existingVins.map((v) => v.trim().toUpperCase());

  const textField = (min = 2, max = MAX_NAME_LENGTH) =>
    z
      .string()
      .refine((v) => trimmedLength(v) > 0, { message: t('validation.required') })
      .refine((v) => trimmedLength(v) >= min, { message: t('validation.tooShort', { count: min }) })
      .refine((v) => trimmedLength(v) <= max, { message: t('validation.tooLong', { count: max }) });

  return z.object({
    nickname: textField(),
    make: textField(),
    model: textField(),
    year: z
      .string()
      .refine((v) => trimmedLength(v) > 0, { message: t('validation.required') })
      .refine((v) => /^\d{4}$/.test(v.trim()), { message: t('validation.invalidYear') })
      .refine((v) => isValidYear(Number(v.trim())), {
        message: t('validation.invalidYear'),
      }),
    odometer: z
      .string()
      .refine((v) => trimmedLength(v) > 0, { message: t('validation.required') })
      .refine((v) => /^\d+$/.test(v.trim()), { message: t('validation.invalidNumber') })
      .refine((v) => Number(v.trim()) <= MAX_ODOMETER, { message: t('validation.tooLarge') }),
    vin: z
      .string()
      .refine((v) => trimmedLength(v) > 0, { message: t('validation.required') })
      .refine((v) => isValidVin(v.trim()), { message: t('validation.invalidVin') })
      .refine((v) => !normalizedExistingVins.includes(v.trim().toUpperCase()), { message: t('validation.vinTaken') }),
  });
}

/**
 * Fills in whichever form fields a BLE vehicle scan (see `ObdConfigCard`) actually found - fields
 * that came back null are left as the user typed them. VIN is only applied if it passed validation
 * (the adapter/decoding can hand back garbage), and odometer is converted from km to the form's unit.
 */
function applyScanResult(setValue: UseFormSetValue<CarFormValues>, result: VehicleScanResult, distanceUnit: DistanceUnit): void {
  const sanitizedVin = result.vin ? sanitizeVinInput(result.vin) : null;
  if (sanitizedVin && isValidVin(sanitizedVin)) {
    setValue('vin', sanitizedVin, { shouldValidate: true, shouldDirty: true });
  }
  if (result.make) {
    setValue('make', result.make, { shouldValidate: true, shouldDirty: true });
  }
  if (result.model) {
    setValue('model', result.model, { shouldValidate: true, shouldDirty: true });
  }
  if (result.year !== null && isValidYear(result.year)) {
    setValue('year', String(result.year), { shouldValidate: true, shouldDirty: true });
  }
  if (result.odometerKm !== null) {
    setValue('odometer', String(Math.round(kmToDisplay(result.odometerKm, distanceUnit))), { shouldValidate: true, shouldDirty: true });
  }
}

/**
 * Drives one car form: validated with zod, revalidated on every change. Shared by every
 * screen that hosts CarFormFields. `existingVins` should list every *other* car's VIN
 * (i.e. excluding the car being edited, if any) so the duplicate check doesn't flag itself.
 */
export function useCarForm(car: Car | undefined, distanceUnit: DistanceUnit, existingVins: string[]) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildCarFormSchema(t, existingVins), [t, existingVins]);
  const form = useForm<CarFormValues>({
    resolver: zodResolver(schema),
    // Validate a field the moment it's first left (even untouched-by-typing),
    // then keep validating live on every change after that.
    mode: 'onTouched',
    defaultValues: carToFormValues(car, distanceUnit),
  });

  // Validate once up front so a pre-filled (edit) form doesn't start out
  // reporting `isValid: false` before the user has touched anything.
  useEffect(() => {
    form.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return form;
}

/** The form's fields only — no submit chrome, so callers can supply their own footer. */
export function CarFormFields({
  control,
  errors,
  touchedFields,
  isSubmitted,
  setValue,
  distanceUnit,
  obd,
  onObdChange,
}: {
  control: Control<CarFormValues>;
  errors: FieldErrors<CarFormValues>;
  touchedFields: Partial<Readonly<Record<keyof CarFormValues, boolean>>>;
  isSubmitted: boolean;
  setValue: UseFormSetValue<CarFormValues>;
  distanceUnit: DistanceUnit;
  /** The car's persisted OBD adapter, if any — null for a car that's never been paired (or a new car). */
  obd: ObdConfig | null;
  /** Called when the user pairs a (different) adapter from the scan list. */
  onObdChange: (obd: ObdConfig) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Don't show a field's error until the user has actually left it (or tried to
  // submit) — otherwise every required field complains the instant the form mounts.
  const fieldError = (name: keyof CarFormValues) => (touchedFields[name] || isSubmitted ? errors[name]?.message : undefined);

  return (
    <>
      <ObdConfigCard obd={obd} onObdChange={onObdChange} onScanResult={(result) => applyScanResult(setValue, result, distanceUnit)} />

      <FormField label={t('carForm.nickname')} error={fieldError('nickname')}>
        <Controller
          control={control}
          name="nickname"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              placeholder={t('carForm.nicknamePlaceholder')}
              placeholderTextColor={colors.textFainter}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </FormField>

      <FormField label={t('carForm.make')} error={fieldError('make')}>
        <Controller
          control={control}
          name="make"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              placeholder={t('carForm.makePlaceholder')}
              placeholderTextColor={colors.textFainter}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </FormField>

      <FormField label={t('carForm.model')} error={fieldError('model')}>
        <Controller
          control={control}
          name="model"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              placeholder={t('carForm.modelPlaceholder')}
              placeholderTextColor={colors.textFainter}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </FormField>

      <View style={styles.twoCol}>
        <View style={styles.twoColItem}>
          <FormField label={t('carForm.year')} error={fieldError('year')}>
            <Controller
              control={control}
              name="year"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="2019"
                  placeholderTextColor={colors.textFainter}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={value}
                  onChangeText={(text) => onChange(sanitizeIntegerInput(text))}
                  onBlur={onBlur}
                />
              )}
            />
          </FormField>
        </View>
        <View style={styles.twoColItem}>
          <FormField label={t('carForm.odometer')} error={fieldError('odometer')}>
            <View style={styles.suffixField}>
              <Controller
                control={control}
                name="odometer"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    style={[styles.input, styles.suffixInput]}
                    placeholder="0"
                    placeholderTextColor={colors.textFainter}
                    keyboardType="number-pad"
                    value={value}
                    onChangeText={(text) => onChange(sanitizeIntegerInput(text))}
                    onBlur={onBlur}
                  />
                )}
              />
              <Text style={styles.inputSuffix}>{t(`common.${distanceUnit}`)}</Text>
            </View>
          </FormField>
        </View>
      </View>

      <FormField label={t('carForm.vin')} error={fieldError('vin')}>
        <Controller
          control={control}
          name="vin"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              placeholder={t('carForm.vinPlaceholder')}
              placeholderTextColor={colors.textFainter}
              autoCapitalize="characters"
              maxLength={17}
              value={value}
              onChangeText={(text) => onChange(sanitizeVinInput(text))}
              onBlur={onBlur}
            />
          )}
        />
      </FormField>
    </>
  );
}

export function CarForm({
  car,
  distanceUnit,
  existingVins,
  onCancel,
  onSubmit,
  submitLabel,
  insetBottom,
}: {
  car?: Car;
  distanceUnit: DistanceUnit;
  /** Every *other* car's VIN (excluding `car`'s own) — used to reject a duplicate before submit is even reachable. */
  existingVins: string[];
  onCancel: () => void;
  onSubmit: (values: ParsedCarFormValues) => void;
  submitLabel: string;
  insetBottom: number;
}) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useCarForm(car, distanceUnit, existingVins);
  const [obd, setObd] = useState<ObdConfig | null>(car?.obd ?? null);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const submit = handleSubmit((values) => {
    onSubmit(toParsedCarFormValues(values, distanceUnit, obd));
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CarFormFields
          control={control}
          errors={errors}
          touchedFields={touchedFields}
          isSubmitted={isSubmitted}
          setValue={setValue}
          distanceUnit={distanceUnit}
          obd={obd}
          onObdChange={setObd}
        />
      </ScrollView>
      <FormButtonRow
        insetBottom={insetBottom}
        onCancel={onCancel}
        onSubmit={submit}
        submitLabel={submitLabel}
        submitDisabled={!isValid}
      />
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    content: {
      padding: 16,
      gap: 18,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 14,
    },
    twoCol: {
      flexDirection: 'row',
      gap: 10,
    },
    twoColItem: {
      flex: 1,
    },
    suffixField: {
      justifyContent: 'center',
    },
    suffixInput: {
      paddingRight: 40,
    },
    inputSuffix: {
      position: 'absolute',
      right: 14,
      color: colors.textFaint,
      fontSize: 12,
    },
  });
}
