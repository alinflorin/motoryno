/**
 * Layout/typography tokens shared by every screen and component, so spacing,
 * corner radii and type sizes come from one place. Colors live in
 * `colors.ts` (they vary per theme; these don't).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
} as const;

/** Horizontal screen gutter and the gap between stacked sections on a scrolling screen. */
export const layout = {
  screenPadding: spacing.lg,
  sectionGap: spacing.xl,
  screenBottomPadding: spacing.xxl,
} as const;

export const radius = {
  /** Small controls: compact buttons, chips. */
  sm: 10,
  /** Inputs, list rows, standard buttons. */
  md: 12,
  /** Cards and sheets. */
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 11,
  small: 12,
  body: 13,
  base: 14,
  title: 16,
  heading: 18,
  display: 20,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
