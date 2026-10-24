import type ExcelJS from 'exceljs';
import type JSZip from 'jszip';
import { MalformedXlsxError, type SharedString } from './cellValues.ts';
import { parseXmlEntry, type XmlTag } from './xmlEntry.ts';

/** exceljs's TextXform decodes `_xHHHH_` escapes in shared and rich text, never in inline `<t>`. */
export function decodeEscapedCharacters(text: string): string {
  return text.replace(/_x([0-9A-F]{4})_/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

/**
 * A `<r>` run of rich text, as exceljs's RichTextXform reads it: the text of its `<t>`, with
 * everything in `<rPr>` (the font) ignored. Shared by shared strings and inline strings.
 */
export class RichTextRun {
  private text: string | undefined;
  private textPieces: string[] | null = null;
  private isInFont = false;

  open(tag: XmlTag): void {
    if (this.textPieces !== null) {
      if (tag.name === 't') this.textPieces = [];
      return;
    }
    if (this.isInFont) return;
    if (tag.name === 't') this.textPieces = [];
    else if (tag.name === 'rPr') this.isInFont = true;
  }

  addText(text: string): void {
    this.textPieces?.push(text);
  }

  /** True when this closes the run itself. */
  close(name: string): boolean {
    if (name === 'r') return true;
    if (name === 't') {
      this.text = decodeEscapedCharacters((this.textPieces ?? []).join(''));
      this.textPieces = null;
    } else if (name === 'rPr') {
      this.isInFont = false;
    }
    return false;
  }

  toRichText(): ExcelJS.RichText {
    return { text: this.text ?? '' };
  }
}

/** Phonetic guide text (`<rPh>`) is not part of a string's value. */
class PhoneticRun {
  private innerEnd: 'any' | 'r' | null = null;

  open(tag: XmlTag): void {
    if (this.innerEnd !== null) return;
    if (tag.name === 't') this.innerEnd = 'any';
    else if (tag.name === 'r') this.innerEnd = 'r';
  }

  /** True when this closes the phonetic run itself. */
  close(name: string): boolean {
    if (this.innerEnd === 'any' || (this.innerEnd === 'r' && name === 'r')) {
      this.innerEnd = null;
      return false;
    }
    return this.innerEnd === null && name === 'rPh';
  }
}

/** One `<si>`, mirroring exceljs's SharedStringXform: a `<t>` sets the text, each `<r>` adds a run. */
class SharedStringEntry {
  private value: SharedString = null;
  private textPieces: string[] | null = null;
  private run: RichTextRun | null = null;
  private phonetic: PhoneticRun | null = null;

  open(tag: XmlTag): void {
    if (this.run) this.run.open(tag);
    else if (this.phonetic) this.phonetic.open(tag);
    else if (this.textPieces !== null) {
      if (tag.name === 't') this.textPieces = [];
    } else if (tag.name === 'r') this.run = new RichTextRun();
    else if (tag.name === 't') this.textPieces = [];
    else if (tag.name === 'rPh') this.phonetic = new PhoneticRun();
  }

  addText(text: string): void {
    if (this.run) this.run.addText(text);
    else if (!this.phonetic) this.textPieces?.push(text);
  }

  /** True when this closes the `<si>` itself. */
  close(name: string): boolean {
    if (this.run) {
      if (this.run.close(name)) this.addRun(this.run);
      return false;
    }
    if (this.phonetic) {
      if (this.phonetic.close(name)) this.phonetic = null;
      return false;
    }
    if (this.textPieces !== null) {
      if (name === 't') this.value = decodeEscapedCharacters(this.textPieces.join(''));
      this.textPieces = null;
      return false;
    }
    return name === 'si';
  }

  private addRun(run: RichTextRun): void {
    if (typeof this.value === 'string') throw new MalformedXlsxError('A run after shared text');
    this.value ??= { richText: [] };
    this.value.richText.push(run.toRichText());
    this.run = null;
  }

  toSharedString(): SharedString {
    return this.value;
  }
}

/**
 * The shared-strings table, read as exceljs's SharedStringsXform reads it, or null when the
 * workbook has none. Its size is bounded by the uncompressed-size check made before it is read.
 */
export async function readSharedStrings(
  entry: JSZip.JSZipObject | undefined,
): Promise<SharedString[] | null> {
  if (!entry) return null;
  const strings: SharedString[] = [];
  let current: SharedStringEntry | null = null;
  await parseXmlEntry(entry, {
    onOpen(tag) {
      if (current) current.open(tag);
      else if (tag.name === 'si') current = new SharedStringEntry();
      else if (tag.name !== 'sst') throw new MalformedXlsxError(`Unexpected <${tag.name}>`);
    },
    onText(text) {
      current?.addText(text);
    },
    onClose(tag) {
      if (current?.close(tag.name)) {
        strings.push(current.toSharedString());
        current = null;
      }
    },
  });
  return strings;
}
