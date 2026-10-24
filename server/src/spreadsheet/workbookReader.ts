import ExcelJS from 'exceljs';
import { ImportFileError } from '../shared/errors.ts';
import { normalizeKey } from '../shared/text.ts';
import { TEMPLATE_COLUMNS } from './templateColumns.ts';

/** A cell as the import reads it: rich text, hyperlinks and formulas reduced to plain values. */
export type RawCellValue = string | number | Date | null;

/** One non-blank data row of the first sheet; `rowNumber` counts the header as row 1. */
export interface RawImportRow {
  rowNumber: number;
  cells: RawCellValue[];
}

export const MAX_IMPORT_ROWS = 20_000;
const MAX_IMPORT_MEGABYTES = 10;
export const MAX_IMPORT_BYTES = MAX_IMPORT_MEGABYTES * 1024 * 1024;

const HEADER_ROW_NUMBER = 1;
const XLSX_FILE_NAME = /\.xlsx$/i;
const EXPECTED_HEADER_KEYS = TEMPLATE_COLUMNS.map(({ header }) => normalizeKey(header));

/** The plain value behind a cell; formulas are never evaluated, only their stored result is read. */
export function readCellValue(value: ExcelJS.CellValue): RawCellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value;
  if (typeof value === 'boolean') return String(value);
  if ('richText' in value) return value.richText.map((run) => run.text).join('');
  if ('hyperlink' in value) return readCellValue(value.text as ExcelJS.CellValue);
  if ('result' in value) return readCellValue(value.result as ExcelJS.CellValue);
  return null;
}

function isBlankCell(value: RawCellValue): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function headerKeyOf(value: RawCellValue): string {
  if (value === null) return '';
  return normalizeKey(value instanceof Date ? value.toISOString() : String(value));
}

function rejectUnlessXlsxName(fileName: string): void {
  if (!XLSX_FILE_NAME.test(fileName)) {
    throw new ImportFileError('INVALID_FILE', 'The file must be an Excel workbook (.xlsx)');
  }
}

export function fileTooLargeError(): ImportFileError {
  return new ImportFileError(
    'FILE_TOO_LARGE',
    `The file is larger than ${MAX_IMPORT_MEGABYTES} MB`,
  );
}

function rejectIfTooLarge(content: Buffer): void {
  if (content.length > MAX_IMPORT_BYTES) throw fileTooLargeError();
}

async function loadFirstSheet(content: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportFileError('INVALID_FILE', 'The file could not be read as an Excel workbook');
  }
  const [firstSheet] = workbook.worksheets;
  if (!firstSheet) throw new ImportFileError('INVALID_FILE', 'The workbook has no sheets');
  return firstSheet;
}

function rejectUnlessTemplateHeaders(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(HEADER_ROW_NUMBER);
  const lastColumn = Math.max(headerRow.cellCount, EXPECTED_HEADER_KEYS.length);
  const headerKeys = Array.from({ length: lastColumn }, (_, index) =>
    headerKeyOf(readCellValue(headerRow.getCell(index + 1).value)),
  );
  const isTemplateOrder =
    EXPECTED_HEADER_KEYS.every((expected, index) => headerKeys[index] === expected) &&
    headerKeys.slice(EXPECTED_HEADER_KEYS.length).every((extra) => extra === '');
  if (!isTemplateOrder) {
    const expected = TEMPLATE_COLUMNS.map(({ header }) => header).join(', ');
    throw new ImportFileError(
      'HEADER_MISMATCH',
      `The first sheet's header row must have the template columns in this order: ${expected}`,
    );
  }
}

function readTemplateCells(row: ExcelJS.Row): RawCellValue[] {
  return TEMPLATE_COLUMNS.map((_, index) => readCellValue(row.getCell(index + 1).value));
}

/** The non-blank data rows; stops as soon as the row limit is passed, before any row is judged. */
function readDataRows(sheet: ExcelJS.Worksheet): RawImportRow[] {
  const rows: RawImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === HEADER_ROW_NUMBER) return;
    const cells = readTemplateCells(row);
    if (cells.every(isBlankCell)) return;
    if (rows.length === MAX_IMPORT_ROWS) {
      throw new ImportFileError(
        'TOO_MANY_ROWS',
        `The file has more than ${MAX_IMPORT_ROWS.toLocaleString('en-US')} data rows`,
      );
    }
    rows.push({ rowNumber, cells });
  });
  if (rows.length === 0) throw new ImportFileError('NO_DATA_ROWS', 'The file has no data rows');
  return rows;
}

/**
 * Reads the first sheet of an uploaded .xlsx into raw rows. Throws `ImportFileError` when the
 * file as a whole can't be imported: wrong type, too large, wrong header row, too many rows or none.
 */
export async function readImportFile(content: Buffer, fileName: string): Promise<RawImportRow[]> {
  rejectUnlessXlsxName(fileName);
  rejectIfTooLarge(content);
  const sheet = await loadFirstSheet(content);
  rejectUnlessTemplateHeaders(sheet);
  return readDataRows(sheet);
}
