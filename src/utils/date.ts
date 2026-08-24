/** Formats a stored timestamp (ms) as DD.MM.YYYY, matching the app's date-entry format. */
export function formatDateDMY(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Parses a DD.MM.YYYY string into a timestamp, falling back to right now if it's empty/invalid. */
export function parseDateDMYOrNow(value: string): number {
  return parseDateDMY(value) ?? Date.now();
}

/** Parses a DD.MM.YYYY string into a timestamp (local midnight), or null if it isn't a valid date. */
export function parseDateDMY(value: string): number | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Reject values like 31.02.2024 that Date() silently rolls over into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return date.getTime();
}
