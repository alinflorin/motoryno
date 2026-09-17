import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';

export interface TextFieldProps extends TextInputProps {
  /** Short unit/currency label pinned to the right edge inside the field (e.g. "km", "EUR"). */
  suffix?: string;
  /** Style for the wrapping view (layout only) - `style` still goes to the input itself. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The app's themed single-line text input: surface background, strong
 * border, rounded corners, with an optional inline suffix. Every form field
 * uses this so the look is defined in exactly one place.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ suffix, containerStyle, style, ...inputProps }, ref) {
  const { colors, styles } = useStyles(getStyles);
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFainter}
        {...inputProps}
        style={[styles.input, suffix ? styles.inputWithSuffix : null, style]}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
});

/** Exposed so composite inputs (combobox, date picker) can share the exact same look. */
export function getTextInputStyle(colors: ColorTokens) {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
  } as const;
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      justifyContent: 'center',
    },
    input: getTextInputStyle(colors),
    inputWithSuffix: {
      paddingRight: 44,
    },
    suffix: {
      position: 'absolute',
      right: 14,
      color: colors.textFaint,
      fontSize: 12,
    },
  });
}
