import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormButtonRow } from '@/components/FormButtonRow';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { StatusDot } from '@/components/StatusDot';
import { getCarById, getTrackedItemsForCar } from '@/data/seed';
import { colors } from '@/theme/colors';

export default function AddServiceVisitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const car = getCarById(carId);
  const items = getTrackedItemsForCar(carId);

  const [shop, setShop] = useState('');
  const [date, setDate] = useState('');
  const [odometer, setOdometer] = useState(car ? String(car.odometer) : '');
  const [price, setPrice] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
              <FormField label={t('addServiceVisit.date')}>
                <TextInput
                  style={styles.input}
                  placeholder="DD.MM.YYYY"
                  placeholderTextColor={colors.textFainter}
                  value={date}
                  onChangeText={setDate}
                />
              </FormField>
            </View>
            <View style={styles.twoColItem}>
              <FormField label={t('addServiceVisit.odometer')}>
                <View style={styles.suffixField}>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={odometer}
                    onChangeText={setOdometer}
                  />
                  <Text style={styles.inputSuffix}>{car ? t(`common.${car.unit}`) : t('common.km')}</Text>
                </View>
              </FormField>
            </View>
          </View>

          <FormField label={t('addServiceVisit.amountSpent')}>
            <View style={styles.suffixField}>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textFainter}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
              <Text style={styles.inputSuffix}>RON</Text>
            </View>
          </FormField>

          <FormField label={t('addServiceVisit.itemsPerformed')}>
            <View style={styles.itemList}>
              {items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleItem(item.id)}
                    style={[styles.itemRow, selected && styles.itemRowSelected]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.itemRowText}>{item.name}</Text>
                    <StatusDot status={item.status} />
                  </Pressable>
                );
              })}
            </View>
          </FormField>
        </ScrollView>
        <FormButtonRow
          insetBottom={insets.bottom}
          onCancel={() => router.back()}
          onSubmit={() => router.back()}
          submitLabel={t('addServiceVisit.saveVisit')}
          submitDisabled={shop.trim().length === 0}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
