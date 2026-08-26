import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { StatusDot } from '@/components/StatusDot';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { translateItemName } from '@/utils/serviceItemNames';
import { computeCarItemStatuses, formatIntervalLabel, formatSinceLabel, type ServiceItemStatus, type TrackedItemStatus } from '@/utils/serviceStatus';

export default function TrackedItemsScreen() {
  const { t } = useTranslation();
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const { settings, getCar, updateTrackedServiceItem } = useStorage();
  const car = getCar(carId);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!car) return null;

  // computeCarItemStatuses already only considers isActive items.
  const itemStatuses = computeCarItemStatuses(car, settings.useUnknownServiceStatus);
  const inactiveItems = car.trackedServiceItems.filter((item) => !item.isActive);

  const groups: { key: ServiceItemStatus; title: string; data: TrackedItemStatus[] }[] = [
    { key: 'overdue', title: t('trackedItems.overdueGroup'), data: itemStatuses.filter((i) => i.status === 'overdue') },
    { key: 'due-soon', title: t('trackedItems.dueSoonGroup'), data: itemStatuses.filter((i) => i.status === 'due-soon') },
    { key: 'ok', title: t('trackedItems.okGroup'), data: itemStatuses.filter((i) => i.status === 'ok') },
    { key: 'unknown', title: t('trackedItems.unknownGroup'), data: itemStatuses.filter((i) => i.status === 'unknown') },
  ];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('trackedItems.title'),
          headerRight: () => (
            <HeaderIconButton
              name="add"
              size={26}
              color={colors.amber}
              href={{ pathname: '/car/[carId]/tracked-items/add', params: { carId } }}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(itemStatuses.length > 0 || inactiveItems.length > 0) && (
          <Text style={styles.hint}>{t('trackedItems.hint')}</Text>
        )}
        {groups.map((group) =>
          group.data.length === 0 ? null : (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupTitle, { color: groupTitleColor(group.key, colors) }]}>{group.title}</Text>
              <View style={styles.groupList}>
                {group.data.map((entry) => (
                  <Link
                    key={entry.item.name}
                    href={{ pathname: '/car/[carId]/tracked-items/[itemName]/edit', params: { carId, itemName: entry.item.name } }}
                    asChild
                  >
                    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardTopLeft}>
                          <StatusDot status={entry.status} />
                          <Text style={styles.itemName}>{translateItemName(t, entry.item.name)}</Text>
                        </View>
                        <Switch
                          value={entry.item.isActive}
                          onValueChange={(value) => updateTrackedServiceItem(car.vin, entry.item.name, { isActive: value })}
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
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          ),
        )}

        {inactiveItems.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textFaint }]}>
              {t('trackedItems.availableGroup')}
            </Text>
            <View style={styles.groupList}>
              {inactiveItems.map((item) => (
                <Link
                  key={item.name}
                  href={{ pathname: '/car/[carId]/tracked-items/[itemName]/edit', params: { carId, itemName: item.name } }}
                  asChild
                >
                  <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTopLeft}>
                        <Text style={styles.itemName}>{translateItemName(t, item.name)}</Text>
                      </View>
                      <Switch
                        value={false}
                        onValueChange={(value) => updateTrackedServiceItem(car.vin, item.name, { isActive: value })}
                        trackColor={{ true: colors.amber, false: colors.borderStrong }}
                        thumbColor={colors.textPrimary}
                      />
                    </View>
                    <Text style={styles.intervalText}>
                      {t('trackedItems.every', { interval: formatIntervalLabel(item) })}
                    </Text>
                  </Pressable>
                </Link>
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
  if (status === 'unknown') return colors.textFaint;
  return colors.emerald;
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 20,
      paddingBottom: 32,
    },
    hint: {
      color: colors.textFainter,
      fontSize: 12,
      marginTop: -8,
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
    cardPressed: {
      opacity: 0.85,
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
  });
}
