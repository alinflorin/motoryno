import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ObdConsole } from '@/components/ObdConsole';
import { ObdManualConfigForm } from '@/components/ObdManualConfigForm';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import type { ObdReadConfig } from '@/obd';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';

/**
 * The manual OBD configuration as a sheet over the car form, so the
 * overrides can be set up while the car is still a draft - before its first
 * scan, or before it has ever been saved. Saving hands the config back to
 * the form; it's persisted with the car when the form is submitted.
 */
export function ObdSetupSheet({
  visible,
  config,
  deviceAddress,
  onSave,
  onClose,
}: {
  visible: boolean;
  config: ObdReadConfig;
  deviceAddress: string | null;
  onSave: (next: ObdReadConfig) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useStyles(getStyles);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, Platform.OS === 'android' ? { paddingTop: insets.top + spacing.sm } : null]}>
          <Text style={styles.title}>{t('obdSetup.title')}</Text>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <Icon name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScreenScrollView keyboardShouldPersistTaps="handled">
            <ObdManualConfigForm config={config} deviceAddress={deviceAddress} onSave={onSave} onBusyChange={setBusy} />
            <ObdConsole deviceAddress={deviceAddress} initCommands={config.initCommands} onBusyChange={setBusy} />
          </ScreenScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.heading,
      fontWeight: fontWeight.semibold,
    },
    close: {
      padding: spacing.xs,
    },
    closePressed: {
      opacity: 0.6,
    },
  });
}
