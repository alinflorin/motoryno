import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { layout, spacing } from '@/theme/tokens';

/** Cancel / submit pair pinned under a form, inset for the home indicator. */
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
    <View style={[styles.row, { paddingBottom: Math.max(layout.screenPadding, insetBottom) }]}>
      <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} style={styles.button} />
      <Button label={submitLabel} onPress={onSubmit} disabled={submitDisabled} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm + 2,
  },
  button: {
    flex: 1,
  },
});
