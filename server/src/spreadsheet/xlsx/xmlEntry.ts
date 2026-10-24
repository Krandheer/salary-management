import { StringDecoder } from 'node:string_decoder';
import type JSZip from 'jszip';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import { MalformedXlsxError } from './malformedXlsxError.ts';

export type XmlTag = SaxesTagPlain;

export interface XmlHandlers {
  onOpen?(tag: XmlTag): void;
  onText?(text: string): void;
  onClose?(tag: XmlTag): void;
  /** Checked after each chunk: once true, the rest of the entry is neither unzipped nor parsed. */
  isFinished?(): boolean;
}

/**
 * The deepest a real workbook part nests is about eight elements (worksheet > sheetData > row > c >
 * is > r > rPr > b); extension lists add a few more. saxes keeps every open element on a stack, so
 * without a cap a 25 KB upload of nested tags fills the heap.
 */
const MAX_XML_DEPTH = 64;
/**
 * The most attributes an element of a real workbook carries is about twenty (a root element's
 * namespace declarations, a sheet view's options). saxes holds an element's attributes until its
 * start tag ends, so without a cap one start tag can hold millions of them.
 */
const MAX_ATTRIBUTES = 64;

/**
 * Counts open elements and the current start tag's attributes. saxes emits `opentagstart` for
 * every element and `closetag` for every element it closes, a self-closing one included, so the
 * count stays balanced.
 */
class ElementLimits {
  private depth = 0;
  private attributeCount = 0;

  enterElement(): void {
    this.depth += 1;
    this.attributeCount = 0;
    if (this.depth > MAX_XML_DEPTH) {
      throw new MalformedXlsxError(`Elements nested more than ${MAX_XML_DEPTH} deep`);
    }
  }

  countAttribute(): void {
    this.attributeCount += 1;
    if (this.attributeCount > MAX_ATTRIBUTES) {
      throw new MalformedXlsxError(`An element with more than ${MAX_ATTRIBUTES} attributes`);
    }
  }

  leaveElement(): void {
    this.depth -= 1;
  }
}

function parserFor(handlers: XmlHandlers): SaxesParser {
  const parser = new SaxesParser();
  const limits = new ElementLimits();
  parser.on('opentagstart', () => limits.enterElement());
  parser.on('attribute', () => limits.countAttribute());
  if (handlers.onOpen) parser.on('opentag', handlers.onOpen);
  if (handlers.onText) parser.on('text', handlers.onText);
  parser.on('closetag', (tag) => {
    limits.leaveElement();
    handlers.onClose?.(tag);
  });
  return parser;
}

/**
 * Unzips one entry as a stream and feeds it through saxes, the XML parser exceljs uses, chunk by
 * chunk; nothing but the handlers' own state and saxes's stack of at most `MAX_XML_DEPTH` open
 * elements is kept. Like exceljs, CDATA is ignored and the end of the document is not checked for
 * unclosed elements. Rejects with the first XML error, a `MalformedXlsxError` for a part nested too
 * deep or an element with too many attributes, or whatever a handler throws, and stops unzipping
 * at once.
 */
export function parseXmlEntry(entry: JSZip.JSZipObject, handlers: XmlHandlers): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = parserFor(handlers);
    const decoder = new StringDecoder('utf8');
    const stream = entry.nodeStream('nodebuffer');
    const stop = () => {
      stream.removeAllListeners('data');
      stream.pause();
    };
    const parse = (text: string): boolean => {
      try {
        parser.write(text);
        return true;
      } catch (error) {
        stop();
        reject(error);
        return false;
      }
    };
    stream.on('data', (chunk: Buffer) => {
      if (parse(decoder.write(chunk)) && handlers.isFinished?.()) {
        stop();
        resolve();
      }
    });
    stream.on('end', () => {
      if (parse(decoder.end())) resolve();
    });
    stream.on('error', reject);
  });
}
