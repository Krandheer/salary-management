import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ImportResult } from '@acme/contracts';
import { EmployeeRepository } from '../src/employees/employeeRepository.ts';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { replaceAllEmployees } from '../src/seed/seedDatabase.ts';
import { buildEmployeesWorkbook } from '../src/spreadsheet/workbookWriter.ts';
import { createTestApp, createTestDb } from '../test/testApp.ts';

const APPLY_BUDGET_MS = 30_000;
const TODAY = '2026-10-24';

/** An export of 10,000 seeded employees, taken from a separate database. */
async function buildTenThousandRowFile(): Promise<Buffer> {
  const source = createTestDb();
  const seeded = generateSeedEmployees({
    count: SEED_EMPLOYEE_COUNT,
    randomSeed: SEED_RANDOM_SEED,
    today: TODAY,
  });
  replaceAllEmployees(source, seeded, `${TODAY}T00:00:00.000Z`);
  const rows = new EmployeeRepository(source).listForExport({
    status: 'active',
    searchKey: null,
    country: null,
    department: null,
    jobTitleKey: null,
  });
  return buildEmployeesWorkbook(rows);
}

describe('import apply performance with a 10,000-row file', () => {
  const { app, db } = createTestApp({ today: TODAY });
  let content: Buffer;

  beforeAll(async () => {
    content = await buildTenThousandRowFile();
  });

  it('creates every employee in under thirty seconds', async () => {
    const startedAt = performance.now();
    const response = await request(app)
      .post('/api/imports')
      .attach('file', content, 'employees.xlsx');
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(elapsedMs).toBeLessThan(APPLY_BUDGET_MS);
    expect(response.body as ImportResult).toEqual({
      created: SEED_EMPLOYEE_COUNT,
      updated: 0,
      unchanged: 0,
    });
    const { total } = db.$client.prepare('SELECT COUNT(*) AS total FROM employees').get() as {
      total: number;
    };
    expect(total).toBe(SEED_EMPLOYEE_COUNT);
  });
});
