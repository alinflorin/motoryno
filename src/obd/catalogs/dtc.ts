/**
 * DTC (diagnostic trouble code) lookups against the bundled `dtc-*` catalogs
 * - not wired into any screen yet, this is the data layer for the README's
 * "DTC detector feature" (scan for codes, explain what they mean). Ready to
 * build the UI against once that feature is picked up.
 */

import { catalogKeys, loadCatalog } from '@/obd/catalogs/loader';
import type { DtcEntry } from '@/obd/catalogs/types';
import { isDtcCatalog } from '@/obd/catalogs/types';

const DTC_CATALOG_KEYS = catalogKeys().filter((key) => key.startsWith('dtc-'));

/** Manufacturer-specific DTC catalogs are checked before the generic ISO 15031 / SAE J2012 one, since a brand code can shadow a generic meaning. */
function orderedCatalogKeys(make: string | null): string[] {
  const normalizedMake = make?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const brandKey = normalizedMake ? DTC_CATALOG_KEYS.find((key) => key.slice('dtc-'.length).replace(/-/g, '') === normalizedMake) : undefined;

  const rest = DTC_CATALOG_KEYS.filter((key) => key !== brandKey);
  return brandKey ? [brandKey, ...rest] : rest;
}

/** Looks up a DTC code (e.g. "P0100"), preferring the car's own make's catalog before falling back to generic standards catalogs. */
export async function lookupDtc(code: string, make: string | null = null): Promise<DtcEntry | null> {
  const normalizedCode = code.trim().toUpperCase();

  for (const key of orderedCatalogKeys(make)) {
    const catalog = await loadCatalog(key);
    if (!catalog || !isDtcCatalog(catalog)) continue;
    const match = catalog.dtcs.find((dtc) => dtc.code.toUpperCase() === normalizedCode);
    if (match) return match;
  }
  return null;
}
