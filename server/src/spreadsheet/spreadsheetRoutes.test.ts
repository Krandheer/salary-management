import ExcelJS from 'exceljs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { ImportPreview } from '@acme/contracts';
import type { AppDatabase } from '../db/database.ts';
import { insertEmployee } from '../../test/builders.ts';
import { downloadFile } from '../../test/download.ts';
import { anImportRow, buildImportFile, TEMPLATE_HEADERS } from '../../test/importWorkbook.ts';
import { createTestApp } from '../../test/testApp.ts';
import { ALLOWED_VALUES_SHEET } from './templateColumns.ts';
import { MAX_IMPORT_BYTES } from './workbookReader.ts';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function firstSheetRows(content: Buffer): Promise<ExcelJS.CellValue[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
  const rows: ExcelJS.CellValue[][] = [];
  workbook.worksheets[0]!.eachRow((row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1)));
  return rows;
}

function namesOf(rows: ExcelJS.CellValue[][]): ExcelJS.CellValue[] {
  return rows.slice(1).map((row) => row[0]);
}

describe('GET /api/exports/employees', () => {
  it('names the file after the clock date and sends an xlsx attachment', async () => {
    const { app } = createTestApp({ today: '2026-10-24' });

    const response = await downloadFile(app, '/api/exports/employees');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(XLSX_TYPE);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="employees-2026-10-24.xlsx"',
    );
  });

  it('exports every active employee in the list order, with the country name and currency', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      fullName: 'Zed Last',
      countryCode: 'IN',
      salaryHistory: [{ amount: 2_000_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      fullName: 'Amy First',
      salaryHistory: [{ amount: 90_000, effectiveDate: '2020-01-15' }],
    });

    const rows = await firstSheetRows(
      (await downloadFile(app, '/api/exports/employees')).body as Buffer,
    );

    expect(namesOf(rows)).toEqual(['Amy First', 'Zed Last']);
    expect(rows[2]!.slice(4, 7)).toEqual(['India', 'INR', 2_000_000]);
  });

  it('exports the current salary, not an earlier one', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, {
      salaryHistory: [
        { amount: 50_000, effectiveDate: '2020-01-15' },
        { amount: 65_000, effectiveDate: '2023-01-01' },
      ],
    });

    const rows = await firstSheetRows(
      (await downloadFile(app, '/api/exports/employees')).body as Buffer,
    );

    expect(rows[1]![6]).toBe(65_000);
  });

  it('exports only the employees matching search, country and department', async () => {
    const { app, db } = createTestApp();
    const salaryHistory = [{ amount: 70_000, effectiveDate: '2020-01-15' }];
    insertEmployee(db, {
      fullName: 'Maria Garcia',
      countryCode: 'US',
      department: 'Sales',
      salaryHistory,
    });
    insertEmployee(db, {
      fullName: 'Maria Silva',
      countryCode: 'GB',
      department: 'Sales',
      salaryHistory,
    });
    insertEmployee(db, {
      fullName: 'Maria Rossi',
      countryCode: 'US',
      department: 'Legal',
      salaryHistory,
    });
    insertEmployee(db, {
      fullName: 'Tom Hardy',
      countryCode: 'US',
      department: 'Sales',
      salaryHistory,
    });

    const response = await downloadFile(
      app,
      '/api/exports/employees?search=maria&country=US&department=Sales',
    );

    expect(namesOf(await firstSheetRows(response.body as Buffer))).toEqual(['Maria Garcia']);
  });

  it('exports the inactive employees when status is inactive', async () => {
    const { app, db } = createTestApp();
    const salaryHistory = [{ amount: 70_000, effectiveDate: '2020-01-15' }];
    insertEmployee(db, { fullName: 'Active One', salaryHistory });
    insertEmployee(db, {
      fullName: 'Gone Two',
      status: 'inactive',
      exitDate: '2024-05-01',
      salaryHistory,
    });

    const response = await downloadFile(app, '/api/exports/employees?status=inactive');

    expect(namesOf(await firstSheetRows(response.body as Buffer))).toEqual(['Gone Two']);
  });

  it('matches the rows of the list endpoint for the same query', async () => {
    const { app, db } = createTestApp();
    const salaryHistory = [{ amount: 70_000, effectiveDate: '2020-01-15' }];
    for (const fullName of ['Carl B', 'Ann A', 'Bob C', 'Ann A']) {
      insertEmployee(db, { fullName, salaryHistory });
    }

    const list = await (await import('supertest')).default(app).get('/api/employees?page=1');
    const exported = await firstSheetRows(
      (await downloadFile(app, '/api/exports/employees')).body as Buffer,
    );

    const listedEmails = (list.body.items as { id: number }[]).map((item) => item.id);
    expect(listedEmails).toHaveLength(4);
    const exportedEmails = exported.slice(1).map((row) => {
      const cell = row[1];
      return typeof cell === 'string' ? cell : '';
    });
    const detailEmails = await Promise.all(
      listedEmails.map(async (id) => (await request(app).get(`/api/employees/${id}`)).body.email),
    );
    expect(exportedEmails).toEqual(detailEmails);
  });

  it('downloads a header-only file when nothing matches', async () => {
    const { app } = createTestApp();

    const response = await downloadFile(app, '/api/exports/employees?search=nobody');
    const rows = await firstSheetRows(response.body as Buffer);

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
  });

  it('includes the Allowed values sheet', async () => {
    const { app } = createTestApp();

    const response = await downloadFile(app, '/api/exports/employees');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as ExcelJS.Buffer);

    expect(workbook.getWorksheet(ALLOWED_VALUES_SHEET)).toBeDefined();
  });

  it('rejects an unknown country filter with 400', async () => {
    const { app } = createTestApp();

    const response = await downloadFile(app, '/api/exports/employees?country=ZZ');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/imports/template', () => {
  it('serves the template under its fixed file name', async () => {
    const { app } = createTestApp();

    const response = await downloadFile(app, '/api/imports/template');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(XLSX_TYPE);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="employee-import-template.xlsx"',
    );
  });

  it('contains only the header row and the Allowed values sheet', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { salaryHistory: [{ amount: 70_000, effectiveDate: '2020-01-15' }] });

    const response = await downloadFile(app, '/api/imports/template');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as ExcelJS.Buffer);

    expect(workbook.worksheets[0]!.rowCount).toBe(1);
    expect(workbook.getWorksheet(ALLOWED_VALUES_SHEET)).toBeDefined();
  });
});

function postPreview(app: Express, content: Buffer, fileName = 'employees.xlsx') {
  return request(app).post('/api/imports/preview').attach('file', content, fileName);
}

function countRows(db: AppDatabase): { employees: number; salaryHistory: number } {
  const countOf = (table: string) =>
    (db.$client.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
  return { employees: countOf('employees'), salaryHistory: countOf('salary_history') };
}

const US_ROW = { country: 'United States', currency: 'USD' } as const;

describe('POST /api/imports/preview', () => {
  it('previews creates, updates, unchanged rows, rehires and errors without saving anything', async () => {
    const { app, db } = createTestApp({ today: '2026-10-24' });
    const sameFields = {
      fullName: 'Sam Same',
      jobTitle: 'Designer',
      department: 'Design',
      hireDate: '2020-01-15',
    };
    insertEmployee(db, { ...sameFields, email: 'same@acme.example' });
    insertEmployee(db, { ...sameFields, fullName: 'Rae Raise', email: 'raise@acme.example' });
    const goneId = insertEmployee(db, {
      ...sameFields,
      fullName: 'Gail Gone',
      email: 'gone@acme.example',
      status: 'inactive',
      exitDate: '2024-05-01',
    });
    const before = countRows(db);
    const rowFor = (fullName: string, email: string, extra = {}) =>
      anImportRow({
        ...US_ROW,
        ...sameFields,
        fullName,
        email,
        annualSalary: 85_000,
        hireDate: new Date('2020-01-15T00:00:00.000Z'),
        ...extra,
      });
    const content = await buildImportFile([
      rowFor('Sam Same', 'SAME@acme.example'),
      rowFor('Rae Raise', 'raise@acme.example', { annualSalary: 90_000 }),
      rowFor('Gail Gone', 'gone@acme.example', { hireDate: '2025-01-06' }),
      rowFor('Nia New', 'new@acme.example'),
      rowFor('Cy Currency', 'cy@acme.example', { currency: 'EUR' }),
    ]);

    const response = await postPreview(app, content);

    expect(response.status).toBe(200);
    expect(response.body as ImportPreview).toEqual({
      totals: { create: 2, update: 1, unchanged: 1, error: 1 },
      creates: [
        { row: 4, email: 'gone@acme.example', rehireOf: goneId },
        { row: 5, email: 'new@acme.example', rehireOf: null },
      ],
      updates: [
        {
          row: 3,
          email: 'raise@acme.example',
          changes: [{ field: 'Annual Salary', from: '85000', to: '90000' }],
        },
      ],
      errors: [
        {
          row: 6,
          email: 'cy@acme.example',
          messages: ['Currency: Currency must be USD for United States'],
        },
      ],
    });
    expect(countRows(db)).toEqual(before);
  });

  it('compares a row for a twice-departed employee with their most recent inactive record', async () => {
    const { app, db } = createTestApp();
    const email = 'twice@acme.example';
    const record = {
      fullName: 'Tess Twice',
      email,
      status: 'inactive',
      countryCode: 'US',
    } as const;
    const latestId = insertEmployee(db, {
      ...record,
      hireDate: '2020-01-15',
      exitDate: '2024-06-30',
    });
    insertEmployee(db, { ...record, hireDate: '2015-02-01', exitDate: '2018-12-31' });
    const rowFor = (hireDate: string) =>
      anImportRow({ ...US_ROW, fullName: 'Tess Twice', email, annualSalary: 85_000, hireDate });
    const content = await buildImportFile([rowFor('2020-01-15')]);
    const olderRecord = await buildImportFile([rowFor('2015-02-01')]);

    const latest = (await postPreview(app, content)).body as ImportPreview;
    const older = (await postPreview(app, olderRecord)).body as ImportPreview;

    expect(latest.totals.unchanged).toBe(1);
    expect(older.errors[0]!.messages).toEqual([
      `Work Email: Employee #${latestId} is inactive and can't be changed; a rehire needs a hire date after their exit date (2024-06-30)`,
    ]);
  });

  it('rejects a file that is not .xlsx with a message', async () => {
    const { app } = createTestApp();

    const response = await postPreview(app, Buffer.from('a,b\n1,2'), 'employees.csv');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILE');
    expect(response.body.error.message).toMatch(/\.xlsx/);
  });

  it('rejects a header row that does not match the template', async () => {
    const { app } = createTestApp();
    const content = await buildImportFile([anImportRow()], {
      headers: [...TEMPLATE_HEADERS].reverse(),
    });

    const response = await postPreview(app, content);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HEADER_MISMATCH');
  });

  it('rejects a file with no data rows', async () => {
    const { app } = createTestApp();

    const response = await postPreview(app, await buildImportFile([]));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NO_DATA_ROWS');
  });

  it('rejects an upload larger than 10 MB', async () => {
    const { app } = createTestApp();

    const response = await postPreview(app, Buffer.alloc(MAX_IMPORT_BYTES + 1));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    expect(response.body.error.message).toContain('10 MB');
  });

  it('rejects a request without a file', async () => {
    const { app } = createTestApp();

    const response = await request(app).post('/api/imports/preview');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects a file sent under another form field name', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/imports/preview')
      .attach('upload', await buildImportFile([anImportRow()]), 'employees.xlsx');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects extra form fields alongside the file', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/imports/preview')
      .field('note', 'hello')
      .attach('file', await buildImportFile([anImportRow()]), 'employees.xlsx');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILE');
  });

  it.each([
    ['a malformed multipart body', 'multipart/form-data; boundary=xyz', 'not multipart at all'],
    ['a multipart body without a boundary', 'multipart/form-data', 'anything'],
  ])('rejects %s as an invalid file', async (_case, contentType, body) => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Content-Type', contentType)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_FILE');
  });
});

describe('import round trip: export, then preview the same file', () => {
  function insertVariedEmployees(db: AppDatabase): void {
    insertEmployee(db, {
      fullName: 'Asha Rao',
      countryCode: 'IN',
      department: 'Product',
      employmentType: 'Part-time',
      salaryHistory: [
        { amount: 1_800_000, effectiveDate: '2020-01-15' },
        { amount: 2_100_000, effectiveDate: '2023-04-01', reason: 'Promotion' },
      ],
    });
    insertEmployee(db, {
      fullName: 'Kenji Sato',
      countryCode: 'JP',
      jobTitle: 'Data Analyst',
      employmentType: 'Contractor',
      salaryHistory: [{ amount: 7_500_000_000, effectiveDate: '2020-01-15' }],
    });
    insertEmployee(db, {
      fullName: 'Moved Person',
      countryCode: 'CA',
      hireDate: '2018-06-30',
      salaryHistory: [
        { amount: 80_000, effectiveDate: '2018-06-30', currency: 'USD' },
        { amount: 95_000, effectiveDate: '2022-01-01', currency: 'CAD' },
      ],
    });
  }

  async function previewOfExport(app: Express, query: string): Promise<ImportPreview> {
    const exported = await downloadFile(app, `/api/exports/employees${query}`);
    const response = await postPreview(app, exported.body as Buffer, 'employees-2026-10-24.xlsx');
    expect(response.status).toBe(200);
    return response.body as ImportPreview;
  }

  it('finds nothing to create, update or reject in an export of active employees', async () => {
    const { app, db } = createTestApp();
    insertVariedEmployees(db);

    const preview = await previewOfExport(app, '');

    expect(preview.totals).toEqual({ create: 0, update: 0, unchanged: 3, error: 0 });
  });

  it('finds nothing to create, update or reject in an export of inactive employees', async () => {
    const { app, db } = createTestApp();
    insertVariedEmployees(db);
    for (const [fullName, exitDate] of [
      ['Gone One', '2023-03-31'],
      ['Gone Two', '2025-12-31'],
    ] as const) {
      insertEmployee(db, { fullName, status: 'inactive', exitDate, countryCode: 'GB' });
    }

    const preview = await previewOfExport(app, '?status=inactive');

    expect(preview.totals).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
  });
});
