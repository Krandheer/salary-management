import { sql } from 'drizzle-orm';
import type { AppDatabase } from '../db/database.ts';
import {
  employees,
  salaryHistory,
  type NewEmployeeRow,
  type NewSalaryHistoryRow,
} from '../db/schema.ts';
import { toEmployeeColumns } from '../employees/employeeColumns.ts';
import { currencyFor } from '../reference/referenceData.ts';
import type { Clock } from '../shared/clock.ts';
import { generateSeedEmployees, type SeedEmployee } from './generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from './seedCatalogue.ts';

const EMPLOYEE_CHUNK_SIZE = 500;
const HISTORY_CHUNK_SIZE = 1000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

function toEmployeeRow(employee: SeedEmployee, id: number, recordedAt: string): NewEmployeeRow {
  return {
    id,
    ...toEmployeeColumns(employee),
    status: 'active',
    exitDate: null,
    createdAt: recordedAt,
  };
}

function toHistoryRows(
  employee: SeedEmployee,
  employeeId: number,
  recordedAt: string,
): NewSalaryHistoryRow[] {
  const currency = currencyFor(employee.countryCode);
  return employee.salaryHistory.map((entry) => ({
    employeeId,
    amount: entry.amount,
    currency,
    effectiveDate: entry.effectiveDate,
    reason: entry.reason,
    recordedAt,
  }));
}

/** Replaces every employee and salary history row in one transaction; any failure rolls back. */
export function replaceAllEmployees(
  db: AppDatabase,
  seedEmployees: SeedEmployee[],
  recordedAt: string,
): void {
  const employeeRows = seedEmployees.map((employee, i) =>
    toEmployeeRow(employee, i + 1, recordedAt),
  );
  const historyRows = seedEmployees.flatMap((employee, i) =>
    toHistoryRows(employee, i + 1, recordedAt),
  );

  db.transaction(() => {
    db.delete(salaryHistory).run();
    db.delete(employees).run();
    db.run(sql`DELETE FROM sqlite_sequence WHERE name IN ('employees', 'salary_history')`);
    for (const rows of chunk(employeeRows, EMPLOYEE_CHUNK_SIZE)) {
      db.insert(employees).values(rows).run();
    }
    for (const rows of chunk(historyRows, HISTORY_CHUNK_SIZE)) {
      db.insert(salaryHistory).values(rows).run();
    }
  });
}

function hasNoEmployees(db: AppDatabase): boolean {
  return db.select({ id: employees.id }).from(employees).limit(1).all().length === 0;
}

/** Seeds the demo data set only into an empty database; returns whether it seeded. */
export function seedIfEmpty(db: AppDatabase, clock: Clock): boolean {
  if (!hasNoEmployees(db)) return false;
  const seeded = generateSeedEmployees({
    count: SEED_EMPLOYEE_COUNT,
    randomSeed: SEED_RANDOM_SEED,
    today: clock.today(),
  });
  replaceAllEmployees(db, seeded, clock.now());
  return true;
}
