import type { ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';

/**
 * Full-bleed themed background wrapper shared by every screen.
 *
 * On native RN, tapping outside a focused text field doesn't blur it the way
 * it does on the web — so a form's "show the error once you leave the field"
 * logic would never fire from a tap on blank space. Dismissing the keyboard
 * on any such tap blurs the focused input for us there.
 *
 * The web doesn't need (or want) this: the browser already blurs a focused
 * input on any outside click, and DOM clicks bubble — unlike RN's native
 * touch-responder negotiation, a wrapping Pressable's onPress also fires for
 * clicks *inside* nested inputs, which stole focus from every field the
 * instant it was tapped. So this is native-only.
 */
export function Screen({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const style = [styles.root, { backgroundColor: colors.background }];

  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }

  return (
    <Pressable style={style} onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
