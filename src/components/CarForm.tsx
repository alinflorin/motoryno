import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import type { Car } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, formatDistance, type DistanceUnit } from '@/utils/units';
import { MAX_ODOMETER, MIN_YEAR, VIN_PATTERN, maxYear, sanitizeVinInput } from '@/utils/validation';

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
    odometer: car ? formatDistance(car.odometerKm, distanceUnit) : '',
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
}

/**
 * Converts already-validated form text into storage-ready values. Only call
 * this with values that passed `carFormSchema` — it assumes well-formed input.
 */
export function toParsedCarFormValues(values: CarFormValues, distanceUnit: DistanceUnit): ParsedCarFormValues {
  return {
    vin: values.vin.trim(),
    displayName: values.nickname.trim(),
    make: values.make.trim(),
    model: values.model.trim(),
    year: Number(values.year.trim()),
    odometerKm: Math.round(displayToKm(Number(values.odometer.trim()), distanceUnit)),
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
      .refine((v) => Number(v.trim()) >= MIN_YEAR && Number(v.trim()) <= maxYear(), {
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
      .refine((v) => VIN_PATTERN.test(v.trim()), { message: t('validation.invalidVin') })
      .refine((v) => !normalizedExistingVins.includes(v.trim().toUpperCase()), { message: t('validation.vinTaken') }),
  });
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
  distanceUnit,
}: {
  control: Control<CarFormValues>;
  errors: FieldErrors<CarFormValues>;
  touchedFields: Partial<Readonly<Record<keyof CarFormValues, boolean>>>;
  isSubmitted: boolean;
  distanceUnit: DistanceUnit;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Don't show a field's error until the user has actually left it (or tried to
  // submit) — otherwise every required field complains the instant the form mounts.
  const fieldError = (name: keyof CarFormValues) => (touchedFields[name] || isSubmitted ? errors[name]?.message : undefined);

  return (
    <>
      <View style={styles.obdCard}>
        <View style={styles.obdHeader}>
          <Text style={styles.obdTitle}>{t('carForm.obdTitle')}</Text>
        </View>
        <View style={styles.obdBody}>
          <Text style={styles.obdSubtitle}>{t('carForm.obdSubtitle')}</Text>
          <Pressable style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}>
            <Text style={styles.scanButtonText}>{t('carForm.scan')}</Text>
          </Pressable>
        </View>
      </View>

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
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useCarForm(car, distanceUnit, existingVins);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const submit = handleSubmit((values) => {
    onSubmit(toParsedCarFormValues(values, distanceUnit));
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CarFormFields
          control={control}
          errors={errors}
          touchedFields={touchedFields}
          isSubmitted={isSubmitted}
          distanceUnit={distanceUnit}
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
    },
    scanButtonPressed: {
      opacity: 0.85,
    },
    scanButtonText: {
      color: colors.onAmber,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
