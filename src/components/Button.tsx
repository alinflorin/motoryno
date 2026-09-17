import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, radius, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary = filled amber; secondary = neutral outline; accent = amber outline on surface; danger = filled red; ghost = text only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner in place of the leading icon and disables the button. */
  loading?: boolean;
  /** Leading icon element, rendered before the label. */
  icon?: ReactNode;
  /** Stretch to fill the row (default) or hug the label. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's one button. Every tappable "do something" control goes through
 * this so sizing, radii, pressed/disabled feedback and the loading state
 * look the same everywhere.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors, styles } = useStyles(getStyles);
  const inactive = disabled || loading;
  const textColor = TEXT_COLOR[variant](colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        !fullWidth && styles.hug,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : icon ? <View>{icon}</View> : null}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const TEXT_COLOR: Record<ButtonVariant, (colors: ColorTokens) => string> = {
  primary: (c) => c.onAmber,
  secondary: (c) => c.textSecondary,
  accent: (c) => c.amber,
  danger: (c) => c.onRed,
  ghost: (c) => c.amber,
};

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    md: {
      paddingVertical: 13,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    sm: {
      paddingVertical: spacing.sm,
      paddingHorizontal: 14,
      borderRadius: radius.sm,
    },
    hug: {
      alignSelf: 'flex-start',
    },
    primary: {
      backgroundColor: colors.amber,
    },
    secondary: {
      borderColor: colors.borderStrong,
    },
    accent: {
      backgroundColor: colors.surface,
      borderColor: colors.amberBorder,
    },
    danger: {
      backgroundColor: colors.red,
    },
    ghost: {
      paddingHorizontal: spacing.xs,
    },
    disabled: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.bold,
    },
    labelSm: {
      fontSize: fontSize.small,
    },
  });
}
