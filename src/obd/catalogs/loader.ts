/**
 * Loads one bundled Delphi-OBD catalog on demand. Catalogs are shipped as
 * opaque `.catalog` assets (see `metro.config.js`) rather than imported as
 * JSON, so they don't get parsed into the JS bundle at startup - only the
 * one or two catalogs actually needed (the car's manufacturer, plus DTC
 * lookups) are read off disk, and only the first time they're needed.
 */

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { CATALOG_ASSETS } from '@/obd/catalogs/registry';
import type { Catalog } from '@/obd/catalogs/types';

const cache = new Map<string, Promise<Catalog | null>>();

async function readCatalog(key: string): Promise<Catalog | null> {
  const moduleId = CATALOG_ASSETS[key];
  if (moduleId === undefined) return null;

  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) return null;

  const text = await new File(asset.localUri).text();
  return JSON.parse(text) as Catalog;
}

/** Loads a bundled catalog by its registry key (e.g. `'mercedes'`, `'dtc-bmw'`). Cached after the first read. */
export function loadCatalog(key: string): Promise<Catalog | null> {
  let pending = cache.get(key);
  if (!pending) {
    pending = readCatalog(key);
    cache.set(key, pending);
  }
  return pending;
}

/** Every catalog key this app has bundled - mainly useful for iterating DTC catalogs. */
export function catalogKeys(): string[] {
  return Object.keys(CATALOG_ASSETS);
}
