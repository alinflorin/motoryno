import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { formatDateDMY } from '@/utils/date';
import { translateItemName } from '@/utils/serviceItemNames';
import { distanceUnitFor, formatDistance } from '@/utils/units';

export default function ServiceVisitsScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar } = useStorage();
  const car = getCar(carId);
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const visits = [...(car?.serviceVisits ?? [])].sort((a, b) => b.timestamp - a.timestamp);
  const totalSpent = visits.reduce((sum, visit) => sum + visit.spend, 0);
  const currency = settings.currency;
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('serviceVisits.title'),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <Link href={{ pathname: '/car/[carId]/service-visits/add', params: { carId } }} asChild>
                <Pressable hitSlop={8} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
                  <Icon name="add" size={26} color={colors.amber} />
                </Pressable>
              </Link>
            </View>
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
            <Icon name="construct-outline" size={32} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{t('serviceVisits.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('serviceVisits.emptySubtitle')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>{t('serviceVisits.hint')}</Text>
            {visits.map((visit) => (
              <Link
                key={visit.uuid}
                href={{ pathname: '/car/[carId]/service-visits/[visitId]/edit', params: { carId, visitId: visit.uuid } }}
                asChild
              >
                <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      <Text style={styles.shopName}>{visit.shopName}</Text>
                      <Text style={styles.visitMeta}>
                        {formatDistance(visit.odometerKm, distanceUnit)} {t(`common.${distanceUnit}`)} ·{' '}
                        {formatDateDMY(visit.timestamp)}
                      </Text>
                    </View>
                    <Text style={styles.price}>
                      {visit.spend} {currency}
                    </Text>
                  </View>
                  {visit.itemsDone.length > 0 && (
                    <View style={styles.chipRow}>
                      {visit.itemsDone.map((name) => (
                        <View key={name} style={styles.chip}>
                          <Text style={styles.chipText}>{translateItemName(t, name)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {visit.comments && (
                    <Text style={styles.comments} numberOfLines={2}>
                      {visit.comments}
                    </Text>
                  )}
                </Pressable>
              </Link>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    emptyTitle: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    emptySubtitle: {
      color: colors.textFainter,
      fontSize: 13,
    },
    hint: {
      color: colors.textFainter,
      fontSize: 12,
      marginBottom: -2,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    cardPressed: {
      opacity: 0.85,
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
    comments: {
      color: colors.textFaint,
      fontSize: 12,
    },
    headerRightContainer: {
      paddingRight: 16,
    },
    addButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonPressed: {
      opacity: 0.5,
    },
  });
}
