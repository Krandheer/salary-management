import JSZip from 'jszip';
import type { CellValueContext } from './cellValues.ts';
import { readDateStyles } from './dateStyles.ts';
import { readSharedStrings } from './sharedStrings.ts';
import { parseXmlEntry } from './xmlEntry.ts';

/** The fixed part names exceljs 4.4.0 reads; it does not follow `_rels/.rels`. */
const WORKBOOK_PART = 'xl/workbook.xml';
const WORKBOOK_RELATIONSHIPS_PART = 'xl/_rels/workbook.xml.rels';
const SHARED_STRINGS_PART = 'xl/sharedStrings.xml';
const STYLES_PART = 'xl/styles.xml';
const WORKSHEET_PART = /xl\/worksheets\/sheet(\d+)[.]xml/;

export interface FirstWorksheet {
  entry: JSZip.JSZipObject;
  values: CellValueContext;
}

interface SheetReference {
  sheetId: number;
  relationshipId: string | undefined;
}

interface WorkbookPart {
  sheets: SheetReference[];
  isDate1904: boolean;
}

/** Parts by name, with the leading slash some writers add removed, as exceljs does. */
function partsByName(archive: JSZip): Map<string, JSZip.JSZipObject> {
  const parts = new Map<string, JSZip.JSZipObject>();
  for (const entry of Object.values(archive.files)) {
    if (!entry.dir) parts.set(entry.name.replace(/^\//, ''), entry);
  }
  return parts;
}

async function readWorkbookPart(entry: JSZip.JSZipObject | undefined): Promise<WorkbookPart> {
  const workbook: WorkbookPart = { sheets: [], isDate1904: false };
  if (!entry) return workbook;
  const openElements: string[] = [];
  await parseXmlEntry(entry, {
    onOpen(tag) {
      const parent = openElements.at(-1);
      if (tag.name === 'workbookPr' && openElements.length === 1) {
        workbook.isDate1904 = tag.attributes.date1904 === '1';
      } else if (tag.name === 'sheet' && parent === 'sheets' && openElements.length === 2) {
        workbook.sheets.push({
          sheetId: parseInt(tag.attributes.sheetId ?? '', 10),
          relationshipId: tag.attributes['r:id'],
        });
      }
      openElements.push(tag.name);
    },
    onClose() {
      openElements.pop();
    },
  });
  return workbook;
}

async function readRelationshipTargets(
  entry: JSZip.JSZipObject | undefined,
): Promise<Map<string, string>> {
  const targets = new Map<string, string>();
  if (!entry) return targets;
  await parseXmlEntry(entry, {
    onOpen(tag) {
      const { Id: id, Target: target } = tag.attributes;
      if (tag.name === 'Relationship' && id !== undefined && target !== undefined) {
        targets.set(id, target);
      }
    },
  });
  return targets;
}

/** exceljs ignores a sheet whose id is missing or zero: it never appears among the worksheets. */
function isListedSheet(sheet: SheetReference): boolean {
  return Number.isInteger(sheet.sheetId) && sheet.sheetId > 0;
}

/**
 * The first tab in workbook order whose relationship points at a worksheet part, resolved the
 * way exceljs's WorkbookXform reconciles sheets; chart sheets and dangling references are skipped.
 */
function firstWorksheetPart(
  workbook: WorkbookPart,
  targets: Map<string, string>,
  parts: Map<string, JSZip.JSZipObject>,
): JSZip.JSZipObject | null {
  for (const sheet of workbook.sheets.filter(isListedSheet)) {
    const target =
      sheet.relationshipId === undefined ? undefined : targets.get(sheet.relationshipId);
    if (target === undefined) continue;
    const partName = `xl/${target.replace(/^(\s|\/xl\/)+/, '')}`;
    const part = parts.get(partName);
    if (part && WORKSHEET_PART.test(partName)) return part;
  }
  return null;
}

/**
 * Opens an .xlsx and finds its first worksheet without unzipping it, along with what its cells
 * need to be read: shared strings, which styles are dates, and the date system. Only these few
 * parts are parsed; nothing builds a workbook model. Resolves to null when there is no worksheet.
 */
export async function openFirstWorksheet(content: Buffer): Promise<FirstWorksheet | null> {
  const parts = partsByName(await JSZip.loadAsync(content));
  const workbook = await readWorkbookPart(parts.get(WORKBOOK_PART));
  const targets = await readRelationshipTargets(parts.get(WORKBOOK_RELATIONSHIPS_PART));
  const entry = firstWorksheetPart(workbook, targets, parts);
  if (!entry) return null;
  return {
    entry,
    values: {
      sharedStrings: await readSharedStrings(parts.get(SHARED_STRINGS_PART)),
      isDateStyle: await readDateStyles(parts.get(STYLES_PART)),
      isDate1904: workbook.isDate1904,
    },
  };
}
