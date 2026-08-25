/**
 * Minimal base64 codec for the ASCII-only AT/OBD command strings this module
 * sends and receives. `react-native-ble-plx` writes/reads characteristic
 * values as base64 strings, and Hermes doesn't ship `atob`/`btoa` — pulling
 * in a dependency for this would be overkill, so it's implemented directly.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encodes an ASCII string (command bytes are always 7-bit ASCII) to base64. */
export function asciiToBase64(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; i += 3) {
    const b0 = input.charCodeAt(i);
    const b1 = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
    const b2 = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;

    output += CHARS[b0 >> 2];
    output += CHARS[((b0 & 0x03) << 4) | (Number.isNaN(b1) ? 0 : b1 >> 4)];
    output += Number.isNaN(b1) ? '=' : CHARS[((b1 & 0x0f) << 2) | (Number.isNaN(b2) ? 0 : b2 >> 6)];
    output += Number.isNaN(b2) ? '=' : CHARS[b2 & 0x3f];
  }
  return output;
}

/** Decodes a base64 string into raw bytes (as a `number[]`), then callers map that to ASCII/hex as needed. */
export function base64ToBytes(input: string): number[] {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = CHARS.indexOf(clean[i]);
    const c1 = CHARS.indexOf(clean[i + 1] ?? 'A');
    const c2 = clean[i + 2] !== undefined ? CHARS.indexOf(clean[i + 2]) : -1;
    const c3 = clean[i + 3] !== undefined ? CHARS.indexOf(clean[i + 3]) : -1;

    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 0x03) << 6) | c3);
  }
  return bytes;
}

export function base64ToAscii(input: string): string {
  return base64ToBytes(input)
    .map((byte) => String.fromCharCode(byte))
    .join('');
}
