import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { AppData } from '@/storage/types';

/**
 * Low-level read/write for the single JSON blob the app is persisted into
 * (README > Technical implementation details): a JSON file in the app's
 * document directory on Android/iOS, Local Storage on Web.
 */

const FILE_NAME = 'motoryno.json';
const WEB_STORAGE_KEY = 'motoryno.data';

function getFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export async function readAppData(): Promise<AppData | null> {
  try {
    if (Platform.OS === 'web') {
      const text = globalThis.localStorage?.getItem(WEB_STORAGE_KEY);
      return text ? (JSON.parse(text) as AppData) : null;
    }

    const file = getFile();
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as AppData;
  } catch (error) {
    console.warn('[storage] Failed to read/parse persisted app data, ignoring it.', error);
    return null;
  }
}

export async function writeAppData(data: AppData): Promise<void> {
  const text = JSON.stringify(data);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(WEB_STORAGE_KEY, text);
    return;
  }
  getFile().write(text);
}
