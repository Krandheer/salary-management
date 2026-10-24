import ExcelJS from 'exceljs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { insertEmployee } from '../../test/builders.ts';
import { createTestApp } from '../../test/testApp.ts';
import { ALLOWED_VALUES_SHEET } from './templateColumns.ts';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function binaryParser(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function download(app: ReturnType<typeof createTestApp>['app'], url: string) {
  const response = await request(app).get(url).buffer(true).parse(binaryParser);
  return response;
}

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

    const response = await download(app, '/api/exports/employees');

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
      (await download(app, '/api/exports/employees')).body as Buffer,
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
      (await download(app, '/api/exports/employees')).body as Buffer,
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

    const response = await download(
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

    const response = await download(app, '/api/exports/employees?status=inactive');

    expect(namesOf(await firstSheetRows(response.body as Buffer))).toEqual(['Gone Two']);
  });

  it('matches the rows of the list endpoint for the same query', async () => {
    const { app, db } = createTestApp();
    const salaryHistory = [{ amount: 70_000, effectiveDate: '2020-01-15' }];
    for (const fullName of ['Carl B', 'Ann A', 'Bob C', 'Ann A']) {
      insertEmployee(db, { fullName, salaryHistory });
    }

    const list = await request(app).get('/api/employees?page=1');
    const exported = await firstSheetRows(
      (await download(app, '/api/exports/employees')).body as Buffer,
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

    const response = await download(app, '/api/exports/employees?search=nobody');
    const rows = await firstSheetRows(response.body as Buffer);

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
  });

  it('includes the Allowed values sheet', async () => {
    const { app } = createTestApp();

    const response = await download(app, '/api/exports/employees');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as ExcelJS.Buffer);

    expect(workbook.getWorksheet(ALLOWED_VALUES_SHEET)).toBeDefined();
  });

  it('rejects an unknown country filter with 400', async () => {
    const { app } = createTestApp();

    const response = await download(app, '/api/exports/employees?country=ZZ');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/imports/template', () => {
  it('serves the template under its fixed file name', async () => {
    const { app } = createTestApp();

    const response = await download(app, '/api/imports/template');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(XLSX_TYPE);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="employee-import-template.xlsx"',
    );
  });

  it('contains only the header row and the Allowed values sheet', async () => {
    const { app, db } = createTestApp();
    insertEmployee(db, { salaryHistory: [{ amount: 70_000, effectiveDate: '2020-01-15' }] });

    const response = await download(app, '/api/imports/template');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body as ExcelJS.Buffer);

    expect(workbook.worksheets[0]!.rowCount).toBe(1);
    expect(workbook.getWorksheet(ALLOWED_VALUES_SHEET)).toBeDefined();
  });
});
