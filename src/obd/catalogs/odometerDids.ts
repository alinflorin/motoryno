/**
 * Turns the bundled Delphi-OBD catalogs into odometer PID candidates for a
 * given vehicle: resolve which manufacturer catalog applies (by the VIN's
 * WMI, falling back to fuzzy-matching the car's `make` text), then pull out
 * whichever of that manufacturer's DIDs look like an odometer/mileage
 * reading. The standard OBD-II PID is always appended last as a fallback.
 */

import { loadCatalog } from '@/obd/catalogs/loader';
import type { Catalog, DidDecoder, DidEntry, ManufacturerCatalog } from '@/obd/catalogs/types';
import { isDtcCatalog } from '@/obd/catalogs/types';
import manufacturerNames from '@/obd/catalogs/manufacturerNames.json';
import wmiIndex from '@/obd/catalogs/wmiIndex.json';
import { STANDARD_ODOMETER_PID, type OdometerPidDef } from '@/obd/pids';

const ODOMETER_KEYWORDS = ['mileage', 'odometer'];

/** Decoder kinds that clearly aren't a plain integer reading - not worth trying as an odometer value. */
const NON_NUMERIC_DECODER_KINDS = new Set(['ascii', 'bitmap', 'string', 'enum', 'bool', 'boolean', 'dtc']);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Resolves a bundled catalog key for this vehicle: VIN's WMI first (exact), then a fuzzy match on `make`. */
function resolveCatalogKey(vin: string | null, make: string | null): string | null {
  const wmi = vin && vin.length >= 3 ? vin.slice(0, 3).toUpperCase() : null;
  const byWmi = wmi ? (wmiIndex as Record<string, string>)[wmi] : undefined;
  if (byWmi) return byWmi;

  if (!make) return null;
  const normalizedMake = normalize(make);
  if (!normalizedMake) return null;

  for (const [key, displayName] of Object.entries(manufacturerNames as Record<string, string>)) {
    const normalizedDisplay = normalize(displayName);
    if (normalizedDisplay.includes(normalizedMake) || normalizedMake.includes(normalizedDisplay)) {
      return key;
    }
  }
  return null;
}

function looksLikeOdometer(did: DidEntry): boolean {
  const haystack = `${did.name} ${did.description ?? ''}`.toLowerCase();
  return ODOMETER_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Decodes response bytes as an unsigned big/little-endian integer with the
 * DID's scale/offset applied. Deliberately permissive - the catalog's `hex`
 * decoder kind (no documented scale) still means "read these bytes as a
 * plain integer", it's just not been assigned a scale/offset yet.
 */
function decodeDidBytes(bytes: number[], decoder: DidDecoder | undefined): number | null {
  if (bytes.length === 0) return null;
  const littleEndian = decoder?.kind?.endsWith('_le') ?? false;
  const ordered = littleEndian ? [...bytes].reverse() : bytes;
  const raw = ordered.reduce((acc, byte) => acc * 256 + byte, 0);
  if (raw === 2 ** (ordered.length * 8) - 1) return null; // all-bits-set - adapter's "not supported" sentinel
  return raw * (decoder?.scale ?? 1) + (decoder?.offset ?? 0);
}

function toOdometerPidDef(did: DidEntry, sourceLabel: string): OdometerPidDef | null {
  if (did.decoder && NON_NUMERIC_DECODER_KINDS.has(did.decoder.kind)) return null;
  const pid = did.did.replace(/^0x/i, '');
  if (!/^[0-9A-Fa-f]+$/.test(pid)) return null;

  return {
    label: `${sourceLabel}: ${did.name}`,
    mode: '22',
    pid,
    ecuHeader: did.ecu_address?.replace(/^0x/i, ''),
    decode: (bytes) => decodeDidBytes(bytes, did.decoder),
  };
}

function isManufacturerCatalog(catalog: Catalog): catalog is ManufacturerCatalog {
  return !isDtcCatalog(catalog);
}

export async function odometerCandidatesForVehicle(vin: string | null, make: string | null): Promise<OdometerPidDef[]> {
  const key = resolveCatalogKey(vin, make);
  if (!key) return [STANDARD_ODOMETER_PID];

  const catalog = await loadCatalog(key);
  if (!catalog || !isManufacturerCatalog(catalog)) return [STANDARD_ODOMETER_PID];

  const matches = catalog.dids
    .filter(looksLikeOdometer)
    // Verified entries (community-confirmed against real hardware) first.
    .sort((a, b) => Number(b.verified ?? false) - Number(a.verified ?? false))
    .map((did) => toOdometerPidDef(did, catalog.display_name))
    .filter((def): def is OdometerPidDef => def !== null);

  return [...matches, STANDARD_ODOMETER_PID];
}
