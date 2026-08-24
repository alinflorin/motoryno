import { StyleSheet, View } from 'react-native';

import { statusColors } from '@/theme/colors';
import type { ServiceItemStatus } from '@/types/models';

export function StatusDot({ status }: { status: ServiceItemStatus }) {
  return <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
