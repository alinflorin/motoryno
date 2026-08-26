import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

/**
 * Full-bleed themed background wrapper shared by every screen.
 *
 * Previously this wrapped native screens in a `Pressable` that called
 * `Keyboard.dismiss()` on tap, so that tapping blank space would blur a
 * focused input (see the module history for the original rationale). That
 * broke scrolling everywhere: RN grants JS touch-responder status to
 * whichever view the finger goes down on, and a drag that starts on the
 * Pressable's own background (rather than on a nested Touchable/ScrollView
 * child) let the Pressable claim the gesture before the ScrollView's native
 * pan recognizer got a chance to — so dragging from blank space never
 * scrolled, while dragging from a button/list item (whose own Touchable
 * yields to an ancestor scroll on move) worked fine.
 *
 * Every native screen with a text field already renders it inside a
 * `ScrollView` (form screens), whose own default `keyboardShouldPersistTaps`
 * ('never') already blurs the focused input on any tap outside it — for
 * free, and without stealing the drag gesture, since it's the ScrollView's
 * own touch handling rather than a separate wrapper fighting it. So no
 * extra dismiss wiring is needed here.
 */
export function Screen({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const style = [styles.root, { backgroundColor: colors.background }];

  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
