import type { Express } from 'express';
import type { IsoDate } from '@acme/contracts';
import { createApp } from '../src/app.ts';
import { openDatabase, type AppDatabase } from '../src/db/database.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { fixedClock, type Clock } from '../src/shared/clock.ts';

export const DEFAULT_TEST_TODAY: IsoDate = '2026-10-24';

export function createTestDb(): AppDatabase {
  const db = openDatabase(':memory:');
  runMigrations(db);
  return db;
}

export function createTestApp(options: { today?: IsoDate } = {}): {
  app: Express;
  db: AppDatabase;
  clock: Clock;
} {
  const db = createTestDb();
  const clock = fixedClock(options.today ?? DEFAULT_TEST_TODAY);
  return { app: createApp({ db, clock }), db, clock };
}
