import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/theme/ThemeContext';

type ChevronProps = {
  color?: string;
  size?: number;
};

export function Chevron({ color, size = 18 }: ChevronProps) {
  const colors = useThemeColors();
  return <Icon name="chevron-forward" size={size} color={color ?? colors.textFainter} />;
}
