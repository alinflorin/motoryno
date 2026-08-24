import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { downloadJson } from '@/storage/downloadJson';
import type { AppData } from '@/storage/types';

/**
 * Lets the user save/share the app's single JSON data blob (README > Technical
 * implementation details) as a standalone file — a manual counterpart to the
 * (not yet implemented) iCloud/Drive sync.
 */
export async function downloadAppData(data: AppData): Promise<void> {
  const fileName = `motoryno-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify(data, null, 2);

  if (Platform.OS === 'web') {
    downloadJson(text, fileName);
    return;
  }

  const Sharing = await import('expo-sharing');
  const file = new File(new Directory(Paths.cache), fileName);
  file.write(text);
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: fileName });
    }
  } finally {
    if (file.exists) file.delete();
  }
}
