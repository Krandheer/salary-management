import ExcelJS from 'exceljs';
import { TEMPLATE_COLUMNS, type TemplateField } from '../src/spreadsheet/templateColumns.ts';

export type ImportRowCells = Partial<Record<TemplateField, ExcelJS.CellValue>>;

export const TEMPLATE_HEADERS = TEMPLATE_COLUMNS.map((column) => column.header);

const DEFAULT_ROW: Record<TemplateField, ExcelJS.CellValue> = {
  fullName: 'Asha Rao',
  email: 'asha.rao@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'India',
  currency: 'INR',
  annualSalary: 2_500_000,
  employmentType: 'Full-time',
  hireDate: new Date('2021-03-15T00:00:00.000Z'),
};

/** A valid data row in template column order; overrides replace single cells (use null for empty). */
export function anImportRow(overrides: ImportRowCells = {}): ExcelJS.CellValue[] {
  return TEMPLATE_COLUMNS.map(({ key }) => (key in overrides ? overrides[key] : DEFAULT_ROW[key]));
}

export interface ImportFileOptions {
  headers?: ExcelJS.CellValue[];
  /** Extra sheets added after the first one, each as rows of cell values. */
  otherSheets?: ExcelJS.CellValue[][][];
  /** Ranges of the first sheet to merge, such as 'D2:D3'. */
  merges?: string[];
}

/** An .xlsx whose first sheet has the header row (the template headers by default) and the rows. */
export async function buildImportFile(
  rows: ExcelJS.CellValue[][],
  options: ImportFileOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employees');
  sheet.addRow(options.headers ?? TEMPLATE_HEADERS);
  for (const row of rows) sheet.addRow(row);
  for (const range of options.merges ?? []) sheet.mergeCells(range);
  (options.otherSheets ?? []).forEach((otherRows, index) => {
    const other = workbook.addWorksheet(`Other ${index + 1}`);
    for (const row of otherRows) other.addRow(row);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
