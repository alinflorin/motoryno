import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useThemeColors } from '@/theme/ThemeContext';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconProps = {
  name: IoniconName;
  size?: number;
  /** Defaults to the theme's muted text color, so icons stay legible in both light and dark mode. */
  color?: string;
};

/** Themed wrapper around Ionicons — the app's default icon set. */
export function Icon({ name, size = 20, color }: IconProps) {
  const colors = useThemeColors();
  return <Ionicons name={name} size={size} color={color ?? colors.textMuted} />;
}

/** Same as `Icon`, backed by MaterialCommunityIcons for glyphs Ionicons doesn't have. */
export function MCIcon({ name, size = 20, color }: { name: MaterialCommunityIconName; size?: number; color?: string }) {
  const colors = useThemeColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? colors.textMuted} />;
}
