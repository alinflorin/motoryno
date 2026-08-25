/**
 * OBD-II PID database.
 *
 * VIN retrieval is standardized (SAE J1979 Mode 09, PID 02) and works the
 * same way on virtually every OBD-II-compliant vehicle since 1996, so it
 * needs no per-make data — see `requestVin` in `elm327.ts`.
 *
 * The odometer is a different story: SAE only standardized a Mode 01 PID for
 * it (0xA6) starting with J1979-2 / OBDonUDS, so it's only present on newer
 * (roughly 2022+) vehicles. Older cars only expose the odometer through
 * manufacturer-proprietary UDS requests (typically Mode 0x22 "ReadDataByIdentifier"
 * with a brand-specific data identifier), which differ per make/model/module
 * and sometimes per model year.
 *
 * `ODOMETER_PIDS_BY_MAKE` is where that brand-specific knowledge lives. It's
 * intentionally empty for now - fill it in as PID data becomes available.
 * `scanVehicleInfo` (see `scanVehicle.ts`) tries a car's make-specific entries
 * first (most specific/likely to work), then falls back to the standard PID.
 */

/** A single request/response definition for reading the odometer. */
export interface OdometerPidDef {
  /** Human-readable label, surfaced in logs/diagnostics only. */
  label: string;
  /** OBD/UDS service mode, e.g. '01' (current data) or '22' (read data by identifier). */
  mode: string;
  /** PID or data identifier, hex string, e.g. 'A6' or 'F190'. */
  pid: string;
  /**
   * Converts the response payload (data bytes only - mode/pid echo already
   * stripped) into an odometer reading in kilometers. Return null if the
   * bytes don't look like a plausible reading (e.g. all 0xFF/unsupported).
   */
  decode: (bytes: number[]) => number | null;
}

/** Decodes a big-endian unsigned integer spanning all of `bytes`, as-is (1:1 km per unit, no offset/scale). */
function decodeRawKm(bytes: number[]): number | null {
  if (bytes.length === 0) return null;
  const value = bytes.reduce((acc, byte) => acc * 256 + byte, 0);
  // 0xFFFF... (all bits set) conventionally means "not supported"/"no data".
  if (value === 2 ** (bytes.length * 8) - 1) return null;
  return value;
}

/**
 * Standard Mode 01 PID 0xA6 "Odometer" (SAE J1979-2 / OBDonUDS). 4 data
 * bytes, resolution 0.1 km per bit, no offset. Only present on vehicles
 * built to support it - most cars on the road today don't.
 */
export const STANDARD_ODOMETER_PID: OdometerPidDef = {
  label: 'Standard OBD-II odometer (Mode 01 PID A6)',
  mode: '01',
  pid: 'A6',
  decode: (bytes) => {
    const raw = decodeRawKm(bytes);
    return raw === null ? null : raw * 0.1;
  },
};

/**
 * Make-specific odometer PIDs, keyed by `Car.make` exactly as entered in the
 * car form (case-insensitive lookup - see `normalizeMakeKey`). Empty for
 * now; populate as real PID data comes in. Example shape once filled in:
 *
 * ```ts
 * 'Mercedes-Benz': [
 *   {
 *     label: 'Instrument cluster odometer (UDS DID F190)',
 *     mode: '22',
 *     pid: 'F190',
 *     decode: (bytes) => (bytes.length >= 4 ? (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) : null),
 *   },
 * ],
 * ```
 *
 * A make can list multiple candidates (e.g. different modules/model years) -
 * `scanVehicleInfo` tries them in order and stops at the first plausible
 * result.
 */
export const ODOMETER_PIDS_BY_MAKE: Record<string, OdometerPidDef[]> = {
  // Populate once brand PID data is available, e.g.:
  // 'Mercedes-Benz': [...],
  // 'BMW': [...],
  // 'Volkswagen': [...],
};

/** Case/whitespace-insensitive lookup key for `ODOMETER_PIDS_BY_MAKE`. */
export function normalizeMakeKey(make: string): string {
  return make.trim().toLowerCase();
}

/** Odometer PID candidates for a make, in try-order: brand-specific first, then the standard PID as a last resort. */
export function odometerCandidatesForMake(make: string | null): OdometerPidDef[] {
  const normalized = make ? normalizeMakeKey(make) : null;
  const makeSpecific = normalized
    ? (Object.entries(ODOMETER_PIDS_BY_MAKE).find(([key]) => normalizeMakeKey(key) === normalized)?.[1] ?? [])
    : [];
  return [...makeSpecific, STANDARD_ODOMETER_PID];
}
