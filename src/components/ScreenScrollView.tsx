import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { layout } from '@/theme/tokens';

/**
 * The scrolling body every content screen uses: standard gutter, section
 * gap and bottom padding, scroll indicator hidden. Pass `contentStyle` for
 * the rare deviation (e.g. a tighter gap) instead of re-declaring the base.
 */
export function ScreenScrollView({
  children,
  contentStyle,
  ...props
}: Omit<ScrollViewProps, 'contentContainerStyle'> & { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} {...props} contentContainerStyle={[styles.content, contentStyle]}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    gap: layout.sectionGap,
    paddingBottom: layout.screenBottomPadding,
  },
});
