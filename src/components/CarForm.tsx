import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import type { Car } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { sanitizeIntegerInput } from '@/utils/numericInput';
import { displayToKm, formatDistance, type DistanceUnit } from '@/utils/units';

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

/** Converts form text back into storage-ready values, or null if required fields are missing/invalid. */
export function parseCarFormValues(values: CarFormValues, distanceUnit: DistanceUnit): ParsedCarFormValues | null {
  const vin = values.vin.trim();
  const displayName = values.nickname.trim();
  if (!vin || !displayName) return null;

  const year = Number(values.year);
  const odometer = Number(values.odometer);
  return {
    vin,
    displayName,
    make: values.make.trim(),
    model: values.model.trim(),
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    odometerKm: Math.round(displayToKm(Number.isFinite(odometer) ? odometer : 0, distanceUnit)),
  };
}

export function useCarFormState(car: Car | undefined, distanceUnit: DistanceUnit) {
  const [values, setValues] = useState<CarFormValues>(() => carToFormValues(car, distanceUnit));

  const setField = <K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return { values, setField };
}

/** The form's fields only — no submit chrome, so callers can supply their own footer. */
export function CarFormFields({
  values,
  setField,
  distanceUnit,
}: {
  values: CarFormValues;
  setField: <K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) => void;
  distanceUnit: DistanceUnit;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

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

      <FormField label={t('carForm.nickname')}>
        <TextInput
          style={styles.input}
          placeholder={t('carForm.nicknamePlaceholder')}
          placeholderTextColor={colors.textFainter}
          value={values.nickname}
          onChangeText={(text) => setField('nickname', text)}
        />
      </FormField>

      <FormField label={t('carForm.make')}>
        <TextInput
          style={styles.input}
          placeholder={t('carForm.makePlaceholder')}
          placeholderTextColor={colors.textFainter}
          value={values.make}
          onChangeText={(text) => setField('make', text)}
        />
      </FormField>

      <FormField label={t('carForm.model')}>
        <TextInput
          style={styles.input}
          placeholder={t('carForm.modelPlaceholder')}
          placeholderTextColor={colors.textFainter}
          value={values.model}
          onChangeText={(text) => setField('model', text)}
        />
      </FormField>

      <View style={styles.twoCol}>
        <View style={styles.twoColItem}>
          <FormField label={t('carForm.year')}>
            <TextInput
              style={styles.input}
              placeholder="2019"
              placeholderTextColor={colors.textFainter}
              keyboardType="number-pad"
              maxLength={4}
              value={values.year}
              onChangeText={(text) => setField('year', sanitizeIntegerInput(text))}
            />
          </FormField>
        </View>
        <View style={styles.twoColItem}>
          <FormField label={t('carForm.odometer')}>
            <View style={styles.suffixField}>
              <TextInput
                style={[styles.input, styles.suffixInput]}
                placeholder="0"
                placeholderTextColor={colors.textFainter}
                keyboardType="number-pad"
                value={values.odometer}
                onChangeText={(text) => setField('odometer', sanitizeIntegerInput(text))}
              />
              <Text style={styles.inputSuffix}>{t(`common.${distanceUnit}`)}</Text>
            </View>
          </FormField>
        </View>
      </View>

      <FormField label={t('carForm.vin')}>
        <TextInput
          style={styles.input}
          placeholder={t('carForm.vinPlaceholder')}
          placeholderTextColor={colors.textFainter}
          autoCapitalize="characters"
          value={values.vin}
          onChangeText={(text) => setField('vin', text)}
        />
      </FormField>
    </>
  );
}

export function CarForm({
  car,
  distanceUnit,
  onCancel,
  onSubmit,
  submitLabel,
  insetBottom,
}: {
  car?: Car;
  distanceUnit: DistanceUnit;
  onCancel: () => void;
  onSubmit: (values: CarFormValues) => void;
  submitLabel: string;
  insetBottom: number;
}) {
  const { values, setField } = useCarFormState(car, distanceUnit);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CarFormFields values={values} setField={setField} distanceUnit={distanceUnit} />
      </ScrollView>
      <FormButtonRow
        insetBottom={insetBottom}
        onCancel={onCancel}
        onSubmit={() => onSubmit(values)}
        submitLabel={submitLabel}
        submitDisabled={values.nickname.trim().length === 0 || values.vin.trim().length === 0}
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
