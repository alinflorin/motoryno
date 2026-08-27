import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import type { TFunction } from 'i18next';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import type { TrackedServiceItem } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { useKeyboardVerticalOffset } from '@/utils/useKeyboardVerticalOffset';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, kmToDisplay, type DistanceUnit } from '@/utils/units';

export interface TrackedItemFormValues {
  name: string;
  months: string;
  distance: string;
}

const MAX_MONTHS = 1200; // 100 years
const MAX_DISTANCE = 10_000_000;

function itemToFormValues(item: TrackedServiceItem | undefined, distanceUnit: DistanceUnit): TrackedItemFormValues {
  return {
    name: item?.name ?? '',
    months: item?.timeIntervalDays ? String(Math.round(item.timeIntervalDays / 30.44)) : '',
    distance: item?.kmInterval ? String(Math.round(kmToDisplay(item.kmInterval, distanceUnit))) : '',
  };
}

export interface ParsedTrackedItemFormValues {
  name: string;
  timeIntervalDays: number | null;
  kmInterval: number | null;
}

export function toParsedTrackedItemFormValues(
  values: TrackedItemFormValues,
  distanceUnit: DistanceUnit
): ParsedTrackedItemFormValues {
  const months = values.months.trim();
  const distance = values.distance.trim();
  return {
    name: values.name.trim(),
    timeIntervalDays: months.length > 0 ? Math.round(Number(months) * 30.44) : null,
    kmInterval: distance.length > 0 ? Math.round(displayToKm(Number(distance), distanceUnit)) : null,
  };
}

function buildTrackedItemSchema(t: TFunction, existingNames: string[]) {
  const optionalPositiveInt = (max: number) =>
    z
      .string()
      .refine((v) => v.trim().length === 0 || /^\d+$/.test(v.trim()), { message: t('validation.invalidNumber') })
      .refine((v) => v.trim().length === 0 || Number(v.trim()) > 0, { message: t('validation.invalidNumber') })
      .refine((v) => v.trim().length === 0 || Number(v.trim()) <= max, { message: t('validation.tooLarge') });

  return z
    .object({
      name: z
        .string()
        .refine((v) => v.trim().length > 0, { message: t('validation.required') })
        .refine((v) => v.trim().length >= 2, { message: t('validation.tooShort', { count: 2 }) })
        .refine((v) => v.trim().length <= 60, { message: t('validation.tooLong', { count: 60 }) }),
      months: optionalPositiveInt(MAX_MONTHS),
      distance: optionalPositiveInt(MAX_DISTANCE),
    })
    .superRefine((data, ctx) => {
      if (data.months.trim().length === 0 && data.distance.trim().length === 0) {
        ctx.addIssue({ path: ['months'], code: z.ZodIssueCode.custom, message: t('validation.intervalRequired') });
      }
      if (existingNames.includes(data.name.trim().toLowerCase())) {
        ctx.addIssue({ path: ['name'], code: z.ZodIssueCode.custom, message: t('validation.nameTaken') });
      }
    });
}

/**
 * Drives one tracked-item form: validated with zod, revalidated on every change.
 * `existingNames` should list every *other* item's name (lowercased, trimmed — i.e.
 * excluding the item being edited, if any) so the duplicate check doesn't flag itself.
 */
export function useTrackedItemForm(
  item: TrackedServiceItem | undefined,
  distanceUnit: DistanceUnit,
  existingNames: string[]
) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildTrackedItemSchema(t, existingNames), [t, existingNames]);
  const form = useForm<TrackedItemFormValues>({
    resolver: zodResolver(schema),
    // Validate a field the moment it's first left (even untouched-by-typing),
    // then keep validating live on every change after that.
    mode: 'onTouched',
    defaultValues: itemToFormValues(item, distanceUnit),
  });

  return { ...form, schema };
}

export function TrackedItemForm({
  item,
  distanceUnit,
  existingNames,
  onCancel,
  onSubmit,
  submitLabel,
  insetBottom,
}: {
  item?: TrackedServiceItem;
  distanceUnit: DistanceUnit;
  /** Every *other* item's name (excluding `item`'s own) — used to reject a duplicate before submit is even reachable. */
  existingNames: string[];
  onCancel: () => void;
  onSubmit: (values: ParsedTrackedItemFormValues) => void;
  submitLabel: string;
  insetBottom: number;
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    schema,
    formState: { errors, touchedFields, isSubmitted },
  } = useTrackedItemForm(item, distanceUnit, existingNames);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // RHF's own `formState.isValid` runs the resolver asynchronously and only settles after
  // a field is touched/changed post-mount — for an edit form (already-valid defaults) that
  // leaves Save wrongly disabled until *something* happens to trigger it. Deriving validity
  // synchronously from the live values sidesteps that race, so an edit form starts enabled.
  const values = useWatch({ control });
  const isValid = schema.safeParse(values).success;

  // Don't show a field's error until the user has actually left it (or tried to
  // submit) — otherwise every required field complains the instant the form mounts.
  const fieldError = (name: keyof TrackedItemFormValues) =>
    touchedFields[name] || isSubmitted ? errors[name]?.message : undefined;
  // Months and distance share one error slot (either satisfies the "pick one" rule),
  // so show it once either side of that pair has been visited.
  const intervalError =
    touchedFields.months || touchedFields.distance || isSubmitted
      ? (errors.months?.message ?? errors.distance?.message)
      : undefined;

  const submit = handleSubmit((values) => {
    onSubmit(toParsedTrackedItemFormValues(values, distanceUnit));
  });

  const keyboardVerticalOffset = useKeyboardVerticalOffset();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FormField label={t('addTrackedItem.itemName')} error={fieldError('name')}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={styles.input}
                placeholder={t('addTrackedItem.itemNamePlaceholder')}
                placeholderTextColor={colors.textFainter}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </FormField>

        <FormField label={t('addTrackedItem.interval')} error={intervalError}>
          <View style={styles.intervalRow}>
            <View style={styles.intervalField}>
              <Controller
                control={control}
                name="months"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="12"
                    placeholderTextColor={colors.textFainter}
                    keyboardType="number-pad"
                    value={value}
                    onChangeText={(text) => onChange(sanitizeIntegerInput(text))}
                    onBlur={onBlur}
                  />
                )}
              />
              <Text style={styles.inputSuffix}>{t('addTrackedItem.months')}</Text>
            </View>
            <Text style={styles.orLabel}>{t('addTrackedItem.or')}</Text>
            <View style={styles.intervalField}>
              <Controller
                control={control}
                name="distance"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="10000"
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
          </View>
        </FormField>
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
    flex: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 20,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 14,
    },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    intervalField: {
      flex: 1,
      position: 'relative',
      justifyContent: 'center',
    },
    inputSuffix: {
      position: 'absolute',
      right: 14,
      color: colors.textFaint,
      fontSize: 12,
    },
    orLabel: {
      color: colors.textFainter,
      fontSize: 13,
    },
  });
}
