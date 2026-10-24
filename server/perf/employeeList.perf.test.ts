import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { EmployeeListPage } from '@acme/contracts';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { replaceAllEmployees } from '../src/seed/seedDatabase.ts';
import { createTestApp } from '../test/testApp.ts';

const FIRST_PAGE_BUDGET_MS = 1000;

describe('employee list performance with 10,000 employees', () => {
  const { app, db } = createTestApp({ today: '2026-10-24' });

  beforeAll(() => {
    const seeded = generateSeedEmployees({
      count: SEED_EMPLOYEE_COUNT,
      randomSeed: SEED_RANDOM_SEED,
      today: '2026-10-24',
    });
    replaceAllEmployees(db, seeded, '2026-10-24T00:00:00.000Z');
  });

  it('serves the first page in under one second', async () => {
    const startedAt = performance.now();
    const response = await request(app).get('/api/employees?page=1');
    const elapsedMs = performance.now() - startedAt;

    const body = response.body as EmployeeListPage;
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(25);
    expect(body.total).toBe(10_000);
    expect(elapsedMs).toBeLessThan(FIRST_PAGE_BUDGET_MS);
  });
});
