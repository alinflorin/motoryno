import { Link, Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddCarCard, CarCard } from '@/components/CarCard';
import { CountBadge } from '@/components/CountBadge';
import { Icon } from '@/components/Icon';
import { ObdSyncButton } from '@/components/ObdSyncButton';
import { OverflowMenu } from '@/components/OverflowMenu';
import { Screen } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';
import { confirmAsync } from '@/utils/confirm';
import { translateItemName } from '@/utils/serviceItemNames';
import { getOverdueCountForCar, getOverdueItemsForCar } from '@/utils/serviceStatus';
import { distanceUnitFor } from '@/utils/units';

const CARD_MENU_WIDTH = 176;

interface OverdueAlert {
  id: string;
  carId: string;
  carNickname: string;
  itemName: string;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles } = useStyles(getStyles);
  const { loading, settings, cars, removeCar } = useStorage();
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<{ carId: string; top: number; left: number } | null>(null);
  const topBarTop = insets.top + 8;

  const hasPairedObd = cars.some((car) => car.obd !== null);

  const overdueAlerts = useMemo<OverdueAlert[]>(
    () =>
      cars.flatMap((car) =>
        getOverdueItemsForCar(car, settings.useUnknownServiceStatus).map((entry) => ({
          id: `${car.vin}-${entry.item.name}`,
          carId: car.vin,
          carNickname: car.displayName,
          itemName: translateItemName(t, entry.item.name),
        }))
      ),
    [cars, settings.useUnknownServiceStatus, t]
  );

  const confirmDeleteCar = async (carId: string, carNickname: string) => {
    const confirmed = await confirmAsync(
      t('home.deleteCar'),
      t('home.deleteCarConfirm', { car: carNickname }),
      t('common.delete'),
      t('common.cancel')
    );
    if (confirmed) removeCar(carId);
  };

  const openCardMenu = (carId: string, anchor: View) => {
    anchor.measureInWindow((x, y, width, height) => {
      setCardMenu({
        carId,
        top: y + height + 4,
        left: Math.max(8, x + width - CARD_MENU_WIDTH),
      });
    });
  };

  if (loading) return null;
  if (!settings.onboardingDone) return <Redirect href="/onboarding/welcome" />;

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: topBarTop }]}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoGlyph}>M</Text>
          </View>
          <Text style={styles.brandText}>{t('home.title')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menu')}
          onPress={() => setMenuOpen((open) => !open)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Icon name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <OverflowMenu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        top={topBarTop + 42}
        items={[{ key: 'settings', label: t('home.settings'), icon: 'settings-outline', onPress: () => router.push('/settings') }]}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {overdueAlerts.length > 0 && (
          <View style={styles.section}>
            <SectionLabel right={<CountBadge count={overdueAlerts.length} />}>{t('home.alerts')}</SectionLabel>
            <View style={styles.alertList}>
              {overdueAlerts.map((alert) => (
                <Link key={alert.id} href={{ pathname: '/car/[carId]', params: { carId: alert.carId } }} asChild>
                  <Pressable>
                    {({ pressed }) => (
                      <View style={[styles.alertRow, pressed && styles.cardPressed]}>
                        <View style={styles.alertDot} />
                        <Text style={styles.alertText}>
                          <Text style={styles.alertCar}>{alert.carNickname}</Text>
                          {' · ' + alert.itemName}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        )}

        {hasPairedObd && (
          <View style={styles.obdSync}>
            <ObdSyncButton />
          </View>
        )}

        <View style={styles.section}>
          <SectionLabel>{t('home.myCars')}</SectionLabel>
          <View style={styles.carGrid}>
            {cars.map((car) => (
              <CarCard
                key={car.vin}
                car={car}
                overdueCount={getOverdueCountForCar(car, settings.useUnknownServiceStatus)}
                distanceUnit={distanceUnit}
                onMenuPress={(anchor) => openCardMenu(car.vin, anchor)}
              />
            ))}
            <AddCarCard />
          </View>
        </View>
      </ScrollView>

      {cardMenu && (
        <OverflowMenu
          visible
          onDismiss={() => setCardMenu(null)}
          top={cardMenu.top}
          left={cardMenu.left}
          items={[
            {
              key: 'view',
              label: t('home.viewCar'),
              icon: 'eye-outline',
              onPress: () => router.push({ pathname: '/car/[carId]', params: { carId: cardMenu.carId } }),
            },
            {
              key: 'edit',
              label: t('home.editCar'),
              icon: 'create-outline',
              onPress: () => router.push({ pathname: '/car/[carId]/edit', params: { carId: cardMenu.carId } }),
            },
            {
              key: 'delete',
              label: t('home.deleteCar'),
              icon: 'trash-outline',
              onPress: () => {
                const car = cars.find((existing) => existing.vin === cardMenu.carId);
                confirmDeleteCar(cardMenu.carId, car?.displayName ?? cardMenu.carId);
              },
            },
          ]}
        />
      )}
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logoMark: {
      width: 28,
      height: 28,
      borderRadius: 7,
      backgroundColor: colors.amber,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoGlyph: {
      color: colors.onAmber,
      fontWeight: '800',
      fontSize: 15,
    },
    brandText: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonPressed: {
      backgroundColor: colors.surface,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 20,
    },
    section: {
      gap: 0,
    },
    alertList: {
      gap: 6,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.redBg,
      borderWidth: 1,
      borderColor: colors.redBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    alertDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.red,
    },
    alertText: {
      color: colors.redSoft,
      fontSize: 13,
      flex: 1,
    },
    alertCar: {
      color: colors.redSofter,
      fontWeight: '700',
    },
    obdSync: {
      marginHorizontal: 16,
      marginBottom: 20,
    },
    carGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cardPressed: {
      borderColor: colors.amberBorder,
    },
  });
}
