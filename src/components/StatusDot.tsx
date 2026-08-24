import { StyleSheet, View } from 'react-native';

import { getStatusColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import type { ServiceItemStatus } from '@/utils/serviceStatus';

export function StatusDot({ status }: { status: ServiceItemStatus }) {
  const colors = useThemeColors();
  return <View style={[styles.dot, { backgroundColor: getStatusColors(colors)[status] }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
