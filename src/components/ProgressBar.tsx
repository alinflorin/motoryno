import { StyleSheet, View } from 'react-native';

import { colors, statusColors } from '@/theme/colors';
import type { ServiceItemStatus } from '@/types/models';

export function ProgressBar({ progress, status }: { progress: number; status: ServiceItemStatus }) {
  const width = `${Math.min(100, Math.max(0, progress * 100))}%` as const;

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width, backgroundColor: statusColors[status] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
