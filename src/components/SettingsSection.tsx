import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { radius } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  const { styles } = useStyles(getStyles);
  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {row}
            {index < rows.length - 1 && <View style={styles.divider} />}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: {
      gap: 8,
    },
    title: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 16,
    },
  });
}
