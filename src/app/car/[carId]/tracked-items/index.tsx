import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { StatusDot } from '@/components/StatusDot';
import { DEFAULT_TRACKED_SERVICE_ITEMS, useStorage, type TrackedServiceItem } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { computeCarItemStatuses, formatIntervalLabel, formatSinceLabel, type ServiceItemStatus, type TrackedItemStatus } from '@/utils/serviceStatus';

export default function TrackedItemsScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { getCar, addTrackedServiceItem, removeTrackedServiceItem } = useStorage();
  const car = getCar(carId);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!car) return null;

  const itemStatuses = computeCarItemStatuses(car);
  const trackedNames = new Set(car.trackedServiceItems.map((item) => item.name));
  // The default catalog is the whole "known items" list a car can toggle
  // back on — a custom item added via "+" only reappears here once tracked.
  const availableItems: TrackedServiceItem[] = DEFAULT_TRACKED_SERVICE_ITEMS.filter(
    (item) => !trackedNames.has(item.name)
  );

  const groups: { key: ServiceItemStatus; title: string; data: TrackedItemStatus[] }[] = [
    { key: 'overdue', title: t('trackedItems.overdueGroup'), data: itemStatuses.filter((i) => i.status === 'overdue') },
    { key: 'due-soon', title: t('trackedItems.dueSoonGroup'), data: itemStatuses.filter((i) => i.status === 'due-soon') },
    { key: 'ok', title: t('trackedItems.okGroup'), data: itemStatuses.filter((i) => i.status === 'ok') },
  ];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('trackedItems.title'),
          headerRight: () => (
            <Link href={{ pathname: '/car/[carId]/tracked-items/add', params: { carId } }} asChild>
              <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
                <Text style={styles.addButtonGlyph}>+</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((group) =>
          group.data.length === 0 ? null : (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupTitle, { color: groupTitleColor(group.key, colors) }]}>{group.title}</Text>
              <View style={styles.groupList}>
                {group.data.map((entry) => (
                  <View key={entry.item.name} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTopLeft}>
                        <StatusDot status={entry.status} />
                        <Text style={styles.itemName}>{entry.item.name}</Text>
                      </View>
                      <Switch
                        value
                        onValueChange={(value) => {
                          // The stored tracking list only holds active items — turning
                          // this off means "stop tracking", not a persisted flag.
                          if (!value) removeTrackedServiceItem(car.vin, entry.item.name);
                        }}
                        trackColor={{ true: colors.amber, false: colors.borderStrong }}
                        thumbColor={colors.textPrimary}
                      />
                    </View>
                    <ProgressBar progress={entry.progress} status={entry.status} />
                    <View style={styles.cardBottom}>
                      <Text style={styles.intervalText}>
                        {t('trackedItems.every', { interval: formatIntervalLabel(entry.item) })}
                      </Text>
                      <Text style={styles.sinceText}>{formatSinceLabel(entry, car)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ),
        )}

        {availableItems.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textFaint }]}>
              {t('trackedItems.availableGroup')}
            </Text>
            <View style={styles.groupList}>
              {availableItems.map((item) => (
                <View key={item.name} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <Switch
                      value={false}
                      onValueChange={(value) => {
                        if (value) addTrackedServiceItem(car.vin, item);
                      }}
                      trackColor={{ true: colors.amber, false: colors.borderStrong }}
                      thumbColor={colors.textPrimary}
                    />
                  </View>
                  <Text style={styles.intervalText}>
                    {t('trackedItems.every', { interval: formatIntervalLabel(item) })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function groupTitleColor(status: ServiceItemStatus, colors: ColorTokens) {
  if (status === 'overdue') return colors.red;
  if (status === 'due-soon') return colors.yellow;
  return colors.emerald;
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 20,
      paddingBottom: 32,
    },
    group: {
      gap: 8,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    groupList: {
      gap: 8,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTopLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    itemName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    intervalText: {
      color: colors.textFainter,
      fontSize: 11,
    },
    sinceText: {
      color: colors.textFaint,
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
}
