import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/testApp.ts';
import { runMigrations } from './migrate.ts';
import type { AppDatabase } from './database.ts';

function insertEmployeeRow(db: AppDatabase, email: string, status: 'active' | 'inactive'): number {
  const exitDate = status === 'inactive' ? '2026-01-01' : null;
  const info = db.$client
    .prepare(
      `INSERT INTO employees (full_name, name_key, email, job_title, job_title_key, department,
         country_code, employment_type, hire_date, status, exit_date, created_at)
       VALUES ('A B', 'a b', ?, 'Dev', 'dev', 'Engineering', 'US', 'Full-time', '2020-01-01', ?, ?, 't')`,
    )
    .run(email, status, exitDate);
  return Number(info.lastInsertRowid);
}

function insertHistoryRow(db: AppDatabase, employeeId: number, amount: number, date: string) {
  db.$client
    .prepare(
      `INSERT INTO salary_history (employee_id, amount, currency, effective_date, recorded_at)
       VALUES (?, ?, 'USD', ?, 't')`,
    )
    .run(employeeId, amount, date);
}

function currentSalaryOf(db: AppDatabase, employeeId: number): number | undefined {
  const row = db.$client
    .prepare('SELECT amount FROM current_salaries WHERE employee_id = ?')
    .get(employeeId) as { amount: number } | undefined;
  return row?.amount;
}

describe('runMigrations', () => {
  it('is a no-op when applied a second time', () => {
    const db = createTestDb();

    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe('employees active-email uniqueness', () => {
  it('rejects two active employees with the same email', () => {
    const db = createTestDb();
    insertEmployeeRow(db, 'a@acme.example', 'active');

    expect(() => insertEmployeeRow(db, 'a@acme.example', 'active')).toThrow(/UNIQUE/);
  });

  it('allows an inactive and an active employee to share an email', () => {
    const db = createTestDb();
    insertEmployeeRow(db, 'a@acme.example', 'inactive');

    expect(() => insertEmployeeRow(db, 'a@acme.example', 'active')).not.toThrow();
  });

  it('rejects an inactive employee without an exit date', () => {
    const db = createTestDb();

    expect(() =>
      db.$client
        .prepare(
          `INSERT INTO employees (full_name, name_key, email, job_title, job_title_key, department,
             country_code, employment_type, hire_date, status, exit_date, created_at)
           VALUES ('A', 'a', 'x@y.z', 'D', 'd', 'Sales', 'US', 'Full-time', '2020-01-01', 'inactive', NULL, 't')`,
        )
        .run(),
    ).toThrow(/CHECK/);
  });
});

describe('current_salaries view', () => {
  it('picks the entry with the latest effective date even if recorded earlier', () => {
    const db = createTestDb();
    const id = insertEmployeeRow(db, 'a@acme.example', 'active');
    insertHistoryRow(db, id, 200, '2024-06-01');
    insertHistoryRow(db, id, 100, '2022-06-01');

    expect(currentSalaryOf(db, id)).toBe(200);
  });

  it('breaks a same-day tie in favour of the higher id', () => {
    const db = createTestDb();
    const id = insertEmployeeRow(db, 'a@acme.example', 'active');
    insertHistoryRow(db, id, 100, '2024-06-01');
    insertHistoryRow(db, id, 150, '2024-06-01');

    expect(currentSalaryOf(db, id)).toBe(150);
  });

  it('has exactly one row per employee', () => {
    const db = createTestDb();
    const id = insertEmployeeRow(db, 'a@acme.example', 'active');
    insertHistoryRow(db, id, 100, '2022-01-01');
    insertHistoryRow(db, id, 120, '2023-01-01');

    const count = db.$client
      .prepare('SELECT COUNT(*) AS n FROM current_salaries WHERE employee_id = ?')
      .get(id) as { n: number };
    expect(count.n).toBe(1);
  });
});
