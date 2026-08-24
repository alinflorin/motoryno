import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

/** Full-bleed themed background wrapper shared by every screen. */
export function Screen({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return <View style={[styles.root, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
