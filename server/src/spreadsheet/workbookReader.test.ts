import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { anImportRow, buildImportFile, TEMPLATE_HEADERS } from '../../test/importWorkbook.ts';
import { rewritePart, withDeclaredUncompressedSizes } from '../../test/zipArchive.ts';
import { ImportFileError } from '../shared/errors.ts';
import {
  type RawImportRow,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MAX_UNCOMPRESSED_BYTES,
  readCellValue,
  readImportFile,
} from './workbookReader.ts';

const FILE_NAME = 'employees.xlsx';
const FIRST_SHEET_PART = 'xl/worksheets/sheet1.xml';

async function expectRejection(read: Promise<unknown>, code: string): Promise<ImportFileError> {
  const error = await read.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ImportFileError);
  expect((error as ImportFileError).code).toBe(code);
  return error as ImportFileError;
}

function rowsOfOneCell(count: number): ExcelJS.CellValue[][] {
  return Array.from({ length: count }, (_, index) => [`Employee ${index}`]);
}

describe('readImportFile: the file itself', () => {
  it('rejects a file whose name does not end in .xlsx', async () => {
    const content = await buildImportFile([anImportRow()]);

    const error = await expectRejection(readImportFile(content, 'employees.csv'), 'INVALID_FILE');

    expect(error.message).toMatch(/\.xlsx/);
  });

  it('accepts the .xlsx extension in any letter case', async () => {
    const content = await buildImportFile([anImportRow()]);

    await expect(readImportFile(content, 'EMPLOYEES.XLSX')).resolves.toHaveLength(1);
  });

  it('rejects bytes that are not an Excel workbook', async () => {
    await expectRejection(
      readImportFile(Buffer.from('name,email\nA,a@b.co'), FILE_NAME),
      'INVALID_FILE',
    );
  });

  it('rejects a workbook that has no sheets', async () => {
    const empty = Buffer.from(await new ExcelJS.Workbook().xlsx.writeBuffer());

    await expectRejection(readImportFile(empty, FILE_NAME), 'INVALID_FILE');
  });

  it('rejects content larger than 10 MB without reading it', async () => {
    const oversize = Buffer.alloc(MAX_IMPORT_BYTES + 1);

    await expectRejection(readImportFile(oversize, FILE_NAME), 'FILE_TOO_LARGE');
  });

  it('rejects a workbook that would be larger than 24 MB once unzipped', async () => {
    const zipBomb = withDeclaredUncompressedSizes(
      await buildImportFile([anImportRow()]),
      () => MAX_UNCOMPRESSED_BYTES,
    );

    const error = await expectRejection(readImportFile(zipBomb, FILE_NAME), 'INVALID_FILE');

    expect(error.message).toBe('The file is too large when uncompressed (over 24 MB)');
  });

  it('rejects a workbook declaring 25 MB once unzipped, well under the old 100 MB limit', async () => {
    const twentyFiveMegabytes = 25 * 1024 * 1024;
    const zipBomb = withDeclaredUncompressedSizes(
      await buildImportFile([anImportRow()]),
      (entryIndex) => (entryIndex === 0 ? twentyFiveMegabytes : 0),
    );

    const error = await expectRejection(readImportFile(zipBomb, FILE_NAME), 'INVALID_FILE');

    expect(error.message).toMatch(/too large when uncompressed/);
  });
});

describe('readImportFile: the header row', () => {
  it('rejects columns in a different order and names the expected headers', async () => {
    const swapped = [TEMPLATE_HEADERS[1], TEMPLATE_HEADERS[0], ...TEMPLATE_HEADERS.slice(2)];
    const content = await buildImportFile([anImportRow()], { headers: swapped });

    const error = await expectRejection(readImportFile(content, FILE_NAME), 'HEADER_MISMATCH');

    expect(error.message).toContain(TEMPLATE_HEADERS.join(', '));
  });

  it('rejects a header row with a missing column', async () => {
    const content = await buildImportFile([anImportRow()], {
      headers: TEMPLATE_HEADERS.filter((header) => header !== 'Currency'),
    });

    await expectRejection(readImportFile(content, FILE_NAME), 'HEADER_MISMATCH');
  });

  it('rejects a header row with an extra column', async () => {
    const content = await buildImportFile([anImportRow()], {
      headers: [...TEMPLATE_HEADERS, 'Notes'],
    });

    await expectRejection(readImportFile(content, FILE_NAME), 'HEADER_MISMATCH');
  });

  it('accepts headers that differ only in letter case and surrounding spaces', async () => {
    const content = await buildImportFile([anImportRow()], {
      headers: TEMPLATE_HEADERS.map((header) => `  ${header.toUpperCase()} `),
    });

    await expect(readImportFile(content, FILE_NAME)).resolves.toHaveLength(1);
  });
});

describe('readImportFile: the data rows', () => {
  it('reads the nine template cells of each row, numbering rows with the header as row 1', async () => {
    const content = await buildImportFile([anImportRow(), anImportRow({ fullName: 'Bela Roy' })]);

    const rows = await readImportFile(content, FILE_NAME);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
    expect(rows[0]!.cells).toEqual([
      'Asha Rao',
      'asha.rao@acme.example',
      'Software Engineer',
      'Engineering',
      'India',
      'INR',
      2_500_000,
      'Full-time',
      new Date('2021-03-15T00:00:00.000Z'),
    ]);
    expect(rows[1]!.cells[0]).toBe('Bela Roy');
  });

  it('ignores cells to the right of the template columns', async () => {
    const content = await buildImportFile([[...anImportRow(), 'a note']]);

    const [row] = await readImportFile(content, FILE_NAME);

    expect(row!.cells).toHaveLength(TEMPLATE_HEADERS.length);
  });

  it('skips rows whose cells are all empty or only spaces, keeping the other row numbers', async () => {
    const content = await buildImportFile([
      anImportRow(),
      TEMPLATE_HEADERS.map(() => null),
      ['   ', '', null],
      anImportRow({ fullName: 'Bela Roy' }),
    ]);

    const rows = await readImportFile(content, FILE_NAME);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 5]);
  });

  it('reads only the first sheet', async () => {
    const content = await buildImportFile([anImportRow()], {
      otherSheets: [
        [
          ['Not', 'the', 'template'],
          ['x', 'y', 'z'],
        ],
      ],
    });

    const rows = await readImportFile(content, FILE_NAME);

    expect(rows).toHaveLength(1);
  });

  it('rejects a file with only the header row', async () => {
    const content = await buildImportFile([]);

    await expectRejection(readImportFile(content, FILE_NAME), 'NO_DATA_ROWS');
  });

  it('rejects a file whose data rows are all blank', async () => {
    const content = await buildImportFile([['  '], [null, '']]);

    await expectRejection(readImportFile(content, FILE_NAME), 'NO_DATA_ROWS');
  });

  it('accepts exactly 20,000 data rows', async () => {
    const content = await buildImportFile(rowsOfOneCell(MAX_IMPORT_ROWS));

    await expect(readImportFile(content, FILE_NAME)).resolves.toHaveLength(MAX_IMPORT_ROWS);
  });

  it('rejects more than 20,000 data rows', async () => {
    const content = await buildImportFile(rowsOfOneCell(MAX_IMPORT_ROWS + 1));

    const error = await expectRejection(readImportFile(content, FILE_NAME), 'TOO_MANY_ROWS');

    expect(error.message).toContain('20,000');
  });

  it('stops reading at the 20,001st data row, before the rest of the sheet', async () => {
    const tooMany = await buildImportFile(rowsOfOneCell(MAX_IMPORT_ROWS + 1));
    const brokenAfterTheLimit = await rewritePart(tooMany, FIRST_SHEET_PART, (xml) =>
      xml.replace('</sheetData>', '<row r="90000"><<this is not XML'),
    );

    await expectRejection(readImportFile(brokenAfterTheLimit, FILE_NAME), 'TOO_MANY_ROWS');
  });

  it('reads a merged range from its top-left cell only, leaving the cells it covers empty', async () => {
    const content = await buildImportFile(
      [anImportRow(), anImportRow({ fullName: 'Bela Roy', department: null })],
      { merges: ['D2:D3'] },
    );

    const rows = await readImportFile(content, FILE_NAME);

    expect(rows[0]!.cells[3]).toBe('Engineering');
    expect(rows[1]!.cells[3]).toBeNull();
  });

  it('reads the first tab in workbook order, whichever part stores it', async () => {
    const content = await buildImportFile([anImportRow()], {
      otherSheets: [[TEMPLATE_HEADERS, anImportRow({ fullName: 'Bela Roy' })]],
    });
    const otherTabFirst = await rewritePart(content, 'xl/workbook.xml', (xml) =>
      xml.replace(/(<sheet [^>]*\/>)(<sheet [^>]*\/>)/, '$2$1'),
    );

    const rows = await readImportFile(otherTabFirst, FILE_NAME);

    expect(rows.map((row) => row.cells[0])).toEqual(['Bela Roy']);
  });
});

const HIRE_DATE = new Date('2021-03-15T00:00:00.000Z');

/** One row per kind of cell a spreadsheet application writes, in the template's nine columns. */
function rowsOfEveryCellKind(): ExcelJS.CellValue[][] {
  return [
    ['Plain text', 85_000, HIRE_DATE, true, { error: '#N/A' }, '   ', null, 'x', 1.5],
    [
      { richText: [{ text: 'Asha ', font: { bold: true } }, { text: 'Rao' }] },
      { text: 'asha.rao@acme.example', hyperlink: 'mailto:asha.rao@acme.example' },
      { formula: 'B2*2', result: 170_000 },
      { formula: 'A2', result: 'a text result' },
      { formula: 'TRUE()', result: true },
      { formula: '1/0', result: { error: '#DIV/0!' } },
      { formula: 'DATE(2021,3,15)', result: HIRE_DATE },
      { formula: 'B2' },
      '  padded  ',
    ],
    [null, null, null, null, null, null, null, null, null, 'beyond the template columns'],
    ['  ', '', null],
    ['Last', 44_270, 44_270.5, 44_270, 0, -1, 'end', null, 7],
  ];
}

/** Formats that decide whether a number reads as a date: built-in, custom, time and non-date. */
function formatEveryCellKind(sheet: ExcelJS.Worksheet): void {
  sheet.getCell('G3').numFmt = 'yyyy-mm-dd';
  sheet.getCell('B6').numFmt = 'dd/mm/yyyy';
  sheet.getCell('C6').numFmt = 'h:mm';
  sheet.getCell('D6').numFmt = '#,##0';
  sheet.getCell('E6').numFmt = 'mm-dd-yy';
  sheet.getCell('H6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
}

async function aWorkbookOfEveryCellKind(options: {
  useSharedStrings: boolean;
  date1904: boolean;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = options.date1904;
  const sheet = workbook.addWorksheet('Employees');
  sheet.addRow(TEMPLATE_HEADERS);
  for (const row of rowsOfEveryCellKind()) sheet.addRow(row);
  formatEveryCellKind(sheet);
  const content = await workbook.xlsx.writeBuffer({ useSharedStrings: options.useSharedStrings });
  return Buffer.from(content);
}

/** The rows as exceljs's full workbook model presents them: the reading every import has relied on. */
async function readThroughTheFullWorkbookModel(content: Buffer): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
  const rows: RawImportRow[] = [];
  workbook.worksheets[0]!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = TEMPLATE_HEADERS.map((_, index) => readCellValue(row.getCell(index + 1).value));
    const isBlank = cells.every((cell) => cell === null || String(cell).trim() === '');
    if (!isBlank) rows.push({ rowNumber, cells });
  });
  return rows;
}

describe('readImportFile: cell values match the full workbook model', () => {
  it.each([
    { label: 'shared strings', useSharedStrings: true, date1904: false },
    { label: 'inline strings', useSharedStrings: false, date1904: false },
    { label: 'the 1904 date system', useSharedStrings: true, date1904: true },
  ])('reads every kind of cell as the full model does, with $label', async (options) => {
    const content = await aWorkbookOfEveryCellKind(options);
    const expected = await readThroughTheFullWorkbookModel(content);

    const rows = await readImportFile(content, FILE_NAME);

    expect(expected.map((row) => row.rowNumber)).toEqual([2, 3, 6]);
    expect(rows).toEqual(expected);
  });
});

describe('readCellValue', () => {
  it('keeps plain strings, numbers and dates', () => {
    const date = new Date('2024-01-31T00:00:00.000Z');

    expect(readCellValue('text')).toBe('text');
    expect(readCellValue(85_000)).toBe(85_000);
    expect(readCellValue(date)).toBe(date);
  });

  it('reads an empty cell as null', () => {
    expect(readCellValue(null)).toBeNull();
    expect(readCellValue(undefined as unknown as ExcelJS.CellValue)).toBeNull();
  });

  it('joins the runs of a rich-text cell', () => {
    expect(readCellValue({ richText: [{ text: 'Asha ' }, { text: 'Rao' }] })).toBe('Asha Rao');
  });

  it('reads the text of a hyperlink cell, such as an email Excel turned into a link', () => {
    expect(
      readCellValue({ text: 'asha.rao@acme.example', hyperlink: 'mailto:asha.rao@acme.example' }),
    ).toBe('asha.rao@acme.example');
  });

  it('reads the text of a hyperlink whose text is rich text', () => {
    const value = {
      text: { richText: [{ text: 'asha.rao@' }, { text: 'acme.example' }] },
      hyperlink: 'mailto:asha.rao@acme.example',
    } as unknown as ExcelJS.CellValue;

    expect(readCellValue(value)).toBe('asha.rao@acme.example');
  });

  it('reads the stored result of a formula cell, never the formula', () => {
    expect(readCellValue({ formula: 'A1*2', result: 170_000 } as ExcelJS.CellValue)).toBe(170_000);
    expect(readCellValue({ sharedFormula: 'A1', result: 'x' } as ExcelJS.CellValue)).toBe('x');
  });

  it('reads a formula without a stored result as empty', () => {
    expect(readCellValue({ formula: 'A1*2' } as ExcelJS.CellValue)).toBeNull();
  });

  it('reads an error cell, and a formula that resulted in an error, as empty', () => {
    expect(readCellValue({ error: '#N/A' } as ExcelJS.CellValue)).toBeNull();
    expect(
      readCellValue({ formula: '1/0', result: { error: '#DIV/0!' } } as ExcelJS.CellValue),
    ).toBeNull();
  });

  it('reads a boolean as text', () => {
    expect(readCellValue(true)).toBe('true');
  });
});
