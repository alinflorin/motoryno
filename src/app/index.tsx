import { Link, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountBadge } from '@/components/CountBadge';
import { OverflowMenu } from '@/components/OverflowMenu';
import { Screen } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { distanceUnitFor, formatDistance } from '@/utils/units';
import { getOverdueCountForCar, getOverdueItemsForCar } from '@/utils/serviceStatus';

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
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { settings, cars, removeCar } = useStorage();
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<{ carId: string; top: number; left: number } | null>(null);
  const kebabRefs = useRef<Record<string, View | null>>({});
  const topBarTop = insets.top + 8;

  const overdueAlerts = useMemo<OverdueAlert[]>(
    () =>
      cars.flatMap((car) =>
        getOverdueItemsForCar(car).map((entry) => ({
          id: `${car.vin}-${entry.item.name}`,
          carId: car.vin,
          carNickname: car.displayName,
          itemName: entry.item.name,
        }))
      ),
    [cars]
  );

  const confirmDeleteCar = (carId: string, carNickname: string) => {
    Alert.alert(t('home.deleteCar'), t('home.deleteCarConfirm', { car: carNickname }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeCar(carId) },
    ]);
  };

  const openCardMenu = (carId: string) => {
    kebabRefs.current[carId]?.measureInWindow((x, y, width, height) => {
      setCardMenu({
        carId,
        top: y + height + 4,
        left: Math.max(8, x + width - CARD_MENU_WIDTH),
      });
    });
  };

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: topBarTop }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.title')}
          onPress={() => router.push('/')}
          style={styles.brand}
        >
          <View style={styles.logoMark}>
            <Text style={styles.logoGlyph}>M</Text>
          </View>
          <Text style={styles.brandText}>{t('home.title')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menu')}
          onPress={() => setMenuOpen((open) => !open)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Text style={styles.iconGlyph}>⋮</Text>
        </Pressable>
      </View>

      <OverflowMenu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        top={topBarTop + 42}
        items={[
          { key: 'settings', label: t('home.settings'), glyph: '⚙︎', onPress: () => router.push('/settings') },
          { key: 'about', label: t('home.about'), glyph: 'ⓘ', onPress: () => router.push('/about') },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {overdueAlerts.length > 0 && (
          <View style={styles.section}>
            <SectionLabel right={<CountBadge count={overdueAlerts.length} />}>
              {t('home.alerts')}
            </SectionLabel>
            <View style={styles.alertList}>
              {overdueAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={{ pathname: '/car/[carId]', params: { carId: alert.carId } }}
                  asChild
                >
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

        <View style={styles.section}>
          <SectionLabel>{t('home.myCars')}</SectionLabel>
          <View style={styles.carGrid}>
            {cars.map((car) => {
              const overdueCount = getOverdueCountForCar(car);
              return (
                <Link
                  key={car.vin}
                  href={{ pathname: '/car/[carId]', params: { carId: car.vin } }}
                  asChild
                >
                  <Pressable style={styles.cardHit}>
                    {({ pressed }) => (
                      <View style={[styles.carCard, pressed && styles.cardPressed]}>
                        <View style={styles.carCardTop}>
                          <Text style={styles.carNickname}>{car.displayName}</Text>
                          <View style={styles.carCardTopRight}>
                            {overdueCount > 0 && <CountBadge count={overdueCount} />}
                            <Pressable
                              ref={(node) => {
                                kebabRefs.current[car.vin] = node;
                              }}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={t('home.menu')}
                              onPress={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openCardMenu(car.vin);
                              }}
                              style={styles.cardKebab}
                            >
                              <Text style={styles.cardKebabGlyph}>⋮</Text>
                            </Pressable>
                          </View>
                        </View>
                        <Text style={styles.carMake}>{car.make}</Text>
                        <Text style={styles.carModel}>
                          {car.model} · {car.year}
                        </Text>
                        <Text style={styles.carOdometer}>
                          {formatDistance(car.odometerKm, distanceUnit)} {t(`common.${distanceUnit}`)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </Link>
              );
            })}

            <Link href="/add-car" asChild>
              <Pressable style={styles.cardHit}>
                {({ pressed }) => (
                  <View style={[styles.addCarCard, pressed && styles.cardPressed]}>
                    <View style={styles.addCarPlus}>
                      <Text style={styles.addCarPlusGlyph}>+</Text>
                    </View>
                    <Text style={styles.addCarLabel}>{t('home.addCar')}</Text>
                  </View>
                )}
              </Pressable>
            </Link>
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
              glyph: '⌕',
              onPress: () => router.push({ pathname: '/car/[carId]', params: { carId: cardMenu.carId } }),
            },
            {
              key: 'edit',
              label: t('home.editCar'),
              glyph: '✎',
              onPress: () => router.push({ pathname: '/car/[carId]/edit', params: { carId: cardMenu.carId } }),
            },
            {
              key: 'delete',
              label: t('home.deleteCar'),
              glyph: '⌫',
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
  iconGlyph: {
    color: colors.textMuted,
    fontSize: 18,
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
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardHit: {
    width: '48%',
  },
  carCard: {
    minHeight: 132,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    padding: 14,
    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: {
    borderColor: colors.amberBorder,
  },
  carCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  carCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardKebab: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
    marginTop: -4,
  },
  cardKebabGlyph: {
    color: colors.textFaint,
    fontSize: 16,
  },
  carNickname: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  carMake: {
    color: colors.textFaint,
    fontSize: 11,
    marginBottom: 10,
  },
  carModel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  carOdometer: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: '600',
  },
  addCarCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addCarPlus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCarPlusGlyph: {
    color: colors.textFaint,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  addCarLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  });
}
