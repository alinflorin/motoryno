import { useMemo } from 'react';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

/**
 * Builds a component's themed `StyleSheet` once per palette instead of on
 * every render. `factory` should be a module-level function (stable
 * identity) that maps the active color tokens to `StyleSheet.create(...)`.
 *
 *   const { colors, styles } = useStyles(getStyles);
 */
export function useStyles<T>(factory: (colors: ColorTokens) => T): { colors: ColorTokens; styles: T } {
  const colors = useThemeColors();
  const styles = useMemo(() => factory(colors), [factory, colors]);
  return { colors, styles };
}
