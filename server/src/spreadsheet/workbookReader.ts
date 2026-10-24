import type ExcelJS from 'exceljs';
import { ImportFileError } from '../shared/errors.ts';
import { normalizeKey } from '../shared/text.ts';
import { TEMPLATE_COLUMNS } from './templateColumns.ts';
import { openFirstWorksheet, type FirstWorksheet } from './xlsx/workbookPackage.ts';
import { readWorksheetRows, type WorksheetRow } from './xlsx/worksheetRows.ts';
import { checkUncompressedSize } from './zipSizeGuard.ts';

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
/**
 * Measured: a 20,000-row export of seeded employees unzips to 8.4 MiB (8,783,316 bytes), and the
 * review measured 9.4 MB for its 20,000-row template file. 24 MiB is about 2.5 times the larger
 * figure: room for longer values and the markup Excel adds when it saves, and a firm bound on
 * the shared strings the reader holds and on the bytes it unzips.
 */
const MAX_UNCOMPRESSED_MEGABYTES = 24;
export const MAX_UNCOMPRESSED_BYTES = MAX_UNCOMPRESSED_MEGABYTES * 1024 * 1024;

const HEADER_ROW_NUMBER = 1;
const NO_CELLS: ReadonlyMap<number, ExcelJS.CellValue> = new Map();
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

function unreadableWorkbookError(): ImportFileError {
  return new ImportFileError('INVALID_FILE', 'The file could not be read as an Excel workbook');
}

/** Checked before any part is parsed: it bounds both the unzipping and the strings held in memory. */
async function rejectIfTooLargeUncompressed(content: Buffer): Promise<void> {
  const check = await checkUncompressedSize(content, MAX_UNCOMPRESSED_BYTES);
  if (check === 'unreadable') throw unreadableWorkbookError();
  if (check === 'too-large') {
    throw new ImportFileError(
      'INVALID_FILE',
      `The file is too large when uncompressed (over ${MAX_UNCOMPRESSED_MEGABYTES} MB)`,
    );
  }
}

async function openFirstSheet(content: Buffer): Promise<FirstWorksheet> {
  let sheet: FirstWorksheet | null;
  try {
    sheet = await openFirstWorksheet(content);
  } catch {
    throw unreadableWorkbookError();
  }
  if (!sheet) throw new ImportFileError('INVALID_FILE', 'The workbook has no sheets');
  return sheet;
}

function cellAt(cells: ReadonlyMap<number, ExcelJS.CellValue>, column: number): RawCellValue {
  return readCellValue(cells.get(column) ?? null);
}

/** The template headers in order, and nothing but blanks to their right. */
function rejectUnlessTemplateHeaders(headerCells: ReadonlyMap<number, ExcelJS.CellValue>): void {
  const isTemplateOrder =
    EXPECTED_HEADER_KEYS.every(
      (expected, index) => headerKeyOf(cellAt(headerCells, index + 1)) === expected,
    ) &&
    [...headerCells.keys()].every(
      (column) =>
        column <= EXPECTED_HEADER_KEYS.length || headerKeyOf(cellAt(headerCells, column)) === '',
    );
  if (!isTemplateOrder) {
    const expected = TEMPLATE_COLUMNS.map(({ header }) => header).join(', ');
    throw new ImportFileError(
      'HEADER_MISMATCH',
      `The first sheet's header row must have the template columns in this order: ${expected}`,
    );
  }
}

function readTemplateCells(cells: ReadonlyMap<number, ExcelJS.CellValue>): RawCellValue[] {
  return TEMPLATE_COLUMNS.map((_, index) => cellAt(cells, index + 1));
}

function tooManyRowsError(): ImportFileError {
  return new ImportFileError(
    'TOO_MANY_ROWS',
    `The file has more than ${MAX_IMPORT_ROWS.toLocaleString('en-US')} data rows`,
  );
}

/**
 * Judges the sheet's rows as they stream past: the header row first, then each non-blank data
 * row, throwing as soon as the row limit is passed so the rest of the file is never read.
 */
class ImportRowCollector {
  private readonly rows: RawImportRow[] = [];
  private isHeaderChecked = false;

  add(row: WorksheetRow): void {
    const isHeaderRow = row.rowNumber === HEADER_ROW_NUMBER;
    if (!this.isHeaderChecked) this.checkHeader(isHeaderRow ? row.cells : NO_CELLS);
    if (isHeaderRow) return;
    const cells = readTemplateCells(row.cells);
    if (cells.every(isBlankCell)) return;
    if (this.rows.length === MAX_IMPORT_ROWS) throw tooManyRowsError();
    this.rows.push({ rowNumber: row.rowNumber, cells });
  }

  finish(): RawImportRow[] {
    if (!this.isHeaderChecked) this.checkHeader(NO_CELLS);
    if (this.rows.length === 0)
      throw new ImportFileError('NO_DATA_ROWS', 'The file has no data rows');
    return this.rows;
  }

  private checkHeader(headerCells: ReadonlyMap<number, ExcelJS.CellValue>): void {
    rejectUnlessTemplateHeaders(headerCells);
    this.isHeaderChecked = true;
  }
}

async function readSheetRows(sheet: FirstWorksheet): Promise<RawImportRow[]> {
  const collector = new ImportRowCollector();
  try {
    await readWorksheetRows(sheet.entry, sheet.values, (row) => collector.add(row));
  } catch (error) {
    throw error instanceof ImportFileError ? error : unreadableWorkbookError();
  }
  return collector.finish();
}

/**
 * Reads the first sheet of an uploaded .xlsx into raw rows. The sheet is streamed row by row and
 * no workbook model is built, so memory stays bounded by the rows kept (at most 20,000) whatever
 * the file holds. Throws `ImportFileError` when the file as a whole can't be imported: wrong
 * type, too large (as uploaded or once unzipped), wrong header row, too many rows or none.
 */
export async function readImportFile(content: Buffer, fileName: string): Promise<RawImportRow[]> {
  rejectUnlessXlsxName(fileName);
  rejectIfTooLarge(content);
  await rejectIfTooLargeUncompressed(content);
  return readSheetRows(await openFirstSheet(content));
}
