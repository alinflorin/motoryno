import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.amber }]}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
