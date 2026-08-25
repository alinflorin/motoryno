/**
 * Mirrors `KNOWN_UART_PROFILES` in the app's `src/obd/elm327.ts`, so this
 * simulator can advertise itself under each of the clone-chipset profile
 * shapes the app already knows how to detect (plus its own fallback path
 * for anything not in the list).
 */
export interface UartProfile {
  label: string;
  serviceUUID: string;
  /** Characteristic the central writes AT/OBD commands to. */
  writeUUID: string;
  /** Characteristic the peripheral notifies responses on (same as writeUUID for HM-10 style modules). */
  notifyUUID: string;
}

export const PROFILES: Record<string, UartProfile> = {
  hm10: { label: 'HM-10 style (FFE0/FFE1)', serviceUUID: 'ffe0', writeUUID: 'ffe1', notifyUUID: 'ffe1' },
  fff0: { label: 'FFF0 style (FFF1/FFF2)', serviceUUID: 'fff0', writeUUID: 'fff2', notifyUUID: 'fff1' },
  nordic: {
    label: 'Nordic UART Service',
    serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    writeUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    notifyUUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  },
};

export type ProfileName = keyof typeof PROFILES;

export function resolveProfile(name: string | undefined): UartProfile {
  const key = (name ?? 'hm10').toLowerCase();
  const profile = PROFILES[key];
  if (!profile) {
    throw new Error(`Unknown profile "${name}". Valid options: ${Object.keys(PROFILES).join(', ')}`);
  }
  return profile;
}
