import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ImportPreview } from '@acme/contracts';
import { EmployeeRepository } from '../src/employees/employeeRepository.ts';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { replaceAllEmployees } from '../src/seed/seedDatabase.ts';
import { buildEmployeesWorkbook } from '../src/spreadsheet/workbookWriter.ts';
import { createTestApp } from '../test/testApp.ts';

const PREVIEW_BUDGET_MS = 30_000;
const TODAY = '2026-10-24';

describe('import preview performance with a 10,000-row file', () => {
  const { app, db } = createTestApp({ today: TODAY });
  let content: Buffer;

  beforeAll(async () => {
    const seeded = generateSeedEmployees({
      count: SEED_EMPLOYEE_COUNT,
      randomSeed: SEED_RANDOM_SEED,
      today: TODAY,
    });
    replaceAllEmployees(db, seeded, `${TODAY}T00:00:00.000Z`);
    const rows = new EmployeeRepository(db).listForExport({
      status: 'active',
      searchKey: null,
      country: null,
      department: null,
      jobTitleKey: null,
    });
    const withEveryOtherRaised = rows.map((row, index) =>
      index % 2 === 0 ? { ...row, annualSalary: row.annualSalary + 1 } : row,
    );
    content = await buildEmployeesWorkbook(withEveryOtherRaised);
  });

  it('previews every row in under thirty seconds', async () => {
    const startedAt = performance.now();
    const response = await request(app)
      .post('/api/imports/preview')
      .attach('file', content, 'employees.xlsx');
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(elapsedMs).toBeLessThan(PREVIEW_BUDGET_MS);
    const preview = response.body as ImportPreview;
    expect(preview.totals).toEqual({
      create: 0,
      update: SEED_EMPLOYEE_COUNT / 2,
      unchanged: SEED_EMPLOYEE_COUNT / 2,
      error: 0,
    });
  });
});
