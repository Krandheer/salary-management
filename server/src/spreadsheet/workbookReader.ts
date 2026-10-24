import type ExcelJS from 'exceljs';

/** A cell as the import reads it: rich text, hyperlinks and formulas reduced to plain values. */
export type RawCellValue = string | number | Date | null;

/** One non-blank data row of the first sheet; `rowNumber` counts the header as row 1. */
export interface RawImportRow {
  rowNumber: number;
  cells: RawCellValue[];
}

export const MAX_IMPORT_ROWS = 20_000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function readCellValue(_value: ExcelJS.CellValue): RawCellValue {
  throw new Error('Not implemented');
}

export async function readImportFile(_content: Buffer, _fileName: string): Promise<RawImportRow[]> {
  throw new Error('Not implemented');
}
