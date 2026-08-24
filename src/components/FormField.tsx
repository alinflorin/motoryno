import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

export function FormField({
  label,
  error,
  children,
  style,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  /** Escape hatch for a field that needs to affect its own layout/stacking — e.g. a
   *  combobox that must paint its dropdown over the fields declared after it. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      {children}
      {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
  },
});
