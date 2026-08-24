import { Platform } from 'react-native';

import { normalizeAppData } from '@/storage/normalize';
import type { AppData } from '@/storage/types';
import { isValidAppData } from '@/storage/validate';

export class InvalidAppDataError extends Error {
  constructor() {
    super('The selected file is not a valid Motoryno backup.');
    this.name = 'InvalidAppDataError';
  }
}

/**
 * Lets the user pick a previously exported JSON file (see `downloadAppData`)
 * and parses/validates it into `AppData`. Resolves to `null` if the user
 * cancels the picker.
 */
export async function pickAppData(): Promise<AppData | null> {
  const text = Platform.OS === 'web' ? await pickTextWeb() : await pickTextNative();
  if (text === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidAppDataError();
  }

  if (!isValidAppData(parsed)) {
    throw new InvalidAppDataError();
  }

  return normalizeAppData(parsed);
}

function pickTextWeb(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
      reader.readAsText(file);
    };
    // No cancel event is fired reliably across browsers; if the user dismisses
    // the dialog, `onchange` simply never fires and the promise stays pending
    // until they try again, which is an acceptable UX trade-off here.
    document.body.appendChild(input);
    input.click();
  });
}

async function pickTextNative(): Promise<string | null> {
  const DocumentPicker = await import('expo-document-picker');
  const { File } = await import('expo-file-system');

  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const file = new File(result.assets[0].uri);
  return file.text();
}
