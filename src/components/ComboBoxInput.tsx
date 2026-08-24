import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

/**
 * A plain text input with a dropdown of prior values to pick from — lets a
 * field reuse a previously entered value (e.g. a shop name) without
 * blocking free text entry for a new one.
 */
export function ComboBoxInput({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  placeholderTextColor,
  style,
}: {
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  /** Prior values to suggest, most-recent-first — duplicates and blanks are ignored. */
  options: string[];
  placeholder?: string;
  placeholderTextColor?: string;
  style?: object;
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [focused, setFocused] = useState(false);

  const matches = options.filter((option) => option.toLowerCase().includes(value.trim().toLowerCase()));
  const showSuggestions = focused && matches.length > 0;

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={style}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so a suggestion's onPress fires before the list unmounts.
          setTimeout(() => setFocused(false), 150);
          onBlur?.();
        }}
      />
      {showSuggestions && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
            {matches.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  onChange(option);
                  setFocused(false);
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      overflow: 'hidden',
      zIndex: 30,
      elevation: 8,
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
    },
    dropdownScroll: {
      maxHeight: 160,
    },
    option: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    optionText: {
      color: colors.textPrimary,
      fontSize: 14,
    },
  });
}
