import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/testApp.ts';
import { generateSeedEmployees } from './generateEmployees.ts';
import { replaceAllEmployees, seedIfEmpty } from './seedDatabase.ts';
import { SEED_EMPLOYEE_COUNT } from './seedCatalogue.ts';
import { fixedClock } from '../shared/clock.ts';
import { insertEmployee } from '../../test/builders.ts';
import type { AppDatabase } from '../db/database.ts';

const SEED_OPTIONS = { count: 600, randomSeed: 7, today: '2026-10-24' };
const RECORDED_AT = '2026-10-24T00:00:00.000Z';

function countRows(db: AppDatabase, table: 'employees' | 'salary_history'): number {
  const row = db.$client.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

function readEmails(db: AppDatabase): string[] {
  const rows = db.$client.prepare('SELECT email FROM employees ORDER BY id').all() as {
    email: string;
  }[];
  return rows.map((row) => row.email);
}

describe('replaceAllEmployees', () => {
  it('stores every generated employee as active with a current salary', () => {
    const db = createTestDb();

    replaceAllEmployees(db, generateSeedEmployees(SEED_OPTIONS), RECORDED_AT);

    expect(countRows(db, 'employees')).toBe(600);
    const active = db.$client
      .prepare(`SELECT COUNT(*) AS n FROM employees WHERE status = 'active'`)
      .get() as { n: number };
    expect(active.n).toBe(600);
    const withSalary = db.$client.prepare('SELECT COUNT(*) AS n FROM current_salaries').get() as {
      n: number;
    };
    expect(withSalary.n).toBe(600);
  });

  it('leaves the same employees with no duplicates when run twice', () => {
    const db = createTestDb();
    const employees = generateSeedEmployees(SEED_OPTIONS);

    replaceAllEmployees(db, employees, RECORDED_AT);
    const emailsAfterFirstRun = readEmails(db);
    const historyAfterFirstRun = countRows(db, 'salary_history');
    replaceAllEmployees(db, employees, RECORDED_AT);

    expect(countRows(db, 'employees')).toBe(600);
    expect(readEmails(db)).toEqual(emailsAfterFirstRun);
    expect(new Set(readEmails(db)).size).toBe(600);
    expect(countRows(db, 'salary_history')).toBe(historyAfterFirstRun);
  });

  it('replaces existing employees rather than appending to them', () => {
    const db = createTestDb();
    replaceAllEmployees(db, generateSeedEmployees(SEED_OPTIONS), RECORDED_AT);

    replaceAllEmployees(db, generateSeedEmployees({ ...SEED_OPTIONS, count: 40 }), RECORDED_AT);

    expect(countRows(db, 'employees')).toBe(40);
  });
});

describe('seedIfEmpty', () => {
  it('seeds the full demo data set into an empty database and reports it', () => {
    const db = createTestDb();

    const didSeed = seedIfEmpty(db, fixedClock('2026-10-24'));

    expect(didSeed).toBe(true);
    expect(countRows(db, 'employees')).toBe(SEED_EMPLOYEE_COUNT);
  });

  it('leaves existing data untouched and reports nothing seeded', () => {
    const db = createTestDb();
    insertEmployee(db, { fullName: 'Existing Person' });

    const didSeed = seedIfEmpty(db, fixedClock('2026-10-24'));

    expect(didSeed).toBe(false);
    expect(countRows(db, 'employees')).toBe(1);
  });
});
