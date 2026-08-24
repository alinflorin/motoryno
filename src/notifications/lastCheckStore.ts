import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Tiny device-local bookkeeping value — the local calendar day ("YYYY-MM-DD") the overdue-items
 * check last ran on — so the daily reminder fires at most once per day regardless of how many
 * times the background task or the foreground catch-up run. Deliberately kept out of the main
 * app-data JSON blob (README's data model): it's not user data and has no business being synced.
 */

const FILE_NAME = 'motoryno.notify-state.json';
const WEB_STORAGE_KEY = 'motoryno.notify-state';

function getFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export async function getLastCheckedDate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(WEB_STORAGE_KEY) ?? null;
    }
    const file = getFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync()) as { lastCheckedDate?: string };
    return parsed.lastCheckedDate ?? null;
  } catch (error) {
    console.warn('[notifications] Failed to read last-checked date, ignoring it.', error);
    return null;
  }
}

export async function setLastCheckedDate(dateKey: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_STORAGE_KEY, dateKey);
      return;
    }
    getFile().write(JSON.stringify({ lastCheckedDate: dateKey }));
  } catch (error) {
    console.warn('[notifications] Failed to persist last-checked date.', error);
  }
}

/** Local (device-timezone) calendar day key for `date`, e.g. "2026-08-24". */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
