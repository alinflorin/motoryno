import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, radius } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** A row of mutually exclusive choices - for 2-4 short options where a picker would be overkill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
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
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
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
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    segmentSelected: {
      backgroundColor: colors.amber,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.semibold,
    },
    labelSelected: {
      color: colors.onAmber,
      fontWeight: fontWeight.bold,
    },
  });
}
