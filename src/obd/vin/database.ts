/**
 * Prepares and opens the bundled vPIC VIN database (the same dataset
 * `@cardog/corgi` ships, see `README.md` in this folder). It's vendored as a
 * gzipped asset - `assets/data/vpic.lite.db.gz` (~25MB) - to keep it out of
 * the JS bundle; the first time it's needed on a device it's decompressed
 * once into expo-sqlite's database directory and reused after that.
 */

import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { inflate } from 'pako';

const DB_ASSET_MODULE = require('@/assets/data/vpic.lite.db.gz');
const DB_FILE_NAME = 'vpic.lite.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function ensureDatabaseFile(): Promise<void> {
  const directory = new Directory(defaultDatabaseDirectory);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  const dbFile = new File(directory, DB_FILE_NAME);
  if (dbFile.exists) return;

  const asset = Asset.fromModule(DB_ASSET_MODULE);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('vPIC database asset failed to resolve a local URI');
  }

  const compressed = await new File(asset.localUri).bytes();
  const decompressed = inflate(compressed);

  dbFile.create({ intermediates: true });
  dbFile.write(decompressed);
}

/** Opens (decompressing/copying into place on first use) the shared vPIC database connection. Safe to call repeatedly - the same connection is reused. */
export async function openVpicDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      await ensureDatabaseFile();
      return openDatabaseAsync(DB_FILE_NAME, undefined, defaultDatabaseDirectory);
    })();
  }
  return databasePromise;
}
