import { Text } from 'react-native';

import { colors } from '@/theme/colors';

export function Chevron() {
  return <Text style={{ color: colors.textFainter, fontSize: 18, fontWeight: '600' }}>›</Text>;
}
