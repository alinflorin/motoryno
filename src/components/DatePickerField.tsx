import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors, useThemePreference } from '@/theme/ThemeContext';
import { formatDateDMY } from '@/utils/date';

function toInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A form-input-styled control that opens a native date picker (or an
 * <input type="date"> on web) — mirrors `TimePickerField`'s platform split,
 * but styled to sit inside a form alongside plain `TextInput`s.
 */
export function DatePickerField({
  value,
  onChange,
  onBlur,
  maxDate,
  style,
}: {
  value: number;
  onChange: (timestamp: number) => void;
  onBlur?: () => void;
  /** Latest selectable date — defaults to now, since a service visit can't be logged for the future. */
  maxDate?: Date;
  style?: object;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scheme } = useThemePreference();
  const styles = getStyles(colors);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const [iosPendingValue, setIosPendingValue] = useState(value);
  const max = maxDate ?? new Date();
  const label = formatDateDMY(value);

  if (Platform.OS === 'web') {
    // react-native-web has no date-picker primitive, so fall back to the
    // browser's native <input type="date">.
    return createElement('input', {
      type: 'date',
      value: toInputValue(new Date(value)),
      max: toInputValue(max),
      onChange: (event: { target: { value: string } }) => {
        const [year, month, day] = event.target.value.split('-').map(Number);
        if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
          onChange(new Date(year, month - 1, day).getTime());
        }
      },
      onBlur: () => onBlur?.(),
      // A raw DOM node (not a react-native-web component), so it needs real CSS property
      // names — RN-only shorthands like paddingHorizontal in `style` wouldn't apply here.
      style: {
        width: '100%',
        boxSizing: 'border-box',
        font: 'inherit',
        fontSize: 14,
        color: colors.textPrimary,
        colorScheme: scheme,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: colors.borderStrong,
        borderRadius: 12,
        padding: '12px 14px',
      },
    });
  }

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: new Date(value),
        mode: 'date',
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(date.getTime());
          onBlur?.();
        },
      });
      return;
    }

    setIosPendingValue(value);
    setIosSheetOpen(true);
  };

  return (
    <>
      <Pressable style={[styles.input, style]} onPress={openPicker}>
        <Text style={styles.inputText}>{label}</Text>
      </Pressable>
      <Modal visible={iosSheetOpen} transparent animationType="slide" onRequestClose={() => setIosSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIosSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <DateTimePicker
              value={new Date(iosPendingValue)}
              mode="date"
              display="spinner"
              maximumDate={max}
              onValueChange={(_event, date) => setIosPendingValue(date.getTime())}
            />
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
              onPress={() => {
                onChange(iosPendingValue);
                onBlur?.();
                setIosSheetOpen(false);
              }}
            >
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    input: {
      justifyContent: 'center',
    },
    inputText: {
      color: colors.textPrimary,
      fontSize: 14,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 8,
      paddingBottom: 24,
      paddingHorizontal: 16,
      gap: 12,
    },
    doneButton: {
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.amber,
    },
    doneButtonPressed: {
      opacity: 0.85,
    },
    doneText: {
      color: colors.onAmber,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
