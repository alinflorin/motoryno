/**
 * In-memory ring buffer of the most recent adapter traffic (every command
 * sent, every raw reply, plus milestone notes from the read/learn flows).
 *
 * The odometer read is the one part of the app that can't be reproduced
 * without the user's actual car, so when it fails the raw exchange is the
 * only useful evidence. The log is surfaced through the OBD card's "share
 * log" action (`ObdConfigCard`) and mirrored to the console when
 * `EXPO_PUBLIC_OBD_DEBUG=1`.
 */

export type ObdLogDirection = 'tx' | 'rx' | 'info';

export interface ObdLogEntry {
  at: number;
  direction: ObdLogDirection;
  text: string;
}

const MAX_ENTRIES = 600;
const DEBUG = process.env.EXPO_PUBLIC_OBD_DEBUG === '1';

let entries: ObdLogEntry[] = [];

export function obdLog(direction: ObdLogDirection, text: string): void {
  entries.push({ at: Date.now(), direction, text });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
  if (DEBUG) {
    const prefix = direction === 'tx' ? '->' : direction === 'rx' ? '<-' : '--';
    console.log(`[obd] ${prefix} ${text}`);
  }
}

export function getObdLog(): readonly ObdLogEntry[] {
  return entries;
}

export function clearObdLog(): void {
  entries = [];
}

/** Renders the log as plain text, one entry per line, for sharing. */
export function formatObdLog(): string {
  return entries
    .map((entry) => {
      const time = new Date(entry.at).toISOString().slice(11, 23);
      const prefix = entry.direction === 'tx' ? '->' : entry.direction === 'rx' ? '<-' : '--';
      return `${time} ${prefix} ${entry.text}`;
    })
    .join('\n');
}
