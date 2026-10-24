import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CountryInsights } from '@acme/contracts';
import { insertEmployee } from '../../test/builders.ts';
import { createTestApp } from '../../test/testApp.ts';

type TestApp = ReturnType<typeof createTestApp>;

async function getCountryInsights(app: TestApp['app']): Promise<CountryInsights> {
  const response = await request(app).get('/api/insights/countries');
  expect(response.status).toBe(200);
  return response.body as CountryInsights;
}

function salariesIn(db: TestApp['db'], countryCode: 'US' | 'IN' | 'GB', amounts: number[]) {
  for (const amount of amounts) {
    insertEmployee(db, { countryCode, salaryHistory: [{ amount, effectiveDate: '2020-01-15' }] });
  }
}

describe('GET /api/insights/countries', () => {
  it('returns no countries when there are no employees', async () => {
    const { app } = createTestApp();

    expect(await getCountryInsights(app)).toEqual({ countries: [] });
  });

  it('computes headcount, min, max, mean and median per country in its currency', async () => {
    const { app, db } = createTestApp();
    salariesIn(db, 'US', [60_000, 80_000, 130_000]);
    salariesIn(db, 'IN', [1_000_000, 2_000_000, 2_000_001, 3_000_000]);

    const { countries } = await getCountryInsights(app);

    expect(countries).toEqual([
      {
        country: 'IN',
        countryName: 'India',
        currency: 'INR',
        headcount: 4,
        min: 1_000_000,
        max: 3_000_000,
        mean: 2_000_000,
        median: 2_000_001,
      },
      {
        country: 'US',
        countryName: 'United States',
        currency: 'USD',
        headcount: 3,
        min: 60_000,
        max: 130_000,
        mean: 90_000,
        median: 80_000,
      },
    ]);
  });

  it('orders countries by name A to Z, not by code', async () => {
    const { app, db } = createTestApp();
    salariesIn(db, 'US', [1]);
    salariesIn(db, 'GB', [1]);
    salariesIn(db, 'IN', [1]);

    const { countries } = await getCountryInsights(app);

    expect(countries.map((c) => c.countryName)).toEqual([
      'India',
      'United Kingdom',
      'United States',
    ]);
  });

  it('rounds a half-way mean and median up', async () => {
    const { app, db } = createTestApp();
    salariesIn(db, 'US', [1, 2]);

    const [us] = (await getCountryInsights(app)).countries;

    expect(us).toMatchObject({ mean: 2, median: 2 });
  });

  it('uses each employee current salary, not older history', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      countryCode: 'US',
      salaryHistory: [
        { amount: 50_000, effectiveDate: '2019-01-01' },
        { amount: 70_000, effectiveDate: '2023-01-01' },
      ],
    });

    const [us] = (await getCountryInsights(app)).countries;

    expect(us).toMatchObject({ headcount: 1, min: 70_000, max: 70_000 });
  });

  it('excludes inactive employees from every figure', async () => {
    const { app, db } = createTestApp();
    salariesIn(db, 'US', [100_000]);
    insertEmployee(db, {
      countryCode: 'US',
      status: 'inactive',
      exitDate: '2024-01-01',
      salaryHistory: [{ amount: 900_000, effectiveDate: '2020-01-15' }],
    });

    const [us] = (await getCountryInsights(app)).countries;

    expect(us).toMatchObject({ headcount: 1, max: 100_000, mean: 100_000 });
  });

  it('omits a country whose employees are all inactive', async () => {
    const { app, db } = createTestApp();
    salariesIn(db, 'US', [100_000]);
    insertEmployee(db, { countryCode: 'IN', status: 'inactive', exitDate: '2024-01-01' });

    const { countries } = await getCountryInsights(app);

    expect(countries.map((c) => c.country)).toEqual(['US']);
  });

  describe('after changes through the API', () => {
    const newHire = {
      fullName: 'New Hire',
      email: 'new.hire@acme.example',
      jobTitle: 'Analyst',
      department: 'Finance',
      country: 'US',
      annualSalary: 200_000,
      employmentType: 'Full-time',
      hireDate: '2024-01-01',
    };

    it('reflects a newly added employee', async () => {
      const { app, db } = createTestApp();
      salariesIn(db, 'US', [100_000]);

      await request(app).post('/api/employees').send(newHire).expect(201);

      const [us] = (await getCountryInsights(app)).countries;
      expect(us).toMatchObject({ headcount: 2, max: 200_000, mean: 150_000 });
    });

    it('reflects a salary change', async () => {
      const { app, db } = createTestApp();
      const id = insertEmployee(db, {
        countryCode: 'US',
        salaryHistory: [{ amount: 100_000, effectiveDate: '2020-01-15' }],
      });

      await request(app)
        .patch(`/api/employees/${id}`)
        .send({ salaryChange: { amount: 120_000 } })
        .expect(200);

      const [us] = (await getCountryInsights(app)).countries;
      expect(us).toMatchObject({ min: 120_000, max: 120_000 });
    });

    it('moves an employee to the new country in its currency after a country change', async () => {
      const { app, db } = createTestApp();
      const id = insertEmployee(db, { countryCode: 'US' });

      await request(app)
        .patch(`/api/employees/${id}`)
        .send({ country: 'IN', salaryChange: { amount: 2_500_000 } })
        .expect(200);

      const { countries } = await getCountryInsights(app);
      expect(countries).toHaveLength(1);
      expect(countries[0]).toMatchObject({
        country: 'IN',
        currency: 'INR',
        headcount: 1,
        min: 2_500_000,
      });
    });

    it('drops a deleted employee from the figures', async () => {
      const { app, db } = createTestApp();
      salariesIn(db, 'US', [100_000]);
      const id = insertEmployee(db, {
        countryCode: 'US',
        salaryHistory: [{ amount: 300_000, effectiveDate: '2020-01-15' }],
      });

      await request(app).delete(`/api/employees/${id}`).expect(200);

      const [us] = (await getCountryInsights(app)).countries;
      expect(us).toMatchObject({ headcount: 1, max: 100_000 });
    });
  });
});
