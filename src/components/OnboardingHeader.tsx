import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export function OnboardingHeader({ title, right }: { title: string; right?: ReactNode }) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoGlyph}>M</Text>
          </View>
          <Text style={styles.brandText}>Motoryno</Text>
        </View>
        {right}
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 14,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    title: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
  });
}
