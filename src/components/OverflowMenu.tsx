import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export interface OverflowMenuItem {
  key: string;
  label: string;
  glyph: string;
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
            <Text style={styles.glyph}>{item.glyph}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
  glyph: {
    color: colors.textMuted,
    fontSize: 15,
    width: 18,
    textAlign: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
