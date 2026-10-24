import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AppDatabase } from './database.ts';

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, '../../drizzle');

export function runMigrations(db: AppDatabase): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
