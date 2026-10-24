import type JSZip from 'jszip';
import { MalformedXlsxError } from './cellValues.ts';
import { parseXmlEntry } from './xmlEntry.ts';

/**
 * Built-in number formats that exceljs 4.4.0 treats as dates: the ids in its
 * `xlsx/defaultnumformats.js` whose format code passes `isDateFormat`. Locale-specific built-ins
 * (27-36, 50-58) have no single code there, so exceljs never reads them as dates.
 */
const BUILTIN_DATE_FORMAT_IDS: ReadonlySet<number> = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47,
]);

/** exceljs's `utils.isDateFmt`: any date or time letter outside quoted text and [brackets]. */
export function isDateFormat(formatCode: string): boolean {
  const withoutLiterals = formatCode.replace(/\[[^\]]*]/g, '').replace(/"[^"]*"/g, '');
  return /[ymdhMsb]+/.test(withoutLiterals);
}

function parseNumber(value: string | undefined): number {
  return parseInt(value ?? '', 10);
}

/** exceljs's NumFmtXform reads backslash escapes out of the code. */
function unescapeFormatCode(formatCode: string | undefined): string {
  if (formatCode === undefined) throw new MalformedXlsxError('A number format without a code');
  return formatCode.replace(/[\\](.)/g, '$1');
}

interface StyleSheetFormats {
  customFormats: Map<number, string>;
  /** The number format id of each cell style, by its index in `<cellXfs>`. */
  styleFormatIds: number[];
}

async function readStyleSheetFormats(entry: JSZip.JSZipObject): Promise<StyleSheetFormats> {
  const formats: StyleSheetFormats = { customFormats: new Map(), styleFormatIds: [] };
  const openElements: string[] = [];
  await parseXmlEntry(entry, {
    onOpen(tag) {
      const [, section] = openElements;
      if (openElements.length === 2 && section === 'numFmts' && tag.name === 'numFmt') {
        const id = parseNumber(tag.attributes.numFmtId);
        formats.customFormats.set(id, unescapeFormatCode(tag.attributes.formatCode));
      } else if (openElements.length === 2 && section === 'cellXfs' && tag.name === 'xf') {
        formats.styleFormatIds.push(parseNumber(tag.attributes.numFmtId));
      }
      openElements.push(tag.name);
    },
    onClose() {
      openElements.pop();
    },
  });
  return formats;
}

/**
 * Which cell styles (the `s` of a `<c>`) display numbers as dates, as exceljs's StylesXform
 * decides it: the style's number format, custom when the workbook defines that id, else built in.
 * A workbook without styles has no date styles.
 */
export async function readDateStyles(
  entry: JSZip.JSZipObject | undefined,
): Promise<(styleId: number) => boolean> {
  if (!entry) return () => false;
  const { customFormats, styleFormatIds } = await readStyleSheetFormats(entry);
  return (styleId) => {
    const formatId = styleFormatIds[styleId];
    if (!formatId) return false;
    const customFormat = customFormats.get(formatId);
    return customFormat ? isDateFormat(customFormat) : BUILTIN_DATE_FORMAT_IDS.has(formatId);
  };
}
