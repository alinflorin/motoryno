import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { displayToKm, distanceUnitFor, formatDistance } from '@/utils/units';
import { sanitizeDateInput } from '@/utils/validation';

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

  const [shop, setShop] = useState('');
  const [date, setDate] = useState('');
  const [odometer, setOdometer] = useState(car ? formatDistance(car.odometerKm, distanceUnit) : '');
  const [price, setPrice] = useState('');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const toggleItem = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const dateError = date.trim().length > 0 && parseDateDMY(date) === null ? t('addServiceVisit.dateInvalid') : undefined;
  const odometerKm = Math.round(displayToKm(Number(odometer) || 0, distanceUnit));
  const odometerError =
    car && odometer.trim().length > 0 && odometerKm < car.odometerKm
      ? t('addServiceVisit.odometerTooLow', {
          odometer: `${formatDistance(car.odometerKm, distanceUnit)} ${t(`common.${distanceUnit}`)}`,
        })
      : undefined;
  const priceValue = Number(price);
  const priceError = price.trim().length > 0 && !Number.isFinite(priceValue) ? t('addServiceVisit.amountInvalid') : undefined;
  const isValid =
    !!car &&
    shop.trim().length > 0 &&
    odometer.trim().length > 0 &&
    !dateError &&
    !odometerError &&
    !priceError;

  const handleSubmit = () => {
    if (!isValid || !car) return;

    addServiceVisit(car.vin, {
      timestamp: parseDateDMYOrNow(date),
      odometerKm,
      shopName: shop.trim(),
      spend: Number.isFinite(priceValue) ? priceValue : 0,
      itemsDone: [...selectedNames],
    });
    if (odometerKm > car.odometerKm) {
      setCarOdometer(car.vin, odometerKm);
    }
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('addServiceVisit.title') }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FormField label={t('addServiceVisit.shop')}>
            <TextInput
              style={styles.input}
              placeholder={t('addServiceVisit.shopPlaceholder')}
              placeholderTextColor={colors.textFainter}
              value={shop}
              onChangeText={setShop}
            />
          </FormField>

          <View style={styles.twoCol}>
            <View style={styles.twoColItem}>
              <FormField label={t('addServiceVisit.date')} error={dateError}>
                <TextInput
                  style={styles.input}
                  placeholder="DD.MM.YYYY"
                  placeholderTextColor={colors.textFainter}
                  keyboardType="number-pad"
                  value={date}
                  onChangeText={(text) => setDate(sanitizeDateInput(text))}
                />
              </FormField>
            </View>
            <View style={styles.twoColItem}>
              <FormField label={t('addServiceVisit.odometer')} error={odometerError}>
                <View style={styles.suffixField}>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={odometer}
                    onChangeText={(text) => setOdometer(sanitizeIntegerInput(text))}
                  />
                  <Text style={styles.inputSuffix}>{t(`common.${distanceUnit}`)}</Text>
                </View>
              </FormField>
            </View>
          </View>

          <FormField label={t('addServiceVisit.amountSpent')} error={priceError}>
            <View style={styles.suffixField}>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textFainter}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={(text) => setPrice(sanitizeDecimalInput(text))}
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
          onSubmit={handleSubmit}
          submitLabel={t('addServiceVisit.saveVisit')}
          submitDisabled={!isValid}
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
