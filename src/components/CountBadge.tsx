import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
