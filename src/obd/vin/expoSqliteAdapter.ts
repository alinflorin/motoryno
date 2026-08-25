/**
 * `DatabaseAdapter` implementation (the interface corgi's decoder expects -
 * see `corgi/db/adapter.ts`) backed by `expo-sqlite`, the only SQLite binding
 * that actually works in this app's React Native/Expo environment.
 */

import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { DatabaseAdapter, QueryResult } from '@/obd/vin/corgi/db/adapter';

export class ExpoSqliteAdapter implements DatabaseAdapter {
  constructor(private db: SQLiteDatabase) {}

  async exec(query: string, params: unknown[] = []): Promise<QueryResult[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(query, params as SQLiteBindValue[]);
    if (rows.length === 0) {
      return [{ columns: [], values: [] }];
    }

    const columns = Object.keys(rows[0]);
    const values = rows.map((row) => columns.map((column) => row[column]));
    return [{ columns, values }];
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }
}
