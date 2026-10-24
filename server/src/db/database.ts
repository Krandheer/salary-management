import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './schema.ts';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function openDatabase(_path: string): AppDatabase {
  throw new Error('not implemented');
}
