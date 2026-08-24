import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

/** Presentational confirm/cancel modal. Rendered by the useConfirmDialog hook. */
export function ConfirmDialog({
  visible,
  options,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  options: ConfirmDialogOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!options) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{options.title}</Text>
          {options.message ? <Text style={styles.message}>{options.message}</Text> : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              options.destructive ? styles.destructiveButton : styles.confirmButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onConfirm}
          >
            <Text style={options.destructive ? styles.destructiveText : styles.confirmText}>
              {options.confirmLabel}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.buttonPressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>{options.cancelLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      padding: 20,
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    message: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    button: {
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      marginTop: 4,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    confirmButton: {
      backgroundColor: colors.amber,
    },
    confirmText: {
      color: colors.onAmber,
      fontSize: 14,
      fontWeight: '700',
    },
    destructiveButton: {
      backgroundColor: colors.redBg,
      borderWidth: 1,
      borderColor: colors.redBorder,
    },
    destructiveText: {
      color: colors.red,
      fontSize: 14,
      fontWeight: '700',
    },
    cancelButton: {
      marginTop: 0,
      backgroundColor: colors.surfaceAlt,
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
