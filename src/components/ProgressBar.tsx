import { StyleSheet, View } from 'react-native';

import { getStatusColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import type { ServiceItemStatus } from '@/types/models';

export function ProgressBar({ progress, status }: { progress: number; status: ServiceItemStatus }) {
  const colors = useThemeColors();
  const width = `${Math.min(100, Math.max(0, progress * 100))}%` as const;

  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.fill, { width, backgroundColor: getStatusColors(colors)[status] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
