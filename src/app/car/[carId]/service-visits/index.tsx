import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { getCarById, getServiceVisitsForCar } from '@/data/seed';
import { colors } from '@/theme/colors';

export default function ServiceVisitsScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const car = getCarById(carId);
  const visits = getServiceVisitsForCar(carId);
  const totalSpent = visits.reduce((sum, visit) => sum + visit.price, 0);
  const currency = visits[0]?.currency ?? 'RON';

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('serviceVisits.title'),
          headerRight: () => (
            <Link href={{ pathname: '/car/[carId]/service-visits/add', params: { carId } }} asChild>
              <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
                <Text style={styles.addButtonGlyph}>+</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {visits.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{totalSpent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>{t('serviceVisits.totalSpent', { currency })}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={[styles.statValue, styles.statValueNeutral]}>{visits.length}</Text>
            <Text style={styles.statLabel}>{t('serviceVisits.visits')}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>🔧</Text>
            <Text style={styles.emptyTitle}>{t('serviceVisits.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('serviceVisits.emptySubtitle')}</Text>
          </View>
        ) : (
          visits.map((visit) => (
            <View key={visit.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.shopName}>{visit.shopName}</Text>
                  <Text style={styles.visitMeta}>
                    {visit.odometer.toLocaleString()} {car ? t(`common.${car.unit}`) : t('common.km')} ·{' '}
                    {visit.dateLabel}
                  </Text>
                </View>
                <Text style={styles.price}>
                  {visit.price} {visit.currency}
                </Text>
              </View>
              {visit.itemNames.length > 0 && (
                <View style={styles.chipRow}>
                  {visit.itemNames.map((name) => (
                    <View key={name} style={styles.chip}>
                      <Text style={styles.chipText}>{name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statCell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statValue: {
    color: colors.amber,
    fontSize: 18,
    fontWeight: '700',
  },
  statValueNeutral: {
    color: colors.textPrimary,
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 4,
  },
  emptyGlyph: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.textFainter,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTopLeft: {
    gap: 3,
  },
  shopName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  visitMeta: {
    color: colors.textFaint,
    fontSize: 11,
  },
  price: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonGlyph: {
    color: colors.onAmber,
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
});
