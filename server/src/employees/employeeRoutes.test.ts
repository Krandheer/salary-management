import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, type EmployeeListPage, type JobTitleOptions } from '@acme/contracts';
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

describe('GET /api/employees search and filters', () => {
  function namesOf(page: EmployeeListPage): string[] {
    return page.items.map((item) => item.fullName);
  }

  it('finds employees whose name contains the text, ignoring letter case', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Diana Prince' });
    insertEmployee(db, { fullName: 'Ana Souza' });
    insertEmployee(db, { fullName: 'Bob Stone' });

    const { body } = await getPage(app, '?search=ANA');

    expect(namesOf(body)).toEqual(['Ana Souza', 'Diana Prince']);
    expect(body.total).toBe(2);
  });

  it('ignores spaces around the search text', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Diana Prince' });
    insertEmployee(db, { fullName: 'Bob Stone' });

    const { body } = await getPage(app, '?search=%20%20diana%20');

    expect(namesOf(body)).toEqual(['Diana Prince']);
  });

  it('matches a search that spans the space between first and last name', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Diana Prince' });
    insertEmployee(db, { fullName: 'Dian Aprince' });

    const { body } = await getPage(app, '?search=a%20p');

    expect(namesOf(body)).toEqual(['Diana Prince']);
  });

  it('treats a percent sign in the search as a literal character, not a wildcard', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Ana Souza' });
    insertEmployee(db, { fullName: 'Bob Stone' });
    insertEmployee(db, { fullName: '100% Effort' });

    const { body } = await getPage(app, '?search=%25');

    expect(namesOf(body)).toEqual(['100% Effort']);
  });

  it('treats an underscore in the search as a literal character, not a single-character wildcard', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Ana Souza' });
    insertEmployee(db, { fullName: 'Bob Stone' });
    insertEmployee(db, { fullName: 'snake_case Sam' });

    const { body } = await getPage(app, '?search=_');

    expect(namesOf(body)).toEqual(['snake_case Sam']);
  });

  it('treats quotes and SQL fragments in the search as plain text', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Ana Souza' });
    insertEmployee(db, { fullName: "Tom O'Brien" });

    const injection = await getPage(app, `?search=${encodeURIComponent("' OR '1'='1")}`);
    const apostrophe = await getPage(app, `?search=${encodeURIComponent("o'b")}`);
    const afterwards = await getPage(app);

    expect(injection.status).toBe(200);
    expect(injection.body.total).toBe(0);
    expect(namesOf(apostrophe.body)).toEqual(["Tom O'Brien"]);
    expect(afterwards.body.total).toBe(2);
  });

  it('filters by country', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Asha Rao', countryCode: 'IN' });
    insertEmployee(db, { fullName: 'John Miller', countryCode: 'US' });

    const { body } = await getPage(app, '?country=IN');

    expect(namesOf(body)).toEqual(['Asha Rao']);
    expect(body.total).toBe(1);
  });

  it('filters by department', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Fiona Fin', department: 'Finance' });
    insertEmployee(db, { fullName: 'Eli Eng', department: 'Engineering' });

    const { body } = await getPage(app, '?department=Finance');

    expect(namesOf(body)).toEqual(['Fiona Fin']);
  });

  it('filters by job title ignoring letter case and surrounding spaces', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Sia Dev', jobTitle: 'Software Engineer' });
    insertEmployee(db, { fullName: 'Sam Dev', jobTitle: ' software engineer ' });
    insertEmployee(db, { fullName: 'Dee Sign', jobTitle: 'Designer' });

    const { body } = await getPage(app, '?jobTitle=%20SOFTWARE%20engineer%20');

    expect(namesOf(body)).toEqual(['Sam Dev', 'Sia Dev']);
  });

  it('combines search and filters, and the total and page count reflect the combination', async () => {
    const { app, db } = createTestApp();
    for (let i = 1; i <= 30; i += 1) {
      insertEmployee(db, {
        fullName: `Match ${String(i).padStart(2, '0')}`,
        countryCode: 'IN',
        department: 'Finance',
        jobTitle: 'Analyst',
      });
    }
    insertEmployee(db, {
      fullName: 'Match Other Country',
      countryCode: 'US',
      department: 'Finance',
      jobTitle: 'Analyst',
    });
    insertEmployee(db, {
      fullName: 'Match Other Dept',
      countryCode: 'IN',
      department: 'Legal',
      jobTitle: 'Analyst',
    });
    insertEmployee(db, {
      fullName: 'Match Other Title',
      countryCode: 'IN',
      department: 'Finance',
      jobTitle: 'Clerk',
    });
    insertEmployee(db, {
      fullName: 'Nobody Else',
      countryCode: 'IN',
      department: 'Finance',
      jobTitle: 'Analyst',
    });

    const { body } = await getPage(
      app,
      '?search=match&country=IN&department=Finance&jobTitle=analyst',
    );

    expect(body).toMatchObject({ total: 30, totalPages: 2 });
    expect(body.items).toHaveLength(25);
  });

  it('applies filters to the inactive list too', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      fullName: 'Gone Indian',
      countryCode: 'IN',
      status: 'inactive',
      exitDate: '2025-01-01',
    });
    insertEmployee(db, {
      fullName: 'Gone American',
      countryCode: 'US',
      status: 'inactive',
      exitDate: '2025-01-01',
    });
    insertEmployee(db, { fullName: 'Here Indian', countryCode: 'IN' });

    const { body } = await getPage(app, '?status=inactive&country=IN');

    expect(namesOf(body)).toEqual(['Gone Indian']);
  });

  it('returns no items when nothing matches', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Ana Souza' });

    const { body } = await getPage(app, '?search=zzz');

    expect(body).toMatchObject({ items: [], total: 0, totalPages: 1 });
  });

  it.each(['?country=XX', '?department=Kitchen', '?country=', '?search=a&search=b'])(
    'rejects the filter query %s with INVALID_QUERY',
    async (query) => {
      const { app } = createTestApp();

      const response = await request(app).get(`/api/employees${query}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    },
  );
});

describe('GET /api/employees/job-titles', () => {
  async function getTitles(app: ReturnType<typeof createTestApp>['app'], query = '') {
    const response = await request(app).get(`/api/employees/job-titles${query}`);
    return { status: response.status, body: response.body as JobTitleOptions };
  }

  it('lists each job title once, A to Z, merging case and spacing variants', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { jobTitle: 'Software Engineer' });
    insertEmployee(db, { jobTitle: 'Software Engineer' });
    insertEmployee(db, { jobTitle: ' software engineer ' });
    insertEmployee(db, { jobTitle: 'Designer' });
    insertEmployee(db, { jobTitle: 'analyst' });

    const { status, body } = await getTitles(app);

    expect(status).toBe(200);
    expect(body).toEqual({ jobTitles: ['analyst', 'Designer', 'Software Engineer'] });
  });

  it('returns an empty list when there are no employees', async () => {
    const { app } = createTestApp();

    expect((await getTitles(app)).body).toEqual({ jobTitles: [] });
  });

  it('is limited to the titles of the employees in view (status, search, country, department)', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      fullName: 'Ana A',
      jobTitle: 'Analyst',
      countryCode: 'IN',
      department: 'Finance',
    });
    insertEmployee(db, {
      fullName: 'Ana B',
      jobTitle: 'Clerk',
      countryCode: 'IN',
      department: 'Finance',
    });
    insertEmployee(db, {
      fullName: 'Ana C',
      jobTitle: 'Lawyer',
      countryCode: 'US',
      department: 'Legal',
    });
    insertEmployee(db, {
      fullName: 'Bob D',
      jobTitle: 'Designer',
      countryCode: 'IN',
      department: 'Finance',
    });
    insertEmployee(db, {
      fullName: 'Ana E',
      jobTitle: 'Retired Role',
      countryCode: 'IN',
      department: 'Finance',
      status: 'inactive',
      exitDate: '2025-01-01',
    });

    const filtered = await getTitles(app, '?search=ana&country=IN&department=Finance');
    const inactive = await getTitles(app, '?status=inactive');

    expect(filtered.body.jobTitles).toEqual(['Analyst', 'Clerk']);
    expect(inactive.body.jobTitles).toEqual(['Retired Role']);
  });

  it('does not narrow the options by the chosen job title itself', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { jobTitle: 'Analyst' });
    insertEmployee(db, { jobTitle: 'Clerk' });

    const { body } = await getTitles(app, '?jobTitle=analyst');

    expect(body.jobTitles).toEqual(['Analyst', 'Clerk']);
  });

  it('rejects an unknown country with INVALID_QUERY', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/employees/job-titles?country=XX');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_QUERY');
  });
});
