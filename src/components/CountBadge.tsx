import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

export function CountBadge({ count }: { count: number }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.red }]}>
      <Text style={[styles.text, { color: colors.onRed }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
