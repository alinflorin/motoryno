import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export function OnboardingFooter({
  onSkip,
  onNext,
  nextLabel,
  insetBottom,
}: {
  onSkip?: () => void;
  onNext: () => void;
  nextLabel?: string;
  insetBottom: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={[styles.row, { paddingBottom: Math.max(14, insetBottom) }]}>
      <Pressable
        onPress={onSkip}
        disabled={!onSkip}
        style={({ pressed }) => [styles.half, pressed && onSkip && styles.pressed]}
      >
        <Text style={[styles.skipText, !onSkip && styles.hidden]}>{t('onboarding.skip')}</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable onPress={onNext} style={({ pressed }) => [styles.half, pressed && styles.pressed]}>
        <Text style={styles.nextText}>{nextLabel ?? t('onboarding.next')}</Text>
      </Pressable>
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 6,
    },
    half: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    pressed: {
      backgroundColor: colors.surface,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
    skipText: {
      color: colors.textFaint,
      fontSize: 14,
      fontWeight: '600',
    },
    hidden: {
      opacity: 0,
    },
    nextText: {
      color: colors.amber,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
