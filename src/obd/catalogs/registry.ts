/**
 * Generated registry mapping each bundled Delphi-OBD DTC catalog to its Metro asset
 * module. Catalog files live in `assets/obd-catalogs/*.catalog` (renamed from `.json`
 * so Metro treats them as opaque binary assets instead of inlining them into the JS
 * bundle - see `metro.config.js`). Regenerate this file if the vendored DTC catalog
 * set changes (re-run the vendoring steps against github.com/erdesigns-eu/Delphi-OBD).
 *
 * Only the small `dtc-*` catalogs (~880KB total) were ever bundled this way - the
 * ~54MB of manufacturer catalogs were removed earlier; see `catalogs/odometerCatalog.json`
 * and `scripts/generate-odometer-catalog.mjs` for the odometer read path, which
 * doesn't depend on this registry at all.
 *
 * 2026-08-26: the `dtc-*` catalogs themselves were also pulled (not wired into
 * any screen yet - see `catalogs/dtc.ts`) and will be re-vendored under
 * `assets/obd-catalogs/` when the DTC detector feature is picked up. Until
 * then this map is empty and `catalogKeys()`/`lookupDtc()` are no-ops.
 *
 * Metro resolves asset modules via static `require()` calls only - these can't be
 * expressed as ES imports, so re-add an eslint-disable comment for the
 * `@typescript-eslint/no-require-imports` rule when this map is populated again.
 */

export const CATALOG_ASSETS: Record<string, number> = {};
