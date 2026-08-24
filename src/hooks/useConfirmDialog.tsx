import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, type ConfirmDialogOptions } from '@/components/ConfirmDialog';

export interface ConfirmDialogInput {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Reusable confirmation dialog. Renders `dialog` wherever a modal should
 * mount, and resolves `confirm(...)` to true/false once the user answers.
 *
 * const { confirm, dialog } = useConfirmDialog();
 * ...
 * <>{content}{dialog}</>
 * const ok = await confirm({ title, message, destructive: true });
 */
export function useConfirmDialog() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback(
    (input: ConfirmDialogInput) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions({
          title: input.title,
          message: input.message,
          confirmLabel: input.confirmLabel ?? t('common.delete'),
          cancelLabel: input.cancelLabel ?? t('common.cancel'),
          destructive: input.destructive,
        });
      }),
    [t]
  );

  const dialog = (
    <ConfirmDialog visible={options !== null} options={options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  );

  return { confirm, dialog };
}
