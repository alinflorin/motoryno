import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import type { TFunction } from 'i18next';

import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, distanceUnitFor } from '@/utils/units';
import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';

interface TrackedItemFormValues {
  name: string;
  months: string;
  distance: string;
}

const MAX_MONTHS = 1200; // 100 years
const MAX_DISTANCE = 10_000_000;

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

export default function AddTrackedItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, addTrackedServiceItem } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // `car` comes from a ref-backed lookup (not render state), so it isn't a safe useMemo
  // dependency — the schema (cheap to build) is simply recomputed on every render instead.
  const existingNames = car?.trackedServiceItems.map((item) => item.name.trim().toLowerCase()) ?? [];
  const schema = buildTrackedItemSchema(t, existingNames);
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useForm<TrackedItemFormValues>({
    resolver: zodResolver(schema),
    // Validate a field the moment it's first left (even untouched-by-typing),
    // then keep validating live on every change after that.
    mode: 'onTouched',
    defaultValues: { name: '', months: '', distance: '' },
  });

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

  const onValid = handleSubmit((values) => {
    if (!car) return;
    const months = values.months.trim();
    const distance = values.distance.trim();
    addTrackedServiceItem(carId, {
      name: values.name.trim(),
      timeIntervalDays: months.length > 0 ? Math.round(Number(months) * 30.44) : null,
      kmInterval: distance.length > 0 ? Math.round(displayToKm(Number(distance), distanceUnit)) : null,
      isActive: true,
    });
    router.back();
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addTrackedItem.title') }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          insetBottom={insets.bottom}
          onCancel={() => router.back()}
          onSubmit={onValid}
          submitLabel={t('addTrackedItem.addItem')}
          submitDisabled={!isValid || !car}
        />
      </KeyboardAvoidingView>
    </Screen>
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
