import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  CountryInsights,
  CountryJobTitleInsights,
  EmployeeListPage,
  OrganisationComparison,
} from '@acme/contracts';
import { insertEmployee } from '../../test/builders.ts';
import { createTestApp } from '../../test/testApp.ts';
import { currencyFor, RATES_AS_OF, RATES_SOURCE, toUsdRates } from '../reference/referenceData.ts';

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

    it("keeps every active employee's current salary in their country's currency after mixed edits", async () => {
      const { app, db } = createTestApp();
      const history = (amounts: [number, string][]) =>
        amounts.map(([amount, effectiveDate]) => ({ amount, effectiveDate }));
      const movedBackdated = insertEmployee(db, {
        countryCode: 'IN',
        salaryHistory: history([
          [1_850_000, '2020-01-15'],
          [2_000_000, '2024-01-01'],
        ]),
      });
      const movedToday = insertEmployee(db, { countryCode: 'US' });
      const raisedBackdated = insertEmployee(db, {
        countryCode: 'CA',
        salaryHistory: history([
          [80_000, '2020-01-15'],
          [90_000, '2024-01-01'],
        ]),
      });
      const movedOnCurrentDate = insertEmployee(db, {
        countryCode: 'GB',
        salaryHistory: history([
          [50_000, '2020-01-15'],
          [55_000, '2023-03-01'],
        ]),
      });
      const edits: [number, object][] = [
        [
          movedBackdated,
          { country: 'JP', salaryChange: { amount: 9_500_000, effectiveDate: '2022-01-01' } },
        ],
        [movedToday, { country: 'SG', salaryChange: { amount: 120_000 } }],
        [raisedBackdated, { salaryChange: { amount: 85_000, effectiveDate: '2022-01-01' } }],
        [
          movedOnCurrentDate,
          { country: 'DE', salaryChange: { amount: 60_000, effectiveDate: '2023-03-01' } },
        ],
        [
          movedToday,
          { country: 'AU', salaryChange: { amount: 150_000, effectiveDate: '2021-01-01' } },
        ],
      ];
      for (const [id, body] of edits) await request(app).patch(`/api/employees/${id}`).send(body);

      const { body: list } = await request(app).get('/api/employees');
      const { countries } = await getCountryInsights(app);

      const items = (list as EmployeeListPage).items;
      expect(items).toHaveLength(4);
      for (const item of items) expect(item.currency).toBe(currencyFor(item.country));
      expect(countries.map(({ country, headcount }) => [country, headcount])).toEqual(
        ['CA', 'DE', 'IN', 'SG'].map((code) => [code, 1]),
      );
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

describe('GET /api/insights/countries/:code/job-titles', () => {
  async function getJobTitles(app: TestApp['app'], code: string) {
    return request(app).get(`/api/insights/countries/${code}/job-titles`);
  }

  function hire(db: TestApp['db'], jobTitle: string, amount: number, extra = {}) {
    insertEmployee(db, {
      countryCode: 'US',
      jobTitle,
      salaryHistory: [{ amount, effectiveDate: '2020-01-15' }],
      ...extra,
    });
  }

  it('computes headcount, min, max, mean and median per job title in the country currency', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Analyst', 60_000);
    hire(db, 'Analyst', 80_000);
    hire(db, 'Analyst', 130_000);
    hire(db, 'Designer', 70_000);

    const response = await getJobTitles(app, 'US');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      country: 'US',
      countryName: 'United States',
      currency: 'USD',
      jobTitles: [
        {
          jobTitle: 'Analyst',
          headcount: 3,
          min: 60_000,
          max: 130_000,
          mean: 90_000,
          median: 80_000,
        },
        {
          jobTitle: 'Designer',
          headcount: 1,
          min: 70_000,
          max: 70_000,
          mean: 70_000,
          median: 70_000,
        },
      ],
    } satisfies CountryJobTitleInsights);
  });

  it('counts titles differing only in case or surrounding spaces as one, labelled by the majority spelling', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Software Engineer', 100_000);
    hire(db, ' software engineer', 110_000);
    hire(db, 'SOFTWARE ENGINEER', 120_000);
    hire(db, 'Software Engineer ', 130_000);

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles).toHaveLength(1);
    expect(jobTitles[0]).toMatchObject({ jobTitle: 'Software Engineer', headcount: 4 });
  });

  it('labels a tied title with the spelling that comes first A to Z', async () => {
    const { app, db } = createTestApp();
    hire(db, 'data analyst', 1);
    hire(db, 'Data Analyst', 1);

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles.map((t) => t.jobTitle)).toEqual(['data analyst']);
  });

  it('shows a single employee salary as min, max, mean and median', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Architect', 175_001);

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles).toEqual([
      {
        jobTitle: 'Architect',
        headcount: 1,
        min: 175_001,
        max: 175_001,
        mean: 175_001,
        median: 175_001,
      },
    ]);
  });

  it('rounds a half-way mean and median up like the country figures', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Analyst', 1);
    hire(db, 'Analyst', 2);

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles[0]).toMatchObject({ mean: 2, median: 2 });
  });

  it('orders job titles A to Z', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Zoologist', 1);
    hire(db, 'analyst', 1);
    hire(db, 'Manager', 1);

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles.map((t) => t.jobTitle)).toEqual(['analyst', 'Manager', 'Zoologist']);
  });

  it('only includes employees of the requested country, using their current salary', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Analyst', 100_000);
    insertEmployee(db, {
      countryCode: 'IN',
      jobTitle: 'Analyst',
      salaryHistory: [
        { amount: 1_000_000, effectiveDate: '2019-01-01' },
        { amount: 2_000_000, effectiveDate: '2023-01-01' },
      ],
    });

    const { currency, jobTitles } = (await getJobTitles(app, 'IN')).body as CountryJobTitleInsights;

    expect(currency).toBe('INR');
    expect(jobTitles).toEqual([
      {
        jobTitle: 'Analyst',
        headcount: 1,
        min: 2_000_000,
        max: 2_000_000,
        mean: 2_000_000,
        median: 2_000_000,
      },
    ]);
  });

  it('excludes inactive employees', async () => {
    const { app, db } = createTestApp();
    hire(db, 'Analyst', 100_000);
    hire(db, 'Analyst', 900_000, { status: 'inactive', exitDate: '2024-01-01' });
    hire(db, 'Retired Role', 50_000, { status: 'inactive', exitDate: '2024-01-01' });

    const { jobTitles } = (await getJobTitles(app, 'US')).body as CountryJobTitleInsights;

    expect(jobTitles).toEqual([
      {
        jobTitle: 'Analyst',
        headcount: 1,
        min: 100_000,
        max: 100_000,
        mean: 100_000,
        median: 100_000,
      },
    ]);
  });

  it('returns an empty list for a known country with no active employees', async () => {
    const { app } = createTestApp();

    const response = await getJobTitles(app, 'GB');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      country: 'GB',
      countryName: 'United Kingdom',
      currency: 'GBP',
      jobTitles: [],
    });
  });

  it('answers 404 for an unknown country code', async () => {
    const { app } = createTestApp();

    const response = await getJobTitles(app, 'ZZ');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/insights/organisation', () => {
  async function getOrganisation(app: TestApp['app']): Promise<OrganisationComparison> {
    const response = await request(app).get('/api/insights/organisation');
    expect(response.status).toBe(200);
    return response.body as OrganisationComparison;
  }

  it('returns no groups when there are no employees', async () => {
    const { app } = createTestApp();

    const { byCountry, byDepartment } = await getOrganisation(app);

    expect(byCountry).toEqual([]);
    expect(byDepartment).toEqual([]);
  });

  it('gives the rates as of date, the source and the rate of every currency', async () => {
    const { app } = createTestApp();

    const comparison = await getOrganisation(app);

    expect(comparison).toMatchObject({
      referenceCurrency: 'USD',
      ratesAsOf: RATES_AS_OF,
      ratesSource: RATES_SOURCE,
    });
    expect(comparison.toUsd).toEqual(toUsdRates());
  });

  it('shows headcount and average US dollar salary per country, ordered by name', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      countryCode: 'US',
      salaryHistory: [{ amount: 60_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      countryCode: 'US',
      salaryHistory: [{ amount: 80_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      countryCode: 'GB',
      salaryHistory: [{ amount: 100_000, effectiveDate: '2020-01-15', currency: 'GBP' }],
    });

    const { byCountry } = await getOrganisation(app);

    expect(byCountry).toEqual([
      { country: 'GB', countryName: 'United Kingdom', headcount: 1, averageSalaryUsd: 133_683 },
      { country: 'US', countryName: 'United States', headcount: 2, averageSalaryUsd: 70_000 },
    ]);
  });

  it('averages each department across countries after converting to US dollars', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      department: 'Engineering',
      countryCode: 'US',
      salaryHistory: [{ amount: 100_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      department: 'Engineering',
      countryCode: 'GB',
      salaryHistory: [{ amount: 100_000, effectiveDate: '2020-01-15', currency: 'GBP' }],
    });
    insertEmployee(db, {
      department: 'Sales',
      countryCode: 'US',
      salaryHistory: [{ amount: 50_000, effectiveDate: '2020-01-15' }],
    });

    const { byDepartment } = await getOrganisation(app);

    expect(byDepartment).toEqual([
      { department: 'Engineering', headcount: 2, averageSalaryUsd: 116_841 },
      { department: 'Sales', headcount: 1, averageSalaryUsd: 50_000 },
    ]);
  });

  it('rounds a half-way US dollar average up to the whole dollar', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { salaryHistory: [{ amount: 60_001, effectiveDate: '2020-01-15' }] });
    insertEmployee(db, { salaryHistory: [{ amount: 60_002, effectiveDate: '2020-01-15' }] });

    const { byCountry } = await getOrganisation(app);

    expect(byCountry[0]).toMatchObject({ headcount: 2, averageSalaryUsd: 60_002 });
  });

  it('excludes inactive employees and omits groups with no active employees', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      department: 'Engineering',
      countryCode: 'US',
      salaryHistory: [{ amount: 100_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      department: 'Legal',
      countryCode: 'IN',
      status: 'inactive',
      exitDate: '2024-01-01',
      salaryHistory: [{ amount: 900_000, effectiveDate: '2020-01-15', currency: 'INR' }],
    });

    const { byCountry, byDepartment } = await getOrganisation(app);

    expect(byCountry.map((row) => row.country)).toEqual(['US']);
    expect(byDepartment.map((row) => row.department)).toEqual(['Engineering']);
  });
});
