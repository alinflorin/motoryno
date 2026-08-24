/**
 * Static color tokens for the app's dark, amber-accented theme.
 * Plain constants only — no theme switching logic yet.
 */
export const colors = {
  background: '#09090b',
  surface: '#18181b',
  surfaceAlt: '#27272a',
  border: '#27272a',
  borderStrong: '#52525b',

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

  yellow: '#facc15',
  emerald: '#10b981',
} as const;

export const statusColors = {
  overdue: colors.red,
  'due-soon': colors.yellow,
  ok: colors.emerald,
} as const;
