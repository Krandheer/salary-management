import type ExcelJS from 'exceljs';
import type JSZip from 'jszip';
import {
  cellValueOf,
  type CellValueContext,
  type CellXml,
  isPlaceholderCell,
} from './cellValues.ts';
import { MalformedXlsxError } from './malformedXlsxError.ts';
import { RichTextRun } from './sharedStrings.ts';
import { parseXmlEntry, type XmlTag } from './xmlEntry.ts';

/** One `<row>` of a worksheet: its number and its cells' values by column (A = 1). */
export interface WorksheetRow {
  rowNumber: number;
  cells: ReadonlyMap<number, ExcelJS.CellValue>;
}

const LAST_COLUMN = 16_384;
const LAST_ROW_INDEX = 2 ** 32 - 2;
const LETTER_A = 65;
const LETTER_Z = 90;
const DIGIT_0 = 48;
const DIGIT_9 = 57;
const DOLLAR = 36;
/** The elements inside `<c>` that carry its formula and value. */
const CELL_CONTENT: ReadonlySet<string> = new Set(['f', 'v', 'is', 't', 'r']);

/**
 * The column of a cell reference such as "B12" or "$B$12", decoded as exceljs's colCache does:
 * capital letters before the row digits. A reference without letters, or past column XFD, makes
 * exceljs's full loader fail, so it is malformed here too.
 */
export function columnOfReference(reference: string): number {
  let column = 0;
  let hasRow = false;
  for (let index = 0; index < reference.length; index += 1) {
    const code = reference.charCodeAt(index);
    if (!hasRow && code >= LETTER_A && code <= LETTER_Z) column = column * 26 + code - 64;
    else if (code >= DIGIT_0 && code <= DIGIT_9) hasRow = true;
    else if (hasRow && column > 0 && code !== DOLLAR) break;
  }
  if (column === 0 || column > LAST_COLUMN) {
    throw new MalformedXlsxError(`Invalid cell reference ${reference}`);
  }
  return column;
}

/**
 * A row's number: its `r`, or, as OOXML allows a writer to leave `r` out, the one after the
 * previous row's. Rows must come in increasing order. exceljs instead dropped a row whose `r` was
 * missing or unusable and kept two rows of the same number, so rows vanished or repeated without a
 * word; here either makes the sheet malformed. The upper bound is the array index exceljs allows.
 */
function rowNumberOf(attribute: string | undefined, previousRowNumber: number): number {
  const rowNumber = attribute === undefined ? previousRowNumber + 1 : parseInt(attribute, 10);
  if (!(rowNumber >= 1 && rowNumber - 1 <= LAST_ROW_INDEX)) {
    throw new MalformedXlsxError(`Invalid row number ${attribute}`);
  }
  if (rowNumber <= previousRowNumber) {
    throw new MalformedXlsxError(`Row ${rowNumber} after row ${previousRowNumber}`);
  }
  return rowNumber;
}

/**
 * A `<c>` being read, mirroring exceljs's CellXform: `<f>` text is the formula, `<v>`/`<t>` the
 * value. Unlike CellXform, other child elements (a phonetic guide, extensions) are skipped whole;
 * CellXform mistakes their end for the cell's and loses the rest of the sheet.
 */
class CellReader {
  readonly reference: string | undefined;
  private readonly xml: CellXml;
  private textTarget: 'formula' | 'text' | null = null;
  private run: RichTextRun | null = null;
  private skippedDepth = 0;

  constructor(tag: XmlTag) {
    const { r: reference, t: type, s: style } = tag.attributes;
    this.reference = reference;
    this.xml = {
      type,
      styleId: style ? parseInt(style, 10) : undefined,
      formula: undefined,
      formulaShareType: undefined,
      text: undefined,
      runs: undefined,
    };
  }

  open(tag: XmlTag): void {
    if (this.run) this.run.open(tag);
    else if (this.skippedDepth > 0 || !CELL_CONTENT.has(tag.name)) this.skippedDepth += 1;
    else if (tag.name === 'f') {
      this.textTarget = 'formula';
      this.xml.formulaShareType = tag.attributes.t;
    } else if (tag.name === 'v' || tag.name === 't') {
      this.textTarget = 'text';
    } else if (tag.name === 'r') {
      this.run = new RichTextRun();
    }
  }

  addText(text: string): void {
    if (this.skippedDepth > 0) return;
    if (this.run) this.run.addText(text);
    else if (this.textTarget === 'formula') this.xml.formula = (this.xml.formula ?? '') + text;
    else if (this.textTarget === 'text' && this.xml.runs === undefined) {
      this.xml.text = (this.xml.text ?? '') + text;
    }
  }

  close(name: string): void {
    if (this.skippedDepth > 0 && !this.run) this.skippedDepth -= 1;
    else if (name === 'f' || name === 'v' || name === 'is') this.textTarget = null;
    else if (this.run) {
      if (this.run.close(name)) this.addRun(this.run);
    } else if (name === 't') this.textTarget = null;
  }

  private addRun(run: RichTextRun): void {
    if (this.xml.text !== undefined) throw new MalformedXlsxError('A run after inline text');
    (this.xml.runs ??= []).push(run.toRichText());
    this.run = null;
  }

  isPlaceholder(): boolean {
    return isPlaceholderCell(this.xml);
  }

  valueIn(context: CellValueContext): ExcelJS.CellValue {
    return cellValueOf(this.xml, context);
  }
}

/** A `<row>` being read; its cells land by column, a later cell replacing an earlier one. */
class RowReader {
  private readonly rowNumber: number;
  private readonly cells = new Map<number, ExcelJS.CellValue>();
  private previousColumn: number | null = null;

  constructor(tag: XmlTag, previousRowNumber: number) {
    this.rowNumber = rowNumberOf(tag.attributes.r, previousRowNumber);
  }

  /**
   * A cell without a reference follows the previous one, as exceljs's Row model assumes; one that
   * would land past the last column is malformed, as one with such a reference is.
   */
  addCell(cell: CellReader, context: CellValueContext): void {
    if (cell.isPlaceholder()) return;
    const column = this.columnOf(cell);
    this.previousColumn = column;
    this.cells.set(column, cell.valueIn(context));
  }

  private columnOf(cell: CellReader): number {
    if (cell.reference) return columnOfReference(cell.reference);
    if (this.previousColumn === null)
      throw new MalformedXlsxError('A first cell without a reference');
    if (this.previousColumn === LAST_COLUMN) {
      throw new MalformedXlsxError('A cell without a reference past the last column');
    }
    return this.previousColumn + 1;
  }

  toWorksheetRow(): WorksheetRow {
    return { rowNumber: this.rowNumber, cells: this.cells };
  }
}

/**
 * Streams a worksheet's `<sheetData>` row by row, in file order, handing each row to `onRow` and
 * keeping none of them; reading stops at `</sheetData>`, so merges, hyperlinks and the rest of the
 * sheet are never parsed. `onRow` may throw to stop reading at once. Cell values are the ones
 * exceljs's full workbook model would give, except that a merged range is not copied into the
 * cells it covers, elements exceljs does not expect inside a row or cell are skipped rather
 * than cutting the sheet short, and rows are numbered as `rowNumberOf` describes.
 */
export async function readWorksheetRows(
  entry: JSZip.JSZipObject,
  context: CellValueContext,
  onRow: (row: WorksheetRow) => void,
): Promise<void> {
  let isInSheetData = false;
  let isSheetDataRead = false;
  let row: RowReader | null = null;
  let previousRowNumber = 0;
  let cell: CellReader | null = null;
  await parseXmlEntry(entry, {
    onOpen(tag) {
      if (cell) cell.open(tag);
      else if (row) {
        if (tag.name === 'c') cell = new CellReader(tag);
      } else if (isInSheetData) {
        if (tag.name === 'row') row = new RowReader(tag, previousRowNumber);
      } else if (tag.name === 'sheetData') isInSheetData = true;
    },
    onText(text) {
      cell?.addText(text);
    },
    onClose(tag) {
      if (cell) {
        if (tag.name === 'c') {
          row!.addCell(cell, context);
          cell = null;
        } else cell.close(tag.name);
      } else if (row) {
        if (tag.name !== 'row') return;
        const finishedRow = row.toWorksheetRow();
        previousRowNumber = finishedRow.rowNumber;
        row = null;
        onRow(finishedRow);
      } else if (isInSheetData && tag.name === 'sheetData') {
        isSheetDataRead = true;
      }
    },
    isFinished: () => isSheetDataRead,
  });
}
