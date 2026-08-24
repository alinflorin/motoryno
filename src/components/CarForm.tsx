import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import { colors } from '@/theme/colors';
import type { Car, DistanceUnit } from '@/types/models';

export interface CarFormValues {
  nickname: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
  unit: DistanceUnit;
  vin: string;
}

function carToFormValues(car?: Car): CarFormValues {
  return {
    nickname: car?.nickname ?? '',
    make: car?.make ?? '',
    model: car?.model ?? '',
    year: car ? String(car.year) : '',
    odometer: car ? String(car.odometer) : '',
    unit: car?.unit ?? 'km',
    vin: car?.vin ?? '',
  };
}

export function useCarFormState(car?: Car) {
  const [values, setValues] = useState<CarFormValues>(() => carToFormValues(car));

  const setField = <K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return { values, setField };
}

/** The form's fields only — no submit chrome, so callers can supply their own footer. */
export function CarFormFields({
  values,
  setField,
}: {
  values: CarFormValues;
  setField: <K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) => void;
}) {
  const { t } = useTranslation();

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
              value={values.year}
              onChangeText={(text) => setField('year', text)}
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
                onChangeText={(text) => setField('odometer', text)}
              />
              <Text style={styles.inputSuffix}>{t(`common.${values.unit}`)}</Text>
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
  onCancel,
  onSubmit,
  submitLabel,
  insetBottom,
}: {
  car?: Car;
  onCancel: () => void;
  onSubmit: (values: CarFormValues) => void;
  submitLabel: string;
  insetBottom: number;
}) {
  const { values, setField } = useCarFormState(car);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CarFormFields values={values} setField={setField} />
      </ScrollView>
      <FormButtonRow
        insetBottom={insetBottom}
        onCancel={onCancel}
        onSubmit={() => onSubmit(values)}
        submitLabel={submitLabel}
        submitDisabled={values.nickname.trim().length === 0}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
