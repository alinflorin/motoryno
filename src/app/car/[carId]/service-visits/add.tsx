import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { StatusDot } from '@/components/StatusDot';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { parseDateDMY, parseDateDMYOrNow } from '@/utils/date';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/utils/numericInput';
import { computeCarItemStatuses } from '@/utils/serviceStatus';
import { displayToKm, distanceUnitFor, formatDistance, type DistanceUnit } from '@/utils/units';
import { MAX_ODOMETER, sanitizeDateInput } from '@/utils/validation';
import type { TFunction } from 'i18next';

interface VisitFormValues {
  shop: string;
  date: string;
  odometer: string;
  price: string;
}

const MAX_SPEND = 1_000_000;

function buildVisitSchema(t: TFunction, currentOdometerKm: number | undefined, distanceUnit: DistanceUnit) {
  return z
    .object({
      shop: z
        .string()
        .refine((v) => v.trim().length > 0, { message: t('validation.required') })
        .refine((v) => v.trim().length >= 2, { message: t('validation.tooShort', { count: 2 }) })
        .refine((v) => v.trim().length <= 80, { message: t('validation.tooLong', { count: 80 }) }),
      date: z
        .string()
        .refine((v) => v.trim().length === 0 || parseDateDMY(v) !== null, { message: t('validation.invalidDate') })
        .refine((v) => v.trim().length === 0 || (parseDateDMY(v) as number) <= Date.now(), {
          message: t('validation.futureDate'),
        }),
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
    })
    .superRefine((data, ctx) => {
      if (currentOdometerKm === undefined || !/^\d+$/.test(data.odometer.trim())) return;
      const odometerKm = Math.round(displayToKm(Number(data.odometer.trim()), distanceUnit));
      if (odometerKm < currentOdometerKm) {
        ctx.addIssue({
          path: ['odometer'],
          code: z.ZodIssueCode.custom,
          message: t('validation.odometerTooLow', {
            odometer: `${formatDistance(currentOdometerKm, distanceUnit)} ${t(`common.${distanceUnit}`)}`,
          }),
        });
      }
    });
}

export default function AddServiceVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, addServiceVisit, setCarOdometer } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const items = car ? computeCarItemStatuses(car) : [];
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const toggleItem = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // `car` comes from a ref-backed lookup (not render state), so it isn't a safe useMemo
  // dependency — the schema (cheap to build) is simply recomputed on every render instead.
  const schema = buildVisitSchema(t, car?.odometerKm, distanceUnit);
  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useForm<VisitFormValues>({
    resolver: zodResolver(schema),
    // Validate a field the moment it's first left (even untouched-by-typing),
    // then keep validating live on every change after that.
    mode: 'onTouched',
    defaultValues: {
      shop: '',
      date: '',
      odometer: car ? formatDistance(car.odometerKm, distanceUnit) : '',
      price: '',
    },
  });

  useEffect(() => {
    trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't show a field's error until the user has actually left it (or tried to
  // submit) — otherwise every required field complains the instant the form mounts.
  const fieldError = (name: keyof VisitFormValues) =>
    touchedFields[name] || isSubmitted ? errors[name]?.message : undefined;

  const onValid = handleSubmit((values) => {
    if (!car) return;
    const odometerKm = Math.round(displayToKm(Number(values.odometer.trim()), distanceUnit));
    const spend = values.price.trim().length > 0 ? Number(values.price.trim()) : 0;
    addServiceVisit(car.vin, {
      timestamp: parseDateDMYOrNow(values.date),
      odometerKm,
      shopName: values.shop.trim(),
      spend,
      itemsDone: [...selectedNames],
    });
    if (odometerKm > car.odometerKm) {
      setCarOdometer(car.vin, odometerKm);
    }
    router.back();
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addServiceVisit.title') }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FormField label={t('addServiceVisit.shop')} error={fieldError('shop')}>
            <Controller
              control={control}
              name="shop"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={styles.input}
                  placeholder={t('addServiceVisit.shopPlaceholder')}
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
              <FormField label={t('addServiceVisit.date')} error={fieldError('date')}>
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="DD.MM.YYYY"
                      placeholderTextColor={colors.textFainter}
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={(text) => onChange(sanitizeDateInput(text))}
                      onBlur={onBlur}
                    />
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
              <Text style={styles.inputSuffix}>{settings.currency}</Text>
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
          insetBottom={insets.bottom}
          onCancel={() => router.back()}
          onSubmit={onValid}
          submitLabel={t('addServiceVisit.saveVisit')}
          submitDisabled={!isValid || !car}
        />
      </KeyboardAvoidingView>
    </Screen>
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
