import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, radius, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

export interface ChoiceChip<T extends string> {
  value: T;
  label: string;
}

/** A wrapping row of single-select chips - for choice lists too long for a segmented control. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChoiceChip<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { styles } = useStyles(getStyles);
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.amber,
      backgroundColor: colors.amberMuted,
    },
    chipPressed: {
      opacity: 0.7,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.medium,
    },
    labelSelected: {
      color: colors.amber,
      fontWeight: fontWeight.semibold,
    },
  });
}
