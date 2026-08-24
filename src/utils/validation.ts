/**
 * Field-level validators shared by the app's forms. Paired with the
 * sanitizers in `numericInput.ts`, which filter keystrokes as they're
 * typed — these validate the finished value before it's allowed to submit.
 */

// VINs exclude I, O and Q (too easily confused with 1, 0 and 9) and are
// always exactly 17 characters for model years 1981+.
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Strips characters a VIN can't contain and upper-cases as-you-type. */
export function sanitizeVinInput(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, '')
    .slice(0, 17);
}

export function isValidVin(vin: string): boolean {
  return VIN_PATTERN.test(vin);
}

const MIN_YEAR = 1900;

/** A car's model year must be a real, already-started model year. */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= new Date().getFullYear() + 1;
}

/** Keeps digits and separators — for DD.MM.YYYY date fields. */
export function sanitizeDateInput(text: string): string {
  return text.replace(/[^0-9.]/g, '').slice(0, 10);
}
