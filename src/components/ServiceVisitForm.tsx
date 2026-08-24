import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ComboBoxInput } from '@/components/ComboBoxInput';
import { DatePickerField } from '@/components/DatePickerField';
import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import { StatusDot } from '@/components/StatusDot';
import type { Car, ServiceVisit } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/utils/numericInput';
import { computeCarItemStatuses } from '@/utils/serviceStatus';
import { displayToKm, kmToDisplay, type DistanceUnit } from '@/utils/units';
import { MAX_ODOMETER } from '@/utils/validation';

export interface ServiceVisitFormValues {
  shop: string;
  /** Unix epoch milliseconds — always a concrete date, since the date picker never leaves it blank. */
  date: number;
  odometer: string;
  price: string;
}

const MAX_SPEND = 1_000_000;

/** Plain digits, no thousands separators — `formatDistance` is for display, but this seeds an
 *  editable input, and its comma (e.g. "12,345") would fail the odometer field's digits-only schema. */
function odometerToFormValue(km: number, distanceUnit: DistanceUnit): string {
  return String(Math.round(kmToDisplay(km, distanceUnit)));
}

function visitToFormValues(visit: ServiceVisit | undefined, car: Car | undefined, distanceUnit: DistanceUnit): ServiceVisitFormValues {
  return {
    shop: visit?.shopName ?? '',
    date: visit?.timestamp ?? Date.now(),
    odometer: visit ? odometerToFormValue(visit.odometerKm, distanceUnit) : car ? odometerToFormValue(car.odometerKm, distanceUnit) : '',
    price: visit && visit.spend > 0 ? String(visit.spend) : '',
  };
}

export interface ParsedServiceVisitFormValues {
  timestamp: number;
  odometerKm: number;
  shopName: string;
  spend: number;
  itemsDone: string[];
}

function buildVisitSchema(t: TFunction) {
  return z.object({
    shop: z
      .string()
      .refine((v) => v.trim().length > 0, { message: t('validation.required') })
      .refine((v) => v.trim().length >= 2, { message: t('validation.tooShort', { count: 2 }) })
      .refine((v) => v.trim().length <= 80, { message: t('validation.tooLong', { count: 80 }) }),
    date: z.number().refine((v) => v <= Date.now(), { message: t('validation.futureDate') }),
    // No lower bound tied to the car's current odometer — a visit can be logged for the past,
    // and can be logged out of chronological order, so any non-negative reading is valid here.
    odometer: z
      .string()
      .refine((v) => v.trim().length > 0, { message: t('validation.required') })
      .refine((v) => /^\d+$/.test(v.trim()), { message: t('validation.invalidNumber') })
      .refine((v) => Number(v.trim()) <= MAX_ODOMETER, { message: t('validation.tooLarge') }),
    price: z
      .string()
      .refine((v) => v.trim().length === 0 || /^\d+(\.\d{1,2})?$/.test(v.trim()), {
        message: t('validation.invalidNumber'),
      })
      .refine((v) => v.trim().length === 0 || Number(v.trim()) <= MAX_SPEND, { message: t('validation.tooLarge') }),
  });
}

export function ServiceVisitForm({
  visit,
  car,
  distanceUnit,
  currency,
  onCancel,
  onSubmit,
  submitLabel,
  insetBottom,
}: {
  visit?: ServiceVisit;
  car: Car | undefined;
  distanceUnit: DistanceUnit;
  currency: string;
  onCancel: () => void;
  onSubmit: (values: ParsedServiceVisitFormValues) => void;
  submitLabel: string;
  insetBottom: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set(visit?.itemsDone ?? []));

  const toggleItem = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // `car` comes from a ref-backed lookup (not render state), so it isn't a safe useMemo
  // dependency — the list (cheap to build) is simply recomputed on every render instead.
  const items = car ? computeCarItemStatuses(car) : [];
  // Most-recent-first, deduplicated, excluding this visit's own (already-current) value.
  const shopOptions = [
    ...new Set(
      [...(car?.serviceVisits ?? [])]
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((v) => v.shopName)
        .filter((name) => name !== visit?.shopName)
    ),
  ];
  const schema = buildVisitSchema(t);
  const {
    control,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitted },
  } = useForm<ServiceVisitFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: visitToFormValues(visit, car, distanceUnit),
  });

  // RHF's own `formState.isValid` runs the resolver asynchronously and only settles after
  // a field is touched/changed post-mount — for an edit form (already-valid defaults) that
  // leaves Save wrongly disabled until *something* happens to trigger it. Deriving validity
  // synchronously from the live values sidesteps that race, so an edit form starts enabled.
  const values = useWatch({ control });
  const isValid = schema.safeParse(values).success;

  // Don't show a field's error until the user has actually left it (or tried to
  // submit) — otherwise every required field complains the instant the form mounts.
  const fieldError = (name: keyof ServiceVisitFormValues) =>
    touchedFields[name] || isSubmitted ? errors[name]?.message : undefined;

  const submit = handleSubmit((values) => {
    const odometerKm = Math.round(displayToKm(Number(values.odometer.trim()), distanceUnit));
    const spend = values.price.trim().length > 0 ? Number(values.price.trim()) : 0;
    onSubmit({
      timestamp: values.date,
      odometerKm,
      shopName: values.shop.trim(),
      spend,
      itemsDone: [...selectedNames],
    });
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FormField label={t('addServiceVisit.shop')} error={fieldError('shop')} style={styles.shopField}>
          <Controller
            control={control}
            name="shop"
            render={({ field: { value, onChange, onBlur } }) => (
              <ComboBoxInput
                style={styles.input}
                placeholder={t('addServiceVisit.shopPlaceholder')}
                placeholderTextColor={colors.textFainter}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                options={shopOptions}
              />
            )}
          />
        </FormField>

        <View style={styles.twoCol}>
          <View style={styles.twoColItem}>
            <FormField label={t('addServiceVisit.date')} error={fieldError('date')}>
              <Controller
                control={control}
                name="date"
                render={({ field: { value, onChange, onBlur } }) => (
                  <DatePickerField style={styles.input} value={value} onChange={onChange} onBlur={onBlur} />
                )}
              />
            </FormField>
          </View>
          <View style={styles.twoColItem}>
            <FormField label={t('addServiceVisit.odometer')} error={fieldError('odometer')}>
              <View style={styles.suffixField}>
                <Controller
                  control={control}
                  name="odometer"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      style={styles.input}
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

        <FormField label={t('addServiceVisit.amountSpent')} error={fieldError('price')}>
          <View style={styles.suffixField}>
            <Controller
              control={control}
              name="price"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textFainter}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={(text) => onChange(sanitizeDecimalInput(text))}
                  onBlur={onBlur}
                />
              )}
            />
            <Text style={styles.inputSuffix}>{currency}</Text>
          </View>
        </FormField>

        <FormField label={t('addServiceVisit.itemsPerformed')}>
          <View style={styles.itemList}>
            {items.map((entry) => {
              const selected = selectedNames.has(entry.item.name);
              return (
                <Pressable
                  key={entry.item.name}
                  onPress={() => toggleItem(entry.item.name)}
                  style={[styles.itemRow, selected && styles.itemRowSelected]}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.itemRowText}>{entry.item.name}</Text>
                  <StatusDot status={entry.status} />
                </Pressable>
              );
            })}
          </View>
        </FormField>
      </ScrollView>
      <FormButtonRow
        insetBottom={insetBottom}
        onCancel={onCancel}
        onSubmit={submit}
        submitLabel={submitLabel}
        submitDisabled={!isValid || !car}
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
    // Above the fields declared after it (date/odometer/price/items), so its
    // suggestions dropdown — an absolutely positioned descendant — isn't
    // painted over by their normal-flow layout further down the form.
    shopField: {
      zIndex: 20,
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
    inputSuffix: {
      position: 'absolute',
      right: 14,
      color: colors.textFaint,
      fontSize: 12,
    },
    itemList: {
      gap: 6,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    itemRowSelected: {
      backgroundColor: colors.amberMuted,
      borderColor: colors.amberBorder,
    },
    itemRowText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.amber,
      borderColor: colors.amber,
    },
    checkmark: {
      color: colors.onAmber,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
