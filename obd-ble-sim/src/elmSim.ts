/**
 * A tiny ELM327 command interpreter. Given one command line (as sent by
 * `ElmConnection.sendCommand` in the app - mode+PID concatenated, no spaces,
 * `\r`-terminated), returns the text response the app expects (without the
 * trailing `>` prompt; the transport layer appends that).
 *
 * Only what the app actually uses is implemented:
 * - AT commands: always answered "OK" (ATZ gets a banner line instead, like
 *   a real adapter, and some clones stay quiet on it - see elm327.ts).
 * - Mode 09 PID 02: VIN.
 * - Mode 01 PID A6: standard OBD-II odometer (SAE J1979-2), 0.1 km/bit.
 * - Any other Mode 01/22 request: "NO DATA", simulating a car that doesn't
 *   support that PID/DID - the app's brand-specific odometer candidates
 *   (catalogs/odometerDids.ts) are expected to mostly miss like this.
 */

export interface SimConfig {
  vin: string;
  odometerKm: number;
}

function toHexLine(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function vinResponse(vin: string): string {
  const padded = vin.slice(0, 17).padEnd(17, ' ');
  const asciiBytes = Array.from(padded).map((ch) => ch.charCodeAt(0));
  // 49 02 <number of data items> <VIN ASCII bytes>, per SAE J1979 Mode 09 PID 02.
  return toHexLine([0x49, 0x02, 0x01, ...asciiBytes]);
}

function odometerResponse(odometerKm: number): string {
  const raw = Math.round(odometerKm * 10); // 0.1 km per bit
  const bytes = [(raw >> 24) & 0xff, (raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff];
  return toHexLine([0x41, 0xa6, ...bytes]);
}

export function handleCommand(command: string, config: SimConfig): string {
  const cmd = command.trim().toUpperCase();

  if (cmd === 'ATZ') return 'ELM327 v1.5';
  if (cmd.startsWith('AT')) return 'OK';

  if (cmd === '0902') return vinResponse(config.vin);
  if (cmd === '01A6') return odometerResponse(config.odometerKm);

  if (/^01[0-9A-F]{2}$/.test(cmd)) return 'NO DATA';
  if (/^22[0-9A-F]{4}$/.test(cmd)) return 'NO DATA';

  return '?';
}
