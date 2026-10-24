import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, type EmployeeListPage } from '@acme/contracts';
import { insertEmployee } from '../../test/builders.ts';
import { createTestApp } from '../../test/testApp.ts';

async function getPage(app: ReturnType<typeof createTestApp>['app'], query = '') {
  const response = await request(app).get(`/api/employees${query}`);
  return { status: response.status, body: response.body as EmployeeListPage };
}

describe('GET /api/employees', () => {
  it('returns an empty first page when there are no employees', async () => {
    const { app } = createTestApp();

    const { status, body } = await getPage(app);

    expect(status).toBe(200);
    expect(body).toEqual({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  });

  it('pages 26 employees as 25 on the first page and 1 on the second', async () => {
    const { app, db } = createTestApp();
    for (let i = 1; i <= 26; i += 1)
      insertEmployee(db, { fullName: `Person ${String(i).padStart(2, '0')}` });

    const first = (await getPage(app, '?page=1')).body;
    const second = (await getPage(app, '?page=2')).body;

    expect(first.items).toHaveLength(25);
    expect(first).toMatchObject({ page: 1, pageSize: 25, total: 26, totalPages: 2 });
    expect(second.items.map((item) => item.fullName)).toEqual(['Person 26']);
    expect(second.page).toBe(2);
  });

  it('serves the first page when no page is given', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Only One' });

    const { body } = await getPage(app);

    expect(body.page).toBe(1);
    expect(body.items).toHaveLength(1);
  });

  it('returns no items for a page past the end', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db);

    const { body } = await getPage(app, '?page=5');

    expect(body).toMatchObject({ items: [], page: 5, total: 1, totalPages: 1 });
  });

  it('sorts by full name ignoring letter case', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Bob Stone' });
    insertEmployee(db, { fullName: 'alice Moore' });
    insertEmployee(db, { fullName: 'Carol Ng' });

    const { body } = await getPage(app);

    expect(body.items.map((item) => item.fullName)).toEqual([
      'alice Moore',
      'Bob Stone',
      'Carol Ng',
    ]);
  });

  it('orders employees with the same name by id', async () => {
    const { app, db } = createTestApp();
    const firstId = insertEmployee(db, { fullName: 'Sam Lee' });
    const secondId = insertEmployee(db, { fullName: 'sam lee' });
    const thirdId = insertEmployee(db, { fullName: 'SAM LEE' });

    const { body } = await getPage(app);

    expect(body.items.map((item) => item.id)).toEqual([firstId, secondId, thirdId]);
  });

  it('reports the salary and currency of the latest salary history entry', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      fullName: 'Asha Rao',
      countryCode: 'IN',
      salaryHistory: [
        { amount: 1_500_000, effectiveDate: '2020-01-15' },
        { amount: 1_850_000, effectiveDate: '2023-04-01' },
        { amount: 1_700_000, effectiveDate: '2021-04-01' },
      ],
    });

    const { body } = await getPage(app);

    expect(body.items[0]).toMatchObject({
      currentSalary: 1_850_000,
      currency: 'INR',
      country: 'IN',
    });
  });

  it('shows an employee summary with department, job title, status and no exit date', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      fullName: 'Lena Fischer',
      jobTitle: 'Product Manager',
      department: 'Product',
      countryCode: 'DE',
    });

    const { body } = await getPage(app);

    expect(body.items[0]).toMatchObject({
      fullName: 'Lena Fischer',
      jobTitle: 'Product Manager',
      department: 'Product',
      country: 'DE',
      currency: 'EUR',
      status: 'active',
      exitDate: null,
    });
  });

  it('lists only active employees by default and inactive ones when asked', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Active Person' });
    insertEmployee(db, { fullName: 'Former Person', status: 'inactive', exitDate: '2025-06-30' });

    const active = (await getPage(app)).body;
    const inactive = (await getPage(app, '?status=inactive')).body;

    expect(active.items.map((item) => item.fullName)).toEqual(['Active Person']);
    expect(active.total).toBe(1);
    expect(inactive.items.map((item) => item.fullName)).toEqual(['Former Person']);
    expect(inactive.items[0]).toMatchObject({ status: 'inactive', exitDate: '2025-06-30' });
  });

  it.each(['?page=0', '?page=-1', '?page=abc', '?page=1.5', '?status=deleted'])(
    'rejects the query %s with INVALID_QUERY',
    async (query) => {
      const { app } = createTestApp();

      const response = await request(app).get(`/api/employees${query}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    },
  );
});
