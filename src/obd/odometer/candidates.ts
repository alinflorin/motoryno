/**
 * The odometer requests worth trying on a car whose exact source isn't
 * known yet, in order:
 *
 * 1. The standard SAE J1979 Mode 01 PID 0xA6 "Odometer". Only defined since
 *    J1979-2/OBDonUDS, so it's answered by roughly 2019+ vehicles - but it's
 *    one cheap request, and universal where it exists.
 * 2. Manufacturer DIDs from the bundled `odometerCatalog.json` (a slice of
 *    the Delphi-OBD catalogs, matched by the VIN's WMI or the make text).
 *    Largely unverified community data - treated as hints.
 * 3. Make-specific strategies with real addressing knowledge, currently
 *    `mercedes.ts`.
 *
 * Anything that doesn't answer here is left to the learn flow
 * (`learn.ts`), which is what actually finds the odometer on most pre-2019
 * cars.
 */

import odometerCatalog from '@/obd/catalogs/odometerCatalog.json';
import manufacturerNames from '@/obd/catalogs/manufacturerNames.json';
import wmiIndex from '@/obd/catalogs/wmiIndex.json';
import { mercedesKnownOdometerSources } from '@/obd/odometer/mercedes';
import type { ByteField, OdometerSource, RequestOdometerSource } from '@/obd/odometer/source';
import { odometerSourceKey } from '@/obd/odometer/source';

interface CatalogDecoder {
  kind: string;
  scale?: number;
  offset?: number;
  unit?: string;
}

interface CatalogDidEntry {
  name: string;
  did: string;
  ecu_address?: string;
  decoder?: CatalogDecoder;
  verified?: boolean;
}

const ODOMETER_CATALOG = odometerCatalog as Record<string, { display_name: string; dids: CatalogDidEntry[] }>;

export const STANDARD_ODOMETER_SOURCE: RequestOdometerSource = {
  kind: 'request',
  label: 'OBD-II Mode 01 PID A6 (odometer)',
  request: '01A6',
  field: { offset: 0, length: 4, endian: 'be', scale: 0.1 },
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Resolves the catalog key for this vehicle: VIN's WMI first (exact), then a fuzzy match on `make`. */
export function resolveManufacturerKey(vin: string | null, make: string | null): string | null {
  const wmi = vin && vin.length >= 3 ? vin.slice(0, 3).toUpperCase() : null;
  const byWmi = wmi ? (wmiIndex as Record<string, string>)[wmi] : undefined;
  if (byWmi) return byWmi;

  if (!make) return null;
  const normalizedMake = normalizeText(make);
  if (!normalizedMake) return null;

  for (const [key, displayName] of Object.entries(manufacturerNames as Record<string, string>)) {
    const normalizedDisplay = normalizeText(displayName);
    if (normalizedDisplay.includes(normalizedMake) || normalizedMake.includes(normalizedDisplay)) {
      return key;
    }
  }
  return null;
}

/** Maps a catalog decoder description onto a concrete byte field. The catalog's `hex` kind carries no width; its odometer entries are documented as 24-bit. */
function catalogField(decoder: CatalogDecoder | undefined): ByteField {
  const kind = decoder?.kind ?? 'uint32_be';
  const length = kind.includes('16') ? 2 : kind.includes('24') || kind === 'hex' ? 3 : 4;
  const scale = (decoder?.scale ?? 1) * (decoder?.unit === 'mi' ? 1.60934 : 1);
  return { offset: 0, length, endian: kind.endsWith('_le') ? 'le' : 'be', scale };
}

function catalogOdometerSources(vin: string | null, make: string | null): OdometerSource[] {
  const key = resolveManufacturerKey(vin, make);
  const entry = key ? ODOMETER_CATALOG[key] : undefined;
  if (!entry) return [];
  return entry.dids.map((did) => ({
    kind: 'request',
    label: `${entry.display_name}: ${did.name} (22 ${did.did}${did.ecu_address ? ` @ ${did.ecu_address}` : ''})`,
    header: did.ecu_address?.replace(/^0x/i, ''),
    request: `22${did.did}`,
    field: catalogField(did.decoder),
  }));
}

/** Every request worth trying up front for this vehicle, de-duplicated, generic first. */
export function vehicleOdometerSources(vin: string | null, make: string | null): OdometerSource[] {
  const all: OdometerSource[] = [
    STANDARD_ODOMETER_SOURCE,
    ...catalogOdometerSources(vin, make),
    ...mercedesKnownOdometerSources(vin, make),
  ];
  const seen = new Set<string>();
  return all.filter((source) => {
    const key = odometerSourceKey(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
