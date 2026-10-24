import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/reference/referenceData.ts';
import { generateSeedEmployees } from '../src/seed/generateEmployees.ts';
import { SEED_RANDOM_SEED } from '../src/seed/seedCatalogue.ts';
import { ImportFileError } from '../src/shared/errors.ts';
import { MAX_IMPORT_ROWS, readImportFile } from '../src/spreadsheet/workbookReader.ts';
import { buildEmployeesWorkbook, type ExportRow } from '../src/spreadsheet/workbookWriter.ts';
import { anImportRow, buildImportFile } from '../test/importWorkbook.ts';
import { rewritePart } from '../test/zipArchive.ts';

const FILE_NAME = 'employees.xlsx';
const FIRST_SHEET_PART = 'xl/worksheets/sheet1.xml';
const TODAY = '2026-10-24';

async function rejectionCodeOf(read: Promise<unknown>): Promise<string | null> {
  return read.then(
    () => null,
    (reason: unknown) => (reason instanceof ImportFileError ? reason.code : String(reason)),
  );
}

async function millisecondsToRun(work: () => Promise<unknown>): Promise<number> {
  const startedAt = performance.now();
  await work();
  return performance.now() - startedAt;
}

async function fullWorkbookLoad(content: Buffer): Promise<void> {
  await new ExcelJS.Workbook().xlsx.load(content as unknown as ExcelJS.Buffer);
}

/** Rows whose nine cells all sit to the right of the template columns, adding up to `bytes` of XML. */
function rowsBeyondTheTemplateColumns(bytes: number): string {
  const columns = ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
  const rows: string[] = [];
  let size = 0;
  for (let rowNumber = 2; size < bytes; rowNumber += 1) {
    const cells = columns.map((column) => `<c r="${column}${rowNumber}"><v>1</v></c>`).join('');
    const row = `<row r="${rowNumber}">${cells}</row>`;
    rows.push(row);
    size += row.length;
  }
  return rows.join('');
}

function exportRowsOfSeededEmployees(count: number): ExportRow[] {
  const seeded = generateSeedEmployees({ count, randomSeed: SEED_RANDOM_SEED, today: TODAY });
  return seeded.map((employee) => {
    const country = COUNTRIES.find(({ code }) => code === employee.countryCode)!;
    return {
      fullName: employee.fullName,
      email: employee.email,
      jobTitle: employee.jobTitle,
      department: employee.department,
      countryName: country.name,
      currency: country.currency,
      annualSalary: employee.salaryHistory.at(-1)!.amount,
      employmentType: employee.employmentType,
      hireDate: employee.hireDate,
    };
  });
}

describe('import file limits hold without building the whole workbook', () => {
  let threeTimesTheRowLimit: Buffer;

  beforeAll(async () => {
    threeTimesTheRowLimit = await buildImportFile(
      Array.from({ length: 3 * MAX_IMPORT_ROWS }, () => anImportRow()),
    );
  });

  it('rejects 60,000 data rows in under half the time a full workbook load takes', async () => {
    const fullLoadMs = await millisecondsToRun(() => fullWorkbookLoad(threeTimesTheRowLimit));
    let code: string | null = null;

    const rejectMs = await millisecondsToRun(async () => {
      code = await rejectionCodeOf(readImportFile(threeTimesTheRowLimit, FILE_NAME));
    });

    expect(code).toBe('TOO_MANY_ROWS');
    expect(rejectMs).toBeLessThan(fullLoadMs / 2);
  });

  it('reads a tiny file declaring a 2.5-million-cell merge in under 300 ms', async () => {
    const mergeBomb = await rewritePart(
      await buildImportFile([anImportRow()]),
      FIRST_SHEET_PART,
      (xml) =>
        xml.replace(
          '</sheetData>',
          '</sheetData><mergeCells count="1"><mergeCell ref="J2:Z100000"/></mergeCells>',
        ),
    );
    let rowCount = 0;

    const elapsedMs = await millisecondsToRun(async () => {
      rowCount = (await readImportFile(mergeBomb, FILE_NAME)).length;
    });

    expect(rowCount).toBe(1);
    expect(elapsedMs).toBeLessThan(300);
  });

  it('gets through 23 MB of cells outside the template columns faster than a full workbook load', async () => {
    const wideRows = await rewritePart(await buildImportFile([]), FIRST_SHEET_PART, (xml) =>
      xml.replace('</sheetData>', `${rowsBeyondTheTemplateColumns(23 * 1024 * 1024)}</sheetData>`),
    );
    const fullLoadMs = await millisecondsToRun(() => fullWorkbookLoad(wideRows));
    let code: string | null = null;

    const elapsedMs = await millisecondsToRun(async () => {
      code = await rejectionCodeOf(readImportFile(wideRows, FILE_NAME));
    });

    expect(code).toBe('NO_DATA_ROWS');
    expect(elapsedMs).toBeLessThan(fullLoadMs);
  });

  it('reads a 20,000-row export of seeded employees, well inside the uncompressed limit', async () => {
    const content = await buildEmployeesWorkbook(exportRowsOfSeededEmployees(MAX_IMPORT_ROWS));
    let rowCount = 0;

    const elapsedMs = await millisecondsToRun(async () => {
      rowCount = (await readImportFile(content, FILE_NAME)).length;
    });

    expect(rowCount).toBe(MAX_IMPORT_ROWS);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
