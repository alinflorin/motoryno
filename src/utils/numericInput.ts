/**
 * Text-input sanitizers for numeric fields. `keyboardType` only hints at the
 * on-screen keyboard (and does nothing on web or with a physical/pasted
 * input), so form fields that must hold a number also filter keystrokes
 * through one of these.
 */

/** Strips everything but digits — for whole-number fields like year or odometer. */
export function sanitizeIntegerInput(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** Keeps digits and a single decimal separator — for money fields like price/spend. */
export function sanitizeDecimalInput(text: string): string {
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
}
