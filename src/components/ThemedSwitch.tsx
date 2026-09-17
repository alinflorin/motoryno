import { Switch, type SwitchProps } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

/** `Switch` in the app's colours - use this instead of restating track/thumb colours at every call site. */
export function ThemedSwitch(props: SwitchProps) {
  const colors = useThemeColors();
  return <Switch trackColor={{ true: colors.amber, false: colors.borderStrong }} thumbColor={colors.textPrimary} {...props} />;
}
