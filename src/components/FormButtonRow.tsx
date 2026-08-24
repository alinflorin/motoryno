import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function FormButtonRow({
  onCancel,
  onSubmit,
  submitLabel,
  submitDisabled,
  insetBottom,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  insetBottom: number;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.row, { paddingBottom: Math.max(16, insetBottom) }]}>
      <Pressable
        onPress={onCancel}
        style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        onPress={onSubmit}
        disabled={submitDisabled}
        style={({ pressed }) => [
          styles.button,
          styles.submitButton,
          submitDisabled && styles.submitButtonDisabled,
          pressed && !submitDisabled && styles.pressed,
        ]}
      >
        <Text style={[styles.submitText, submitDisabled && styles.submitTextDisabled]}>
          {submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.amber,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: colors.onAmber,
    fontSize: 14,
    fontWeight: '700',
  },
  submitTextDisabled: {
    color: colors.onAmber,
  },
});
