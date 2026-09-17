import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, radius, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

/**
 * Bordered surface panel. With `title`, a header strip is drawn above the
 * body; `padded` (default) gives the body the standard inset.
 */
export function Card({
  title,
  right,
  children,
  padded = true,
  style,
}: {
  title?: string;
  /** Trailing element in the header row, e.g. a small button or status text. */
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useStyles(getStyles);
  return (
    <View style={[styles.card, style]}>
      {title !== undefined && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      )}
      <View style={padded ? styles.body : undefined}>{children}</View>
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textSecondary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
    },
    body: {
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
  });
}
