import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  type ApiErrorBody,
  type EmailCheckResult,
  type EmployeeDetail,
  type EmployeeListPage,
  type JobTitleOptions,
} from '@acme/contracts';
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

const validBody = {
  fullName: '  Asha Rao ',
  email: ' Asha.Rao@Acme.example ',
  jobTitle: ' Software Engineer ',
  department: 'Engineering',
  country: 'IN',
  annualSalary: 1_850_000,
  employmentType: 'Full-time',
  hireDate: '2024-03-01',
};

async function countEmployees(app: ReturnType<typeof createTestApp>['app']): Promise<number> {
  return (await getPage(app)).body.total;
}

describe('POST /api/employees', () => {
  it('creates the employee with trimmed fields and a lower-cased email, answering 201 with the detail', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/employees').send(validBody);

    expect(response.status).toBe(201);
    const detail = response.body as EmployeeDetail;
    expect(detail).toMatchObject({
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'IN',
      currency: 'INR',
      currentSalary: 1_850_000,
      employmentType: 'Full-time',
      hireDate: '2024-03-01',
      status: 'active',
      exitDate: null,
      linkedEmployments: [],
    });
  });

  it('shows the new employee in the employee list', async () => {
    const { app } = createTestApp();

    await request(app).post('/api/employees').send(validBody);

    const { body } = await getPage(app);
    expect(body.items.map((item) => item.fullName)).toEqual(['Asha Rao']);
  });

  it('records the salary as the first history entry, effective on the hire date with the reason "Starting salary"', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/employees').send(validBody);

    expect((response.body as EmployeeDetail).salaryHistory).toEqual([
      expect.objectContaining({
        amount: 1_850_000,
        currency: 'INR',
        effectiveDate: '2024-03-01',
        reason: 'Starting salary',
      }),
    ]);
  });

  it('accepts the salary typed as digits', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/employees')
      .send({ ...validBody, annualSalary: '1850000' });

    expect(response.status).toBe(201);
    expect((response.body as EmployeeDetail).currentSalary).toBe(1_850_000);
  });

  it('answers 400 with a field error for every invalid field and saves nothing', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/employees')
      .send({
        ...validBody,
        fullName: '   ',
        email: 'nope',
        annualSalary: 1.5,
        hireDate: '2999-01-01',
      });

    expect(response.status).toBe(400);
    const { code, fieldErrors } = (response.body as ApiErrorBody).error;
    expect(code).toBe('VALIDATION_FAILED');
    expect(Object.keys(fieldErrors ?? {}).sort()).toEqual([
      'annualSalary',
      'email',
      'fullName',
      'hireDate',
    ]);
    expect(await countEmployees(app)).toBe(0);
  });

  it('answers 400 for an empty body', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/employees').send({});

    expect(response.status).toBe(400);
    expect(Object.keys((response.body as ApiErrorBody).error.fieldErrors ?? {})).toHaveLength(8);
  });

  it('answers 409 EMAIL_TAKEN when an active employee has the email in any letter case', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { email: 'asha.rao@acme.example' });

    const response = await request(app)
      .post('/api/employees')
      .send({ ...validBody, email: 'ASHA.RAO@acme.example' });

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMAIL_TAKEN');
    expect(await countEmployees(app)).toBe(1);
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee detail with its history newest first', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      fullName: 'Asha Rao',
      salaryHistory: [
        { amount: 80_000, effectiveDate: '2020-01-15', reason: 'Starting salary' },
        { amount: 90_000, effectiveDate: '2022-01-01' },
      ],
    });

    const response = await request(app).get(`/api/employees/${id}`);

    expect(response.status).toBe(200);
    const detail = response.body as EmployeeDetail;
    expect(detail).toMatchObject({ id, fullName: 'Asha Rao', currentSalary: 90_000 });
    expect(detail.salaryHistory.map((entry) => entry.amount)).toEqual([90_000, 80_000]);
  });

  it.each(['999', '0', '-1', 'abc', '1.5'])('answers 404 for id %s', async (id) => {
    const { app } = createTestApp();

    const response = await request(app).get(`/api/employees/${id}`);

    expect(response.status).toBe(404);
    expect((response.body as ApiErrorBody).error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/employees/:id', () => {
  const patch = (app: ReturnType<typeof createTestApp>['app'], id: number | string, body: object) =>
    request(app).patch(`/api/employees/${id}`).send(body);
  const getDetail = async (app: ReturnType<typeof createTestApp>['app'], id: number) =>
    (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;

  it('changes a non-salary field and shows it on the detail and in the list', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { fullName: 'Asha Rao', jobTitle: 'Engineer' });

    const response = await patch(app, id, { jobTitle: '  Staff Engineer ' });

    expect(response.status).toBe(200);
    expect((response.body as EmployeeDetail).jobTitle).toBe('Staff Engineer');
    expect((await getDetail(app, id)).jobTitle).toBe('Staff Engineer');
    const list = await getPage(app);
    expect(list.body.items[0]?.jobTitle).toBe('Staff Engineer');
  });

  it('finds an employee by the new name and job title after they change', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { fullName: 'Asha Rao', jobTitle: 'Engineer' });

    await patch(app, id, { fullName: 'Meera Nair', jobTitle: 'Designer' });

    expect((await getPage(app, '?search=meera')).body.items).toHaveLength(1);
    expect((await getPage(app, '?search=asha')).body.items).toHaveLength(0);
    const titles = (await request(app).get('/api/employees/job-titles')).body as JobTitleOptions;
    expect(titles.jobTitles).toEqual(['Designer']);
  });

  it('adds a salary history entry and shows the new amount in the list', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [{ amount: 80_000, effectiveDate: '2020-01-15', reason: 'Starting salary' }],
    });

    const response = await patch(app, id, { salaryChange: { amount: '95000' } });

    expect(response.status).toBe(200);
    const detail = response.body as EmployeeDetail;
    expect(detail.currentSalary).toBe(95_000);
    expect(detail.salaryHistory.map((entry) => [entry.amount, entry.effectiveDate])).toEqual([
      [95_000, '2026-10-24'],
      [80_000, '2020-01-15'],
    ]);
    expect(detail.salaryHistory[1]?.reason).toBe('Starting salary');
    expect((await getPage(app)).body.items[0]?.currentSalary).toBe(95_000);
  });

  it('accepts the employee own email unchanged, whatever its letter case', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { email: 'asha@acme.example' });

    const response = await patch(app, id, { email: 'Asha@Acme.example', jobTitle: 'Lead' });

    expect(response.status).toBe(200);
    expect((response.body as EmployeeDetail).email).toBe('asha@acme.example');
  });

  it('answers 409 and changes nothing when the email belongs to another active employee', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { jobTitle: 'Engineer' });
    insertEmployee(db, { email: 'taken@acme.example' });

    const response = await patch(app, id, { email: 'TAKEN@acme.example', jobTitle: 'Lead' });

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMAIL_TAKEN');
    expect((await getDetail(app, id)).jobTitle).toBe('Engineer');
  });

  it('changes the currency with the country and keeps earlier entries in their own currency', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { countryCode: 'US' });

    const response = await patch(app, id, { country: 'GB', salaryChange: { amount: 70_000 } });

    expect(response.status).toBe(200);
    const detail = response.body as EmployeeDetail;
    expect(detail).toMatchObject({ country: 'GB', currency: 'GBP', currentSalary: 70_000 });
    expect(detail.salaryHistory.map((entry) => entry.currency)).toEqual(['GBP', 'USD']);
    expect((await getPage(app)).body.items[0]).toMatchObject({ country: 'GB', currency: 'GBP' });
  });

  it('answers 400 on salaryChange.amount when the country changes without a new salary', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { countryCode: 'US' });

    const response = await patch(app, id, { country: 'GB' });

    expect(response.status).toBe(400);
    const { error } = response.body as ApiErrorBody;
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(error.fieldErrors ?? {})).toEqual(['salaryChange.amount']);
    expect((await getDetail(app, id)).country).toBe('US');
  });

  it('answers 400 on hireDate when it moves later than the earliest salary entry', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      hireDate: '2020-01-15',
      salaryHistory: [{ amount: 80_000, effectiveDate: '2020-03-01' }],
    });

    const later = await patch(app, id, { hireDate: '2020-03-02' });
    const equal = await patch(app, id, { hireDate: '2020-03-01' });

    expect(later.status).toBe(400);
    expect(Object.keys((later.body as ApiErrorBody).error.fieldErrors ?? {})).toEqual(['hireDate']);
    expect(equal.status).toBe(200);
    expect((equal.body as EmployeeDetail).hireDate).toBe('2020-03-01');
  });

  it('applies the shared validation rules to edits', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db);

    const response = await patch(app, id, { email: 'nope', salaryChange: { amount: 0 } });

    expect(response.status).toBe(400);
    const fieldErrors = (response.body as ApiErrorBody).error.fieldErrors ?? {};
    expect(Object.keys(fieldErrors).sort()).toEqual(['email', 'salaryChange.amount']);
  });

  it('changes nothing when any part of the patch is invalid', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { jobTitle: 'Engineer' });
    const before = await getDetail(app, id);

    const response = await patch(app, id, {
      jobTitle: 'Lead',
      salaryChange: { amount: 'lots' },
    });

    expect(response.status).toBe(400);
    expect(await getDetail(app, id)).toEqual(before);
  });

  it.each(['999', '0', 'abc'])('answers 404 for an unknown id %s on PATCH', async (id) => {
    const { app } = createTestApp();

    const response = await patch(app, id, { jobTitle: 'Lead' });

    expect(response.status).toBe(404);
    expect((response.body as ApiErrorBody).error.code).toBe('NOT_FOUND');
  });

  it('answers 409 for an inactive employee and changes nothing', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      status: 'inactive',
      exitDate: '2025-01-01',
      jobTitle: 'Engineer',
    });

    const response = await patch(app, id, { jobTitle: 'Lead' });

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMPLOYEE_INACTIVE');
    expect((await getDetail(app, id)).jobTitle).toBe('Engineer');
  });
});

describe('salary history through PATCH /api/employees/:id', () => {
  const patch = (app: ReturnType<typeof createTestApp>['app'], id: number, body: object) =>
    request(app).patch(`/api/employees/${id}`).send(body);
  const getDetail = async (app: ReturnType<typeof createTestApp>['app'], id: number) =>
    (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;

  it('adds a dated entry with its reason and leaves every earlier entry unchanged', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [
        { amount: 70_000, effectiveDate: '2020-01-15', reason: 'Starting salary' },
        { amount: 80_000, effectiveDate: '2022-01-01', reason: 'Review' },
      ],
    });
    const before = (await getDetail(app, id)).salaryHistory;

    const response = await patch(app, id, {
      salaryChange: { amount: 95_000, effectiveDate: '2025-06-01', reason: '  Promotion ' },
    });

    expect(response.status).toBe(200);
    const history = (response.body as EmployeeDetail).salaryHistory;
    expect(history[0]).toMatchObject({
      amount: 95_000,
      effectiveDate: '2025-06-01',
      reason: 'Promotion',
    });
    expect(history.slice(1)).toEqual(before);
  });

  it('lists the history newest effective date first', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [
        { amount: 70_000, effectiveDate: '2020-01-15' },
        { amount: 90_000, effectiveDate: '2023-01-01' },
        { amount: 80_000, effectiveDate: '2021-01-01' },
      ],
    });

    const dates = (await getDetail(app, id)).salaryHistory.map((entry) => entry.effectiveDate);

    expect(dates).toEqual(['2023-01-01', '2021-01-01', '2020-01-15']);
  });

  it('makes the entry recorded later current when two share an effective date', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [{ amount: 80_000, effectiveDate: '2024-05-01', reason: 'First' }],
    });

    const response = await patch(app, id, {
      salaryChange: { amount: 85_000, effectiveDate: '2024-05-01', reason: 'Second' },
    });

    const detail = response.body as EmployeeDetail;
    expect(detail.currentSalary).toBe(85_000);
    expect(detail.salaryHistory.map((entry) => entry.reason)).toEqual(['Second', 'First']);
    expect((await getPage(app)).body.items[0]?.currentSalary).toBe(85_000);
  });

  it('adds a backdated entry to the history without changing the current salary', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [
        { amount: 70_000, effectiveDate: '2020-01-15' },
        { amount: 90_000, effectiveDate: '2024-01-01' },
      ],
    });

    const response = await patch(app, id, {
      salaryChange: { amount: 75_000, effectiveDate: '2021-06-01' },
    });

    const detail = response.body as EmployeeDetail;
    expect(detail.currentSalary).toBe(90_000);
    expect(detail.salaryHistory.map((entry) => entry.amount)).toEqual([90_000, 75_000, 70_000]);
    expect((await getPage(app)).body.items[0]?.currentSalary).toBe(90_000);
  });

  it('defaults the effective date to today and records no reason for a blank one', async () => {
    const { app, db } = createTestApp({ today: '2026-03-10' });
    const id = insertEmployee(db);

    const response = await patch(app, id, { salaryChange: { amount: 99_000, reason: '   ' } });

    expect((response.body as EmployeeDetail).salaryHistory[0]).toMatchObject({
      effectiveDate: '2026-03-10',
      reason: null,
    });
  });

  it.each([
    ['in the future', '2026-10-25', /future/i],
    ['before the hire date', '2020-01-14', /hire date/i],
  ])('answers 400 on salaryChange.effectiveDate when it is %s', async (_label, date, message) => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { hireDate: '2020-01-15' });
    const before = await getDetail(app, id);

    const response = await patch(app, id, {
      salaryChange: { amount: 99_000, effectiveDate: date },
    });

    expect(response.status).toBe(400);
    const { fieldErrors } = (response.body as ApiErrorBody).error;
    expect(Object.keys(fieldErrors ?? {})).toEqual(['salaryChange.effectiveDate']);
    expect(fieldErrors?.['salaryChange.effectiveDate']).toMatch(message);
    expect(await getDetail(app, id)).toEqual(before);
  });

  it('accepts an effective date equal to the hire date', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { hireDate: '2020-01-15' });

    const response = await patch(app, id, {
      salaryChange: { amount: 99_000, effectiveDate: '2020-01-15' },
    });

    expect(response.status).toBe(200);
  });

  it('accepts a reason of ten thousand characters and stores it whole', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db);
    const reason = 'r'.repeat(10_000);

    const response = await patch(app, id, { salaryChange: { amount: 99_000, reason } });

    expect((response.body as EmployeeDetail).salaryHistory[0]?.reason).toBe(reason);
  });

  it('adds no entry when the salary and the country stay the same', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      salaryHistory: [{ amount: 80_000, effectiveDate: '2022-01-01' }],
    });

    const response = await patch(app, id, {
      jobTitle: 'Lead',
      salaryChange: { amount: '80000', reason: 'Re-saved' },
    });

    expect(response.status).toBe(200);
    const detail = response.body as EmployeeDetail;
    expect(detail.jobTitle).toBe('Lead');
    expect(detail.salaryHistory).toHaveLength(1);
  });

  it('adds an entry for the same amount when the country changes, in the new currency', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      countryCode: 'US',
      salaryHistory: [{ amount: 80_000, effectiveDate: '2022-01-01' }],
    });

    const response = await patch(app, id, { country: 'GB', salaryChange: { amount: 80_000 } });

    const history = (response.body as EmployeeDetail).salaryHistory;
    expect(history.map((entry) => [entry.amount, entry.currency])).toEqual([
      [80_000, 'GBP'],
      [80_000, 'USD'],
    ]);
  });
});

describe('country change with a backdated salary change through PATCH /api/employees/:id', () => {
  const patch = (app: ReturnType<typeof createTestApp>['app'], id: number, body: object) =>
    request(app).patch(`/api/employees/${id}`).send(body);
  const getDetail = async (app: ReturnType<typeof createTestApp>['app'], id: number) =>
    (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;
  const movedAbroad = {
    countryCode: 'IN' as const,
    hireDate: '2020-01-15',
    salaryHistory: [
      { amount: 1_850_000, effectiveDate: '2020-01-15' },
      { amount: 2_000_000, effectiveDate: '2024-01-01' },
    ],
  };

  it("answers 400 on salaryChange.effectiveDate when it is before the current salary's date, and changes nothing", async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, movedAbroad);
    const before = await getDetail(app, id);

    const response = await patch(app, id, {
      country: 'JP',
      salaryChange: { amount: 9_500_000, effectiveDate: '2022-01-01' },
    });

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors).toEqual({
      'salaryChange.effectiveDate':
        "When the country changes, the effective date can't be before the current salary's (2024-01-01)",
    });
    expect(await getDetail(app, id)).toEqual(before);
  });

  it("accepts the country change dated on the current salary's date, making the new currency current", async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, movedAbroad);

    const response = await patch(app, id, {
      country: 'JP',
      salaryChange: { amount: 9_500_000, effectiveDate: '2024-01-01' },
    });

    expect(response.status).toBe(200);
    expect(response.body as EmployeeDetail).toMatchObject({
      country: 'JP',
      currency: 'JPY',
      currentSalary: 9_500_000,
    });
  });
});

describe('rehire hire-date rule on PATCH /api/employees/:id', () => {
  const patch = (app: ReturnType<typeof createTestApp>['app'], id: number, body: object) =>
    request(app).patch(`/api/employees/${id}`).send(body);
  const getDetail = async (app: ReturnType<typeof createTestApp>['app'], id: number) =>
    (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;
  const email = 'asha.rao@acme.example';

  function insertRehire(db: ReturnType<typeof createTestApp>['db']): number {
    insertEmployee(db, {
      email,
      hireDate: '2020-01-15',
      status: 'inactive',
      exitDate: '2024-06-01',
    });
    return insertEmployee(db, { email, hireDate: '2025-01-01' });
  }

  it('answers 400 on hireDate when a rehire hire date moves onto or before the previous exit date', async () => {
    const { app, db } = createTestApp();
    const rehireId = insertRehire(db);
    const before = await getDetail(app, rehireId);

    const responses = [
      await patch(app, rehireId, { hireDate: '2021-01-01' }),
      await patch(app, rehireId, { hireDate: '2024-06-01' }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect((response.body as ApiErrorBody).error.fieldErrors).toEqual({
        hireDate: 'Hire date must be after the previous exit date (2024-06-01)',
      });
    }
    expect(await getDetail(app, rehireId)).toEqual(before);
  });

  it('accepts a rehire hire date moved earlier but still after the previous exit date', async () => {
    const { app, db } = createTestApp();
    const rehireId = insertRehire(db);

    const response = await patch(app, rehireId, { hireDate: '2024-06-02' });

    expect(response.status).toBe(200);
    expect((response.body as EmployeeDetail).hireDate).toBe('2024-06-02');
  });

  it("answers 400 on hireDate when the email changes to an inactive record's whose exit is after the hire date", async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      email,
      hireDate: '2020-01-15',
      status: 'inactive',
      exitDate: '2024-06-01',
    });
    const otherId = insertEmployee(db, { email: 'bob@acme.example', hireDate: '2019-01-01' });

    const response = await patch(app, otherId, { email: 'Asha.Rao@acme.example' });

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors).toEqual({
      hireDate: 'Hire date must be after the previous exit date (2024-06-01)',
    });
    expect((await getDetail(app, otherId)).email).toBe('bob@acme.example');
  });
});

describe('malformed JSON request body', () => {
  it('answers 400 VALIDATION_FAILED instead of a server error', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/employees')
      .set('Content-Type', 'application/json')
      .send('{"fullName": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_FAILED', message: 'Request body is not valid JSON' },
    });
  });
});

describe('DELETE /api/employees/:id', () => {
  const remove = (app: ReturnType<typeof createTestApp>['app'], id: number, query = '') =>
    request(app).delete(`/api/employees/${id}${query}`);
  const getDetail = async (app: ReturnType<typeof createTestApp>['app'], id: number) =>
    (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;

  it('makes the employee inactive with the given exit date and returns the detail', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { fullName: 'Leaver', hireDate: '2020-01-15' });

    const response = await remove(app, id, '?exitDate=2026-09-30');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id, status: 'inactive', exitDate: '2026-09-30' });
    expect(await getDetail(app, id)).toMatchObject({ status: 'inactive', exitDate: '2026-09-30' });
  });

  it('defaults the exit date to today when none is given', async () => {
    const { app, db } = createTestApp({ today: '2026-10-24' });
    const id = insertEmployee(db);

    const response = await remove(app, id);

    expect((response.body as EmployeeDetail).exitDate).toBe('2026-10-24');
  });

  it('removes the employee from the default list and shows them in the inactive list', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { fullName: 'Stays' });
    const id = insertEmployee(db, { fullName: 'Leaves' });

    await remove(app, id, '?exitDate=2026-01-31');

    const active = (await getPage(app)).body;
    const inactive = (await getPage(app, '?status=inactive')).body;
    expect(active.items.map((item) => item.fullName)).toEqual(['Stays']);
    expect(inactive.items.map((item) => item.fullName)).toEqual(['Leaves']);
    expect(inactive.items[0]).toMatchObject({ status: 'inactive', exitDate: '2026-01-31' });
  });

  it('keeps the salary history and details of the deleted employee', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, {
      hireDate: '2020-01-15',
      salaryHistory: [
        { amount: 80_000, effectiveDate: '2020-01-15' },
        { amount: 90_000, effectiveDate: '2023-01-01' },
      ],
    });

    await remove(app, id, '?exitDate=2026-01-31');

    const detail = await getDetail(app, id);
    expect(detail.salaryHistory.map((entry) => entry.amount)).toEqual([90_000, 80_000]);
    expect(detail.currentSalary).toBe(90_000);
  });

  it('answers 409 EMPLOYEE_INACTIVE when deleting an inactive employee again', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { status: 'inactive', exitDate: '2025-01-01' });

    const response = await remove(app, id, '?exitDate=2025-06-01');

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMPLOYEE_INACTIVE');
    expect((await getDetail(app, id)).exitDate).toBe('2025-01-01');
  });

  it('answers 404 for an unknown employee', async () => {
    const { app } = createTestApp();

    const response = await remove(app, 999);

    expect(response.status).toBe(404);
    expect((response.body as ApiErrorBody).error.code).toBe('NOT_FOUND');
  });

  it('answers 400 with an exitDate error for a future date and leaves the employee active', async () => {
    const { app, db } = createTestApp({ today: '2026-10-24' });
    const id = insertEmployee(db);

    const response = await remove(app, id, '?exitDate=2026-10-25');

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors?.exitDate).toMatch(/future/);
    expect((await getDetail(app, id)).status).toBe('active');
  });

  it('answers 400 with an exitDate error for a date before the hire date', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { hireDate: '2024-03-01' });

    const response = await remove(app, id, '?exitDate=2024-02-29');

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors?.exitDate).toMatch(/hire date/);
  });

  it('answers 400 for an exit date that is not a calendar date', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db);

    const response = await remove(app, id, '?exitDate=2026-02-30');

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors?.exitDate).toBeDefined();
  });

  it('applies search and filters to the inactive list', async () => {
    const { app, db } = createTestApp();
    const indian = insertEmployee(db, { fullName: 'Asha Rao', countryCode: 'IN' });
    const american = insertEmployee(db, { fullName: 'Ashley Cole', countryCode: 'US' });
    await remove(app, indian, '?exitDate=2026-01-31');
    await remove(app, american, '?exitDate=2026-01-31');

    const { body } = await getPage(app, '?status=inactive&search=ash&country=IN');

    expect(body.items.map((item) => item.fullName)).toEqual(['Asha Rao']);
  });
});

describe('inactive employees are read-only', () => {
  it('rejects a salary change on an inactive employee with 409 and records nothing', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { status: 'inactive', exitDate: '2025-01-01' });

    const response = await request(app)
      .patch(`/api/employees/${id}`)
      .send({ salaryChange: { amount: 99_000 } });

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMPLOYEE_INACTIVE');
    const detail = (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;
    expect(detail.salaryHistory).toHaveLength(1);
  });

  it('offers no way back to active', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { status: 'inactive', exitDate: '2025-01-01' });

    const responses = await Promise.all([
      request(app).post(`/api/employees/${id}/restoration`),
      request(app).post(`/api/employees/${id}/restore`),
      request(app).patch(`/api/employees/${id}`).send({ status: 'active' }),
    ]);

    expect(responses.map((response) => response.status === 404 || response.status === 409)).toEqual(
      [true, true, true],
    );
    const detail = (await request(app).get(`/api/employees/${id}`)).body as EmployeeDetail;
    expect(detail.status).toBe('inactive');
  });
});

describe("rehire: POST /api/employees with an inactive employee's email", () => {
  const former = {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    status: 'inactive' as const,
    exitDate: '2025-06-30',
    hireDate: '2020-01-15',
    salaryHistory: [{ amount: 70_000, effectiveDate: '2020-01-15' }],
  };
  const rehireBody = (overrides: object = {}) => ({
    fullName: 'Asha Rao',
    email: 'Asha.Rao@acme.example',
    jobTitle: 'Staff Engineer',
    department: 'Engineering',
    country: 'IN',
    annualSalary: 2_500_000,
    employmentType: 'Full-time',
    hireDate: '2026-02-01',
    ...overrides,
  });

  it('creates a new employee with a new id and a fresh salary history from the new hire date', async () => {
    const { app, db } = createTestApp();
    const formerId = insertEmployee(db, former);

    const response = await request(app).post('/api/employees').send(rehireBody());

    expect(response.status).toBe(201);
    const created = response.body as EmployeeDetail;
    expect(created.id).not.toBe(formerId);
    expect(created.status).toBe('active');
    expect(created.salaryHistory).toEqual([
      expect.objectContaining({ amount: 2_500_000, effectiveDate: '2026-02-01' }),
    ]);
  });

  it('links the two records to each other by email', async () => {
    const { app, db } = createTestApp();
    const formerId = insertEmployee(db, former);

    const created = (await request(app).post('/api/employees').send(rehireBody()))
      .body as EmployeeDetail;

    const formerDetail = (await request(app).get(`/api/employees/${formerId}`))
      .body as EmployeeDetail;
    expect(created.linkedEmployments).toEqual([
      {
        id: formerId,
        fullName: 'Asha Rao',
        hireDate: '2020-01-15',
        exitDate: '2025-06-30',
        status: 'inactive',
      },
    ]);
    expect(formerDetail.linkedEmployments).toEqual([
      {
        id: created.id,
        fullName: 'Asha Rao',
        hireDate: '2026-02-01',
        exitDate: null,
        status: 'active',
      },
    ]);
  });

  it('lists linked employments newest hire first', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);
    const secondId = insertEmployee(db, {
      ...former,
      hireDate: '2025-08-01',
      exitDate: '2025-12-31',
    });

    const created = (await request(app).post('/api/employees').send(rehireBody()))
      .body as EmployeeDetail;

    expect(created.linkedEmployments.map((link) => link.hireDate)).toEqual([
      '2025-08-01',
      '2020-01-15',
    ]);
    expect(created.linkedEmployments[0]?.id).toBe(secondId);
  });

  it('leaves the inactive record and its history unchanged', async () => {
    const { app, db } = createTestApp();
    const formerId = insertEmployee(db, former);
    const before = (await request(app).get(`/api/employees/${formerId}`)).body as EmployeeDetail;

    await request(app).post('/api/employees').send(rehireBody());

    const after = (await request(app).get(`/api/employees/${formerId}`)).body as EmployeeDetail;
    expect({ ...after, linkedEmployments: [] }).toEqual({ ...before, linkedEmployments: [] });
  });

  it('rejects a hire date on the exit date of the most recent inactive record', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);

    const response = await request(app)
      .post('/api/employees')
      .send(rehireBody({ hireDate: '2025-06-30' }));

    expect(response.status).toBe(400);
    expect((response.body as ApiErrorBody).error.fieldErrors?.hireDate).toMatch(/after/);
    expect((await getPage(app)).body.total).toBe(0);
  });

  it('accepts a hire date the day after the exit date', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);

    const response = await request(app)
      .post('/api/employees')
      .send(rehireBody({ hireDate: '2025-07-01' }));

    expect(response.status).toBe(201);
  });

  it('judges the hire date against the latest exit date when several inactive records share the email', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);
    insertEmployee(db, { ...former, hireDate: '2025-08-01', exitDate: '2025-12-31' });

    const response = await request(app)
      .post('/api/employees')
      .send(rehireBody({ hireDate: '2025-09-01' }));

    expect(response.status).toBe(400);
  });

  it('still answers 409 EMAIL_TAKEN when an active employee has the email', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);
    insertEmployee(db, { email: 'asha.rao@acme.example' });

    const response = await request(app).post('/api/employees').send(rehireBody());

    expect(response.status).toBe(409);
    expect((response.body as ApiErrorBody).error.code).toBe('EMAIL_TAKEN');
  });

  it('lets a returning person be added again after the rehired record is also deleted', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, former);
    const rehired = (await request(app).post('/api/employees').send(rehireBody()))
      .body as EmployeeDetail;
    await request(app).delete(`/api/employees/${rehired.id}?exitDate=2026-09-01`);

    const response = await request(app)
      .post('/api/employees')
      .send(rehireBody({ hireDate: '2026-09-02' }));

    expect(response.status).toBe(201);
    expect((response.body as EmployeeDetail).linkedEmployments).toHaveLength(2);
  });
});

describe('GET /api/employees/email-check', () => {
  const check = async (app: ReturnType<typeof createTestApp>['app'], email: string) =>
    request(app).get('/api/employees/email-check').query({ email });

  it('reports no match for an unused email', async () => {
    const { app } = createTestApp();

    const response = await check(app, 'nobody@acme.example');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ activeEmployeeId: null, inactiveEmployees: [] });
  });

  it('reports the active employee id, ignoring case and surrounding spaces', async () => {
    const { app, db } = createTestApp();
    const id = insertEmployee(db, { email: 'asha.rao@acme.example' });

    const { body } = await check(app, '  Asha.Rao@Acme.example ');

    expect((body as EmailCheckResult).activeEmployeeId).toBe(id);
  });

  it('lists the inactive employees with the email, most recent exit first', async () => {
    const { app, db } = createTestApp();
    const older = insertEmployee(db, {
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      hireDate: '2018-01-01',
      status: 'inactive',
      exitDate: '2019-01-01',
    });
    const newer = insertEmployee(db, {
      fullName: 'Asha Rao-Kumar',
      email: 'asha.rao@acme.example',
      hireDate: '2020-01-01',
      status: 'inactive',
      exitDate: '2022-01-01',
    });

    const { body } = await check(app, 'asha.rao@acme.example');

    expect(body).toEqual({
      activeEmployeeId: null,
      inactiveEmployees: [
        {
          id: newer,
          fullName: 'Asha Rao-Kumar',
          hireDate: '2020-01-01',
          exitDate: '2022-01-01',
          status: 'inactive',
        },
        {
          id: older,
          fullName: 'Asha Rao',
          hireDate: '2018-01-01',
          exitDate: '2019-01-01',
          status: 'inactive',
        },
      ],
    });
  });

  it('answers an empty result when no email is given, instead of treating "email-check" as an id', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/employees/email-check');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ activeEmployeeId: null, inactiveEmployees: [] });
  });
});
