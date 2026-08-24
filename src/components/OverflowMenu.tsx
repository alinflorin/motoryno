import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export interface OverflowMenuItem {
  key: string;
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
}

export function OverflowMenu({
  visible,
  onDismiss,
  items,
  top,
  right,
  left,
}: {
  visible: boolean;
  onDismiss: () => void;
  items: OverflowMenuItem[];
  top: number;
  right?: number;
  left?: number;
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss menu" />
      <View style={[styles.panel, { top }, left === undefined ? { right: right ?? 16 } : { left }]}>
        {items.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => {
              onDismiss();
              item.onPress();
            }}
            style={({ pressed }) => [
              styles.row,
              index < items.length - 1 && styles.rowDivider,
              pressed && styles.rowPressed,
            ]}
          >
            <Icon name={item.icon} size={16} color={colors.textMuted} />
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
    },
    panel: {
      position: 'absolute',
      minWidth: 180,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      overflow: 'hidden',
      zIndex: 50,
      elevation: 8,
      boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.4)',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  });
}
