import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { formatDateDMY } from '@/utils/date';
import { formatSinceLabel, getOverdueItemsForCar } from '@/utils/serviceStatus';

export default function CarStatsScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { getCar } = useStorage();
  const car = getCar(carId);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!car) return null;

  const visits = [...car.serviceVisits].sort((a, b) => a.timestamp - b.timestamp);
  const overdueItems = getOverdueItemsForCar(car);
  const maxPrice = Math.max(1, ...visits.map((visit) => visit.spend));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('carStats.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}>
          <Text style={styles.downloadButtonText}>{t('carStats.downloadReport')}</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('carStats.spendHistory')}</Text>
          {visits.length === 0 ? (
            <Text style={styles.emptyText}>{t('car.noVisitsYet')}</Text>
          ) : (
            <View style={styles.chart}>
              {visits.map((visit) => (
                <View key={visit.uuid} style={styles.chartBarColumn}>
                  <View style={[styles.chartBar, { height: Math.max(8, (visit.spend / maxPrice) * 96) }]} />
                  <Text style={styles.chartBarLabel}>{formatDateDMY(visit.timestamp).slice(0, 5)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('carStats.overdueHistory')}</Text>
          {overdueItems.length === 0 ? (
            <Text style={styles.emptyText}>{t('car.allItemsOk')}</Text>
          ) : (
            <View style={styles.overdueList}>
              {overdueItems.map((entry) => (
                <View key={entry.item.name} style={styles.overdueRow}>
                  <Text style={styles.overdueName}>{entry.item.name}</Text>
                  <Text style={styles.overdueMeta}>{formatSinceLabel(entry, car)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 24,
      paddingBottom: 32,
    },
    downloadButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    downloadButtonPressed: {
      borderColor: colors.amberBorder,
    },
    downloadButtonText: {
      color: colors.amber,
      fontSize: 13,
      fontWeight: '700',
    },
    section: {
      gap: 10,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyText: {
      color: colors.textFainter,
      fontSize: 13,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      height: 110,
    },
    chartBarColumn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    chartBar: {
      width: '100%',
      borderRadius: 3,
      backgroundColor: colors.amber,
      opacity: 0.85,
    },
    chartBarLabel: {
      color: colors.textFainter,
      fontSize: 10,
    },
    overdueList: {
      gap: 6,
    },
    overdueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    overdueName: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    overdueMeta: {
      color: colors.red,
      fontSize: 11,
      fontWeight: '600',
    },
  });
}
