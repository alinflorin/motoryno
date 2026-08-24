import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { getCarById } from '@/data/seed';
import { colors } from '@/theme/colors';
import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';

export default function AddTrackedItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const car = getCarById(carId);

  const [name, setName] = useState('');
  const [months, setMonths] = useState('');
  const [distance, setDistance] = useState('');

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addTrackedItem.title') }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FormField label={t('addTrackedItem.itemName')}>
            <TextInput
              style={styles.input}
              placeholder={t('addTrackedItem.itemNamePlaceholder')}
              placeholderTextColor={colors.textFainter}
              value={name}
              onChangeText={setName}
            />
          </FormField>

          <FormField label={t('addTrackedItem.interval')}>
            <View style={styles.intervalRow}>
              <View style={styles.intervalField}>
                <TextInput
                  style={styles.input}
                  placeholder="12"
                  placeholderTextColor={colors.textFainter}
                  keyboardType="number-pad"
                  value={months}
                  onChangeText={setMonths}
                />
                <Text style={styles.inputSuffix}>{t('addTrackedItem.months')}</Text>
              </View>
              <Text style={styles.orLabel}>{t('addTrackedItem.or')}</Text>
              <View style={styles.intervalField}>
                <TextInput
                  style={styles.input}
                  placeholder="10000"
                  placeholderTextColor={colors.textFainter}
                  keyboardType="number-pad"
                  value={distance}
                  onChangeText={setDistance}
                />
                <Text style={styles.inputSuffix}>{car ? t(`common.${car.unit}`) : t('common.km')}</Text>
              </View>
            </View>
          </FormField>
        </ScrollView>
        <FormButtonRow
          insetBottom={insets.bottom}
          onCancel={() => router.back()}
          onSubmit={() => router.back()}
          submitLabel={t('addTrackedItem.addItem')}
          submitDisabled={name.trim().length === 0}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
