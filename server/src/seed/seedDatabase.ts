import type { AppDatabase } from '../db/database.ts';
import type { SeedEmployee } from './generateEmployees.ts';

export function replaceAllEmployees(
  _db: AppDatabase,
  _employees: SeedEmployee[],
  _recordedAt: string,
): void {
  throw new Error('not implemented');
}
