import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { SettingsRow } from '@/components/SettingsRow';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { formatTimeLabel, type DailyTime } from '@/utils/notificationCron';

function toDate({ hour, minute }: DailyTime): Date {
  const date = new Date(2000, 0, 1, hour, minute);
  return date;
}

function fromDate(date: Date): DailyTime {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

/** A SettingsRow that opens a native time picker (or an <input type="time"> on web). */
export function TimePickerField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: DailyTime;
  onChange: (next: DailyTime) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const [iosPendingValue, setIosPendingValue] = useState(value);
  const timeLabel = formatTimeLabel(value);

  if (Platform.OS === 'web') {
    // react-native-web has no time-picker primitive, so fall back to the
    // browser's native <input type="time">.
    return (
      <SettingsRow
        label={label}
        right={createElement('input', {
          type: 'time',
          value: timeLabel,
          disabled,
          onChange: (event: { target: { value: string } }) => {
            const [hour, minute] = event.target.value.split(':').map(Number);
            if (Number.isInteger(hour) && Number.isInteger(minute)) {
              onChange({ hour, minute });
            }
          },
          style: {
            font: 'inherit',
            color: disabled ? colors.textFainter : colors.textFaint,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          },
        })}
      />
    );
  }

  const openPicker = () => {
    if (disabled) return;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(fromDate(date));
        },
      });
      return;
    }

    setIosPendingValue(value);
    setIosSheetOpen(true);
  };

  return (
    <>
      <SettingsRow label={label} value={timeLabel} onPress={disabled ? undefined : openPicker} />
      <Modal visible={iosSheetOpen} transparent animationType="slide" onRequestClose={() => setIosSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIosSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <DateTimePicker
              value={toDate(iosPendingValue)}
              mode="time"
              display="spinner"
              is24Hour
              onValueChange={(_event, date) => setIosPendingValue(fromDate(date))}
            />
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
              onPress={() => {
                onChange(iosPendingValue);
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
