import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export type AppDatabase = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const IN_MEMORY_PATH = ':memory:';

export function openDatabase(path: string): AppDatabase {
  const isInMemory = path === IN_MEMORY_PATH;
  if (!isInMemory) mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  if (!isInMemory) client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  return drizzle({ client, schema });
}
