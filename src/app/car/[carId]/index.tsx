import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { triggerObdSyncNow } from '@/ble/obdMonitorHandle';
import { Chevron } from '@/components/Chevron';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { StatusDot } from '@/components/StatusDot';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { formatDateDMY } from '@/utils/date';
import { translateItemName } from '@/utils/serviceItemNames';
import { computeCarItemStatuses, type ServiceItemStatus } from '@/utils/serviceStatus';
import { distanceUnitFor, formatDistance } from '@/utils/units';

const ATTENTION_PAGE_SIZE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export default function CarScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar } = useStorage();
  const car = getCar(carId);
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [attentionPageWidth, setAttentionPageWidth] = useState(0);
  const [attentionPageIndex, setAttentionPageIndex] = useState(0);

  const [obdSyncing, setObdSyncing] = useState(false);
  const obdSyncStartedAtRef = useRef<number | null>(null);

  const handleObdSyncNow = () => {
    if (!car || !triggerObdSyncNow(car.vin)) return;
    obdSyncStartedAtRef.current = Date.now();
    setObdSyncing(true);
  };

  // Clears the "syncing" state once this car actually re-syncs after the button was pressed -
  // `lastSyncedAt` advances on every completed attempt (success or not), see ObdMonitorController,
  // so this also resolves for an in-range-but-unreadable adapter.
  useEffect(() => {
    if (!obdSyncing || obdSyncStartedAtRef.current === null || !car) return;
    const startedAt = obdSyncStartedAtRef.current;
    if (car.obd?.lastSyncedAt !== null && car.obd?.lastSyncedAt !== undefined && car.obd.lastSyncedAt >= startedAt) {
      setObdSyncing(false);
      obdSyncStartedAtRef.current = null;
    }
  }, [car, obdSyncing]);

  // Safety net for when the adapter never comes into range at all - don't spin forever.
  useEffect(() => {
    if (!obdSyncing) return;
    const timer = setTimeout(() => setObdSyncing(false), 20000);
    return () => clearTimeout(timer);
  }, [obdSyncing]);

  if (!car) return null;

  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const itemStatuses = computeCarItemStatuses(car, settings.useUnknownServiceStatus);
  const overdueItems = itemStatuses.filter((entry) => entry.status === 'overdue');
  const dueSoonItems = itemStatuses.filter((entry) => entry.status === 'due-soon');
  const unknownItems = itemStatuses.filter((entry) => entry.status === 'unknown');
  const okCount = itemStatuses.length - overdueItems.length - dueSoonItems.length - unknownItems.length;

  const visits = [...car.serviceVisits].sort((a, b) => b.timestamp - a.timestamp);
  const totalSpent = visits.reduce((sum, visit) => sum + visit.spend, 0);
  const lastVisit = visits[0];
  const allAttentionItems = [...overdueItems, ...dueSoonItems];
  const attentionPages = chunk(allAttentionItems, ATTENTION_PAGE_SIZE);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${car.displayName} · ${car.model}` }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('car.odometer')}</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{formatDistance(car.odometerKm, distanceUnit)}</Text>
            <Text style={styles.heroUnit}>{t(`common.${distanceUnit}`)}</Text>
          </View>
          <Text style={styles.heroSubtitle}>
            {car.make} · {car.year}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: colors.red }]}>{overdueItems.length}</Text>
            <Text style={styles.statLabel}>{t('car.overdue')}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={[styles.statValue, { color: colors.yellow }]}>{dueSoonItems.length}</Text>
            <Text style={styles.statLabel}>{t('car.dueSoon')}</Text>
          </View>
          <View style={[styles.statCell, unknownItems.length > 0 && styles.statCellDivider]}>
            <Text style={[styles.statValue, { color: colors.emerald }]}>{okCount}</Text>
            <Text style={styles.statLabel}>{t('car.ok')}</Text>
          </View>
          {unknownItems.length > 0 && (
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.textFaint }]}>{unknownItems.length}</Text>
              <Text style={styles.statLabel}>{t('car.unknown')}</Text>
            </View>
          )}
        </View>

        {car.obd && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('car.obdSyncNow')}
            disabled={obdSyncing}
            onPress={handleObdSyncNow}
            style={({ pressed }) => [styles.obdSyncButton, pressed && styles.obdSyncButtonPressed]}
          >
            {obdSyncing ? (
              <>
                <ActivityIndicator size="small" color={colors.amber} />
                <Text style={styles.obdSyncButtonText}>{t('home.obdSyncing')}</Text>
              </>
            ) : (
              <>
                <Icon name="bluetooth-outline" size={16} color={colors.amber} />
                <Text style={styles.obdSyncButtonText}>{t('car.obdSyncNow')}</Text>
              </>
            )}
          </Pressable>
        )}

        {allAttentionItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('car.needsAttention')}</Text>
            <View onLayout={(event) => setAttentionPageWidth(event.nativeEvent.layout.width)}>
              {attentionPageWidth > 0 && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / attentionPageWidth);
                    setAttentionPageIndex(index);
                  }}
                >
                  {attentionPages.map((page, pageIndex) => (
                    <View key={pageIndex} style={[styles.attentionList, { width: attentionPageWidth }]}>
                      {page.map((entry) => (
                        <View key={entry.item.name} style={styles.attentionRow}>
                          <StatusDot status={entry.status} />
                          <Text style={styles.attentionName}>{translateItemName(t, entry.item.name)}</Text>
                          <Text style={[styles.attentionStatus, { color: statusTextColor(entry.status, colors) }]}>
                            {entry.status === 'overdue' ? t('car.overdue') : t('car.dueSoon')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
            {attentionPages.length > 1 && (
              <View style={styles.attentionDots}>
                {attentionPages.map((_, pageIndex) => (
                  <View
                    key={pageIndex}
                    style={[styles.attentionDot, pageIndex === attentionPageIndex && styles.attentionDotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>{t('car.trackedItems')}</Text>
            <Text style={styles.sectionCount}>
              {t('car.trackedItemsCount', { count: itemStatuses.length })}
            </Text>
          </View>
          <Link
            href={{ pathname: '/car/[carId]/tracked-items', params: { carId: car.vin } }}
            asChild
          >
            <Pressable style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
              <View style={styles.navRowLeft}>
                <StatusDot status={overdueItems.length > 0 ? 'overdue' : dueSoonItems.length > 0 ? 'due-soon' : 'ok'} />
                <Text style={styles.navRowText}>
                  {overdueItems.length > 0
                    ? t('car.itemsOverdue', { count: overdueItems.length })
                    : dueSoonItems.length > 0
                      ? t('car.itemsDueSoon', { count: dueSoonItems.length })
                      : t('car.allItemsOk')}
                </Text>
              </View>
              <View style={styles.navRowButton}>
                <Text style={styles.navRowButtonText}>{t('common.view')}</Text>
                <Chevron color={colors.onAmber} size={14} />
              </View>
            </Pressable>
          </Link>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>{t('car.serviceVisits')}</Text>
            <Text style={styles.sectionCount}>{t('car.visitsCount', { count: visits.length })}</Text>
          </View>
          <Link
            href={{ pathname: '/car/[carId]/service-visits', params: { carId: car.vin } }}
            asChild
          >
            <Pressable style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
              <View style={styles.navRowTextGroup}>
                <Text style={styles.navRowText}>
                  {lastVisit
                    ? t('car.lastVisit', { date: formatDateDMY(lastVisit.timestamp), shop: lastVisit.shopName })
                    : t('car.noVisitsLogged')}
                </Text>
                <Text style={styles.navRowSubtext}>
                  {t('car.totalSpent')}: {totalSpent.toLocaleString()} {settings.currency}
                </Text>
              </View>
              <View style={styles.navRowButton}>
                <Text style={styles.navRowButtonText}>{t('common.view')}</Text>
                <Chevron color={colors.onAmber} size={14} />
              </View>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

function statusTextColor(status: ServiceItemStatus, colors: ColorTokens) {
  return status === 'overdue' ? colors.red : colors.yellow;
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      paddingBottom: 32,
    },
    hero: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    heroLabel: {
      color: colors.textFaint,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    heroValueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
    },
    heroValue: {
      color: colors.amber,
      fontSize: 40,
      fontWeight: '700',
    },
    heroUnit: {
      color: colors.amber,
      opacity: 0.7,
      fontSize: 18,
      marginBottom: 6,
    },
    heroSubtitle: {
      color: colors.textFaint,
      fontSize: 13,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    statCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
    },
    statCellDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      borderRightColor: colors.border,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    statLabel: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 2,
    },
    obdSyncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      margin: 16,
      marginBottom: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.amberBorder,
      borderRadius: 12,
      paddingVertical: 12,
    },
    obdSyncButtonPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    obdSyncButtonText: {
      color: colors.amber,
      fontSize: 13,
      fontWeight: '700',
    },
    section: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sectionHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    sectionCount: {
      color: colors.textFaint,
      fontSize: 12,
    },
    attentionList: {
      gap: 6,
    },
    attentionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    attentionName: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    attentionStatus: {
      fontSize: 12,
      fontWeight: '600',
    },
    attentionDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    attentionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.borderStrong,
    },
    attentionDotActive: {
      width: 16,
      backgroundColor: colors.amber,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    navRowPressed: {
      borderColor: colors.amberBorder,
    },
    navRowLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    navRowTextGroup: {
      flex: 1,
      gap: 3,
    },
    navRowText: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    navRowSubtext: {
      color: colors.textFaint,
      fontSize: 11,
    },
    navRowButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      flexShrink: 0,
      flexGrow: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.amber,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    navRowButtonText: {
      color: colors.onAmber,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
