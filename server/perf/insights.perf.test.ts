import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CountryInsights } from '@acme/contracts';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { replaceAllEmployees } from '../src/seed/seedDatabase.ts';
import { createTestApp } from '../test/testApp.ts';

const INSIGHTS_BUDGET_MS = 1000;

describe('country insights performance with 10,000 employees', () => {
  const { app, db } = createTestApp({ today: '2026-10-24' });

  beforeAll(() => {
    const seeded = generateSeedEmployees({
      count: SEED_EMPLOYEE_COUNT,
      randomSeed: SEED_RANDOM_SEED,
      today: '2026-10-24',
    });
    replaceAllEmployees(db, seeded, '2026-10-24T00:00:00.000Z');
  });

  it('serves country insights in under one second', async () => {
    const startedAt = performance.now();
    const response = await request(app).get('/api/insights/countries');
    const elapsedMs = performance.now() - startedAt;

    const { countries } = response.body as CountryInsights;
    expect(response.status).toBe(200);
    expect(countries.length).toBeGreaterThan(0);
    expect(countries.reduce((sum, country) => sum + country.headcount, 0)).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(INSIGHTS_BUDGET_MS);
  });
});
