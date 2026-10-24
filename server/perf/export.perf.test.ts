import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { replaceAllEmployees } from '../src/seed/seedDatabase.ts';
import { createTestApp } from '../test/testApp.ts';

const EXPORT_BUDGET_MS = 5000;

describe('employee export performance with 10,000 employees', () => {
  const { app, db } = createTestApp({ today: '2026-10-24' });

  beforeAll(() => {
    const seeded = generateSeedEmployees({
      count: SEED_EMPLOYEE_COUNT,
      randomSeed: SEED_RANDOM_SEED,
      today: '2026-10-24',
    });
    replaceAllEmployees(db, seeded, '2026-10-24T00:00:00.000Z');
  });

  it('exports every active employee in under five seconds', async () => {
    const startedAt = performance.now();
    const response = await request(app)
      .get('/api/exports/employees')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(elapsedMs).toBeLessThan(EXPORT_BUDGET_MS);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as ExcelJS.Buffer);
    expect(workbook.worksheets[0]!.rowCount).toBeGreaterThan(1000);
  });
});
