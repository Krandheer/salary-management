import ExcelJS from 'exceljs';
import type { ExportRow } from '../employees/employeeReadModels.ts';
import { COUNTRIES, DEPARTMENTS, EMPLOYMENT_TYPES } from '../reference/referenceData.ts';
import { ALLOWED_VALUES_SHEET, TEMPLATE_COLUMNS, type TemplateField } from './templateColumns.ts';

const EMPLOYEES_SHEET = 'Employees';
const SALARY_FORMAT = '0';
const HIRE_DATE_FORMAT = 'yyyy-mm-dd';

const FIELD_OF_COLUMN: Record<TemplateField, (row: ExportRow) => string | number | Date> = {
  fullName: (row) => row.fullName,
  email: (row) => row.email,
  jobTitle: (row) => row.jobTitle,
  department: (row) => row.department,
  country: (row) => row.countryName,
  currency: (row) => row.currency,
  annualSalary: (row) => row.annualSalary,
  employmentType: (row) => row.employmentType,
  hireDate: (row) => new Date(`${row.hireDate}T00:00:00.000Z`),
};

function addEmployeesSheet(workbook: ExcelJS.Workbook, rows: readonly ExportRow[]): void {
  const sheet = workbook.addWorksheet(EMPLOYEES_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = TEMPLATE_COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('annualSalary').numFmt = SALARY_FORMAT;
  sheet.getColumn('hireDate').numFmt = HIRE_DATE_FORMAT;
  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(TEMPLATE_COLUMNS.map(({ key }) => [key, FIELD_OF_COLUMN[key](row)])),
    );
  }
}

function addAllowedValuesSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(ALLOWED_VALUES_SHEET);
  sheet.columns = [{ width: 24 }, { width: 12 }];
  sheet.addRow(['Country', 'Currency']).font = { bold: true };
  for (const country of COUNTRIES) sheet.addRow([country.name, country.currency]);
  sheet.addRow([]);
  sheet.addRow(['Department']).font = { bold: true };
  for (const department of DEPARTMENTS) sheet.addRow([department]);
  sheet.addRow([]);
  sheet.addRow(['Employment Type']).font = { bold: true };
  for (const type of EMPLOYMENT_TYPES) sheet.addRow([type]);
}

async function writeWorkbook(rows: readonly ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addEmployeesSheet(workbook, rows);
  addAllowedValuesSheet(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildEmployeesWorkbook(rows: readonly ExportRow[]): Promise<Buffer> {
  return writeWorkbook(rows);
}

export function buildTemplateWorkbook(): Promise<Buffer> {
  return writeWorkbook([]);
}
