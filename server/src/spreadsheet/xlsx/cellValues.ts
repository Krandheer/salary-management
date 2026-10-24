import type ExcelJS from 'exceljs';

/**
 * These rules mirror how exceljs 4.4.0's full workbook loader (`xlsx/xform/sheet/cell-xform.js`
 * and its reconcile step) turns a `<c>` element into a cell value, so a streamed read gives the
 * import exactly the values a full load gave it.
 */

/** Thrown for XML that exceljs's full loader would also fail on; the reader reports it as unreadable. */
export class MalformedXlsxError extends Error {
  override readonly name = 'MalformedXlsxError';
}

/** One entry of the shared-strings table: plain text, rich-text runs, or nothing for an empty entry. */
export type SharedString = string | ExcelJS.CellRichTextValue | null;

export interface CellValueContext {
  /** null when the workbook has no shared-strings part. */
  sharedStrings: readonly SharedString[] | null;
  isDateStyle(styleId: number): boolean;
  isDate1904: boolean;
}

/** A `<c>` element as read from the sheet XML, before its value is interpreted. */
export interface CellXml {
  /** The `t` attribute: s, str, inlineStr, b, e, or absent for a number. */
  type: string | undefined;
  styleId: number | undefined;
  formula: string | undefined;
  /** The `t` attribute of `<f>`, which marks a shared formula even without formula text. */
  formulaShareType: string | undefined;
  /** Text of `<v>` and of `<t>` outside rich-text runs. */
  text: string | undefined;
  runs: ExcelJS.RichText[] | undefined;
}

const EXCEL_EPOCH_OFFSET_DAYS = 25_569;
const DATE_1904_OFFSET_DAYS = 1_462;
const MILLISECONDS_PER_DAY = 24 * 3600 * 1000;
const XML_ENTITIES: Readonly<Record<string, string>> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&apos;': "'",
  '&quot;': '"',
};

export function excelSerialToDate(serial: number, isDate1904: boolean): Date {
  const days = serial - EXCEL_EPOCH_OFFSET_DAYS + (isDate1904 ? DATE_1904_OFFSET_DAYS : 0);
  return new Date(Math.round(days * MILLISECONDS_PER_DAY));
}

/** exceljs decodes the five named entities a second time in `str` values; saxes did the first pass. */
function decodeXmlEntities(text: string): string {
  return text.replace(/&([a-z]*);/g, (entity) => XML_ENTITIES[entity] ?? entity);
}

function isFormula(cell: CellXml): boolean {
  return Boolean(cell.formula) || Boolean(cell.formulaShareType);
}

function hasValue(cell: CellXml): boolean {
  return cell.text !== undefined || cell.runs !== undefined;
}

/** A cell with no formula, no value and no style: exceljs skips it as if it were not there. */
export function isPlaceholderCell(cell: CellXml): boolean {
  return !isFormula(cell) && !hasValue(cell) && !cell.styleId;
}

function isDateStyled(cell: CellXml, context: CellValueContext): boolean {
  return Boolean(cell.styleId) && context.isDateStyle(cell.styleId!);
}

function sharedStringAt(text: string, context: CellValueContext): ExcelJS.CellValue {
  const index = parseInt(text, 10);
  if (context.sharedStrings === null) return index;
  const sharedString = context.sharedStrings[index];
  if (sharedString === undefined) throw new MalformedXlsxError(`No shared string ${text}`);
  return sharedString;
}

type FormulaResult = NonNullable<ExcelJS.CellFormulaValue['result']>;

function formulaResultOf(type: string | undefined, text: string): FormulaResult {
  switch (type) {
    case 'str':
      return decodeXmlEntities(text);
    case 'b':
      return parseInt(text, 10) !== 0;
    case 'e':
      return { error: text } as ExcelJS.CellErrorValue;
    default:
      return parseFloat(text);
  }
}

function formulaValueOf(cell: CellXml, context: CellValueContext): ExcelJS.CellFormulaValue {
  const result = cell.text === undefined ? undefined : formulaResultOf(cell.type, cell.text);
  const isDateResult = result !== undefined && isDateStyled(cell, context);
  return {
    formula: cell.formula ?? '',
    result: isDateResult ? excelSerialToDate(Number(result), context.isDate1904) : result,
  };
}

function plainValueOf(cell: CellXml, text: string, context: CellValueContext): ExcelJS.CellValue {
  switch (cell.type) {
    case 's':
      return sharedStringAt(text, context);
    case 'str':
      return decodeXmlEntities(text);
    case 'inlineStr':
      return text;
    case 'b':
      return parseInt(text, 10) !== 0;
    case 'e':
      return { error: text } as ExcelJS.CellErrorValue;
    default: {
      const number = parseFloat(text);
      return isDateStyled(cell, context) ? excelSerialToDate(number, context.isDate1904) : number;
    }
  }
}

/** The value exceljs's full workbook model gives this cell. */
export function cellValueOf(cell: CellXml, context: CellValueContext): ExcelJS.CellValue {
  if (isFormula(cell)) return formulaValueOf(cell, context);
  if (cell.runs !== undefined) {
    if (cell.type !== 'inlineStr')
      throw new MalformedXlsxError('Rich text outside an inline string');
    return { richText: cell.runs };
  }
  if (cell.text === undefined) return null;
  return plainValueOf(cell, cell.text, context);
}
