import { Text } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

export function Chevron() {
  const colors = useThemeColors();
  return <Text style={{ color: colors.textFainter, fontSize: 18, fontWeight: '600' }}>›</Text>;
}
