import type { Express } from 'express';
import type { AppDatabase } from './db/database.ts';
import type { Clock } from './shared/clock.ts';

export function createApp(_deps: { db: AppDatabase; clock: Clock }): Express {
  throw new Error('not implemented');
}
