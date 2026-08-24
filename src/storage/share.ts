import { Directory, File as CacheFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { downloadJson } from '@/storage/downloadJson';
import type { Car } from '@/storage/types';

/**
 * Shares just the `cars` data (README > "Agent integration") as a JSON file
 * through the OS share sheet, so the user can hand it off to an AI app of
 * their choice (Claude, ChatGPT, Gemini, ...).
 *
 * Returns whether a share dialog was actually presented — false means no
 * share target was available on this platform/device.
 */
export async function shareCarsData(cars: Car[]): Promise<boolean> {
  const fileName = `motoryno-cars-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify({ cars }, null, 2);

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File([text], fileName, { type: 'application/json' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
          return true;
        }
      } catch (error) {
        // The user backing out of the share sheet isn't a failure worth reporting.
        if (error instanceof Error && error.name === 'AbortError') return true;
        // Otherwise the Web Share API is present but blocked (no user-activation
        // context, embedded iframe without the web-share permission, etc.) —
        // fall through to a plain download so the user still gets their data.
      }
    }

    downloadJson(text, fileName);
    return true;
  }

  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return false;

  const file = new CacheFile(new Directory(Paths.cache), fileName);
  file.write(text);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: fileName });
    return true;
  } finally {
    if (file.exists) file.delete();
  }
}
