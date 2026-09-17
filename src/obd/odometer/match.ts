/**
 * "Learn by reference" matcher: given a payload an ECU (or the bus) handed
 * back and the odometer reading the user just copied off the dashboard,
 * finds every byte field in the payload that decodes to that reading.
 *
 * This is how the app locates the odometer on cars whose brand-specific
 * request isn't documented (the common case for pre-2019 vehicles): sweep
 * plausible requests, and let the known-correct value pick out the right
 * one. Only 3- and 4-byte fields are considered - a 2-byte window matching
 * a 5-digit number by chance is far too likely across a few thousand
 * candidate bytes, while a 24/32-bit coincidence is negligible.
 */

import type { ByteField, ByteOrder } from '@/obd/odometer/source';
import { decodeField } from '@/obd/odometer/source';

const KM_PER_MILE = 1.60934;

/** Field lengths and encodings worth trying, most conventional first - the order breaks ties between simultaneous matches. */
const LENGTHS = [3, 4] as const;
const ORDERS: ByteOrder[] = ['be', 'le'];
/** Raw unit candidates: km, 0.1 km/bit (SAE PID A6 style), miles, 0.1 mi/bit. */
const SCALES = [1, 0.1, KM_PER_MILE, KM_PER_MILE / 10];

export interface FieldMatch {
  field: ByteField;
  km: number;
}

/**
 * Tolerance for "the same reading": the user types the dash value, the ECU
 * may be a km or two ahead or behind (cluster vs gateway copies drift, and a
 * fractional-km encoding rounds).
 */
export function matchTolerance(referenceKm: number): number {
  return Math.max(3, referenceKm * 0.001);
}

/** Every field in `bytes` decoding to `referenceKm` (within tolerance), most conventional encodings first. */
export function findFieldMatches(bytes: number[], referenceKm: number): FieldMatch[] {
  const tolerance = matchTolerance(referenceKm);
  const matches: FieldMatch[] = [];
  for (const scale of SCALES) {
    for (const length of LENGTHS) {
      for (const endian of ORDERS) {
        for (let offset = 0; offset + length <= bytes.length; offset++) {
          const field: ByteField = { offset, length, endian, scale };
          const km = decodeField(bytes, field);
          if (km === null) continue;
          if (Math.abs(km - referenceKm) <= tolerance) matches.push({ field, km });
        }
      }
    }
  }
  return matches;
}

/** A reading is only trusted if it's a sane odometer value - guards against decoding padding/counters as km. */
export function isPlausibleOdometerKm(km: number, maxKm: number): boolean {
  return Number.isFinite(km) && km > 0 && km <= maxKm;
}
