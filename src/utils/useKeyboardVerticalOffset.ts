import { Platform } from 'react-native';
// Deep import: `useHeaderHeight` isn't re-exported from the `expo-router` package root,
// only from its (deprecated but still functional) React Navigation elements bundle.
import { useHeaderHeight } from 'expo-router/build/react-navigation/elements/Header/useHeaderHeight';

/**
 * `KeyboardAvoidingView`'s `padding` behavior on iOS only measures its own frame - it has
 * no idea a native header sits above it, so it under-pads by exactly that many pixels,
 * leaving content (e.g. a sticky Save/Cancel row) tucked behind the keyboard. Pass this as
 * `keyboardVerticalOffset` to correct for it. Only call this from a screen that renders
 * under a Stack header (`headerShown` not false) - it throws otherwise.
 */
export function useKeyboardVerticalOffset(): number {
  const headerHeight = useHeaderHeight();
  return Platform.OS === 'ios' ? headerHeight : 0;
}
