import { Text } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

type ChevronProps = {
  color?: string;
  size?: number;
};

export function Chevron({ color, size = 18 }: ChevronProps) {
  const colors = useThemeColors();
  return <Text style={{ color: color ?? colors.textFainter, fontSize: size, fontWeight: '600' }}>›</Text>;
}
