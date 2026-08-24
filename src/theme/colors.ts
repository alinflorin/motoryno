/**
 * Color tokens for the app's amber-accented theme, in both light and dark variants.
 * Plain constants only — theme resolution/switching lives in `./ThemeContext`.
 */
export const darkColors = {
  background: '#09090b',
  surface: '#18181b',
  surfaceAlt: '#27272a',
  border: '#27272a',
  borderStrong: '#71717a',

  textPrimary: '#fafafa',
  textSecondary: '#d4d4d8',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  textFainter: '#52525b',

  amber: '#f59e0b',
  amberMuted: 'rgba(245, 158, 11, 0.1)',
  amberBorder: 'rgba(245, 158, 11, 0.5)',
  onAmber: '#000000',

  red: '#ef4444',
  redSoft: '#fca5a5',
  redSofter: '#fecaca',
  redBg: 'rgba(69, 10, 10, 0.4)',
  redBorder: 'rgba(127, 29, 29, 0.5)',
  onRed: '#ffffff',

  yellow: '#facc15',
  emerald: '#10b981',
} as const;

export type ColorTokens = { [K in keyof typeof darkColors]: string };

export const lightColors: ColorTokens = {
  background: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f4f4f5',
  border: '#e4e4e7',
  borderStrong: '#71717a',

  textPrimary: '#18181b',
  textSecondary: '#3f3f46',
  textMuted: '#71717a',
  textFaint: '#a1a1aa',
  textFainter: '#d4d4d8',

  amber: '#b45309',
  amberMuted: 'rgba(180, 83, 9, 0.08)',
  amberBorder: 'rgba(180, 83, 9, 0.4)',
  onAmber: '#000000',

  red: '#dc2626',
  redSoft: '#b91c1c',
  redSofter: '#7f1d1d',
  redBg: 'rgba(254, 226, 226, 0.7)',
  redBorder: 'rgba(220, 38, 38, 0.35)',
  onRed: '#ffffff',

  yellow: '#ca8a04',
  emerald: '#059669',
};

export function getStatusColors(colors: ColorTokens) {
  return {
    overdue: colors.red,
    'due-soon': colors.yellow,
    ok: colors.emerald,
  } as const;
}
