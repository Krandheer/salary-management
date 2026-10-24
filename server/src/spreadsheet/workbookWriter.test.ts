import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { COUNTRIES, DEPARTMENTS, EMPLOYMENT_TYPES } from '../reference/referenceData.ts';
import { ALLOWED_VALUES_SHEET, TEMPLATE_COLUMNS } from './templateColumns.ts';
import type { ExportRow } from '../employees/employeeReadModels.ts';
import { buildEmployeesWorkbook, buildTemplateWorkbook } from './workbookWriter.ts';

const EXPECTED_HEADERS = [
  'Full Name',
  'Work Email',
  'Job Title',
  'Department',
  'Country',
  'Currency',
  'Annual Salary',
  'Employment Type',
  'Hire Date',
];

function anExportRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryName: 'India',
    currency: 'INR',
    annualSalary: 2_500_000,
    employmentType: 'Full-time',
    hireDate: '2021-03-15',
    ...overrides,
  };
}

async function readWorkbook(content: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
  return workbook;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): ExcelJS.CellValue[] {
  return (sheet.getRow(rowNumber).values as ExcelJS.CellValue[]).slice(1);
}

describe('TEMPLATE_COLUMNS', () => {
  it('lists the nine template headers in the specified order', () => {
    expect(TEMPLATE_COLUMNS.map((column) => column.header)).toEqual(EXPECTED_HEADERS);
  });
});

describe('buildEmployeesWorkbook', () => {
  it('writes the template headers in the first row of the first sheet', async () => {
    const workbook = await readWorkbook(await buildEmployeesWorkbook([anExportRow()]));

    expect(workbook.worksheets[0]!.name).not.toBe(ALLOWED_VALUES_SHEET);
    expect(rowValues(workbook.worksheets[0]!, 1)).toEqual(EXPECTED_HEADERS);
  });

  it('writes one row per employee in the given order, in template column order', async () => {
    const rows = [anExportRow({ fullName: 'Asha Rao' }), anExportRow({ fullName: 'Bela Roy' })];

    const sheet = (await readWorkbook(await buildEmployeesWorkbook(rows))).worksheets[0]!;

    expect(sheet.rowCount).toBe(3);
    expect(rowValues(sheet, 2).slice(0, 8)).toEqual([
      'Asha Rao',
      'asha.rao@acme.example',
      'Software Engineer',
      'Engineering',
      'India',
      'INR',
      2_500_000,
      'Full-time',
    ]);
    expect(rowValues(sheet, 3)[0]).toBe('Bela Roy');
  });

  it('writes the salary as a plain number cell', async () => {
    const sheet = (await readWorkbook(await buildEmployeesWorkbook([anExportRow()])))
      .worksheets[0]!;

    const salary = sheet.getCell('G2');

    expect(salary.type).toBe(ExcelJS.ValueType.Number);
    expect(salary.value).toBe(2_500_000);
  });

  it('writes the hire date as a date cell at UTC midnight shown as yyyy-mm-dd', async () => {
    const sheet = (await readWorkbook(await buildEmployeesWorkbook([anExportRow()])))
      .worksheets[0]!;

    const hireDate = sheet.getCell('I2');

    expect(hireDate.type).toBe(ExcelJS.ValueType.Date);
    expect((hireDate.value as Date).toISOString()).toBe('2021-03-15T00:00:00.000Z');
    expect(hireDate.numFmt).toBe('yyyy-mm-dd');
  });

  it('writes only the header row when there are no employees', async () => {
    const sheet = (await readWorkbook(await buildEmployeesWorkbook([]))).worksheets[0]!;

    expect(sheet.rowCount).toBe(1);
    expect(rowValues(sheet, 1)).toEqual(EXPECTED_HEADERS);
  });

  it('adds an Allowed values sheet', async () => {
    const workbook = await readWorkbook(await buildEmployeesWorkbook([]));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toContain(ALLOWED_VALUES_SHEET);
  });
});

describe('buildTemplateWorkbook', () => {
  it('has only the header row on the first sheet', async () => {
    const sheet = (await readWorkbook(await buildTemplateWorkbook())).worksheets[0]!;

    expect(sheet.rowCount).toBe(1);
    expect(rowValues(sheet, 1)).toEqual(EXPECTED_HEADERS);
  });

  it('lists countries with currencies, departments and employment types on the Allowed values sheet', async () => {
    const workbook = await readWorkbook(await buildTemplateWorkbook());
    const sheet = workbook.getWorksheet(ALLOWED_VALUES_SHEET)!;

    const cells = sheet.getSheetValues().flatMap((row) => (Array.isArray(row) ? row : []));

    for (const country of COUNTRIES) {
      expect(cells).toContain(country.name);
      expect(cells).toContain(country.currency);
    }
    for (const department of DEPARTMENTS) expect(cells).toContain(department);
    for (const type of EMPLOYMENT_TYPES) expect(cells).toContain(type);
    expect(COUNTRIES).toHaveLength(8);
    expect(DEPARTMENTS).toHaveLength(10);
    expect(EMPLOYMENT_TYPES).toHaveLength(3);
  });

  it('pairs each country name with its currency on the same row', async () => {
    const sheet = (await readWorkbook(await buildTemplateWorkbook())).getWorksheet(
      ALLOWED_VALUES_SHEET,
    )!;

    const rows: ExcelJS.CellValue[][] = [];
    sheet.eachRow((row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1)));

    for (const country of COUNTRIES) {
      const row = rows.find((cells) => cells.includes(country.name));
      expect(row).toBeDefined();
      expect(row).toContain(country.currency);
    }
  });
});
