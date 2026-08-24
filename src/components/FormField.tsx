import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.field}>
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
