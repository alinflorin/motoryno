import { Link } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CountBadge } from '@/components/CountBadge';
import { Icon } from '@/components/Icon';
import type { Car } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';
import { formatDistance, type DistanceUnit } from '@/utils/units';

/**
 * One car tile on the home grid: opens the car on tap, with an overdue
 * badge and a kebab that hands its own on-screen anchor to `onMenuPress`
 * so the caller can position a menu next to it.
 */
export function CarCard({
  car,
  overdueCount,
  distanceUnit,
  onMenuPress,
}: {
  car: Car;
  overdueCount: number;
  distanceUnit: DistanceUnit;
  onMenuPress: (anchor: View) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useStyles(getStyles);
  const kebabRef = useRef<View>(null);

  return (
    <Link href={{ pathname: '/car/[carId]', params: { carId: car.vin } }} asChild>
      <Pressable style={styles.hit}>
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.cardPressed]}>
            <View style={styles.top}>
              <Text style={styles.nickname}>{car.displayName}</Text>
              <View style={styles.topRight}>
                {overdueCount > 0 && <CountBadge count={overdueCount} />}
                <Pressable
                  ref={kebabRef}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.menu')}
                  onPress={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (kebabRef.current) onMenuPress(kebabRef.current);
                  }}
                  style={styles.kebab}
                >
                  <Icon name="ellipsis-vertical" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.make}>{car.make}</Text>
            <Text style={styles.model}>
              {car.model} · {car.year}
            </Text>
            <Text style={styles.odometer}>
              {formatDistance(car.odometerKm, distanceUnit)} {t(`common.${distanceUnit}`)}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** The dashed "add a car" tile that closes the home grid. */
export function AddCarCard() {
  const { t } = useTranslation();
  const { colors, styles } = useStyles(getStyles);

  return (
    <Link href="/add-car" asChild>
      <Pressable style={styles.hit}>
        {({ pressed }) => (
          <View style={[styles.addCard, pressed && styles.cardPressed]}>
            <View style={styles.addPlus}>
              <Icon name="add" size={20} color={colors.textFaint} />
            </View>
            <Text style={styles.addLabel}>{t('home.addCar')}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function getStyles(colors: ColorTokens) {
  const card = {
    minHeight: 132,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    padding: 14,
    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.25)',
    elevation: 2,
  } as const;

  return StyleSheet.create({
    hit: {
      width: '48%',
    },
    card,
    cardPressed: {
      borderColor: colors.amberBorder,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    topRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    kebab: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: -6,
      marginTop: -4,
    },
    nickname: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    make: {
      color: colors.textFaint,
      fontSize: 11,
      marginBottom: 10,
    },
    model: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    odometer: {
      color: colors.amber,
      fontSize: 14,
      fontWeight: '600',
    },
    addCard: {
      ...card,
      alignItems: 'center',
      justifyContent: 'center',
      borderStyle: 'dashed',
      gap: 10,
    },
    addPlus: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
