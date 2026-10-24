import { StringDecoder } from 'node:string_decoder';
import type JSZip from 'jszip';
import { SaxesParser, type SaxesTagPlain } from 'saxes';

export type XmlTag = SaxesTagPlain;

export interface XmlHandlers {
  onOpen?(tag: XmlTag): void;
  onText?(text: string): void;
  onClose?(tag: XmlTag): void;
  /** Checked after each chunk: once true, the rest of the entry is neither unzipped nor parsed. */
  isFinished?(): boolean;
}

function parserFor(handlers: XmlHandlers): SaxesParser {
  const parser = new SaxesParser();
  if (handlers.onOpen) parser.on('opentag', handlers.onOpen);
  if (handlers.onText) parser.on('text', handlers.onText);
  if (handlers.onClose) parser.on('closetag', handlers.onClose);
  return parser;
}

/**
 * Unzips one entry as a stream and feeds it through saxes, the XML parser exceljs uses, chunk by
 * chunk; nothing but the handlers' own state is kept. Like exceljs, CDATA is ignored and the end of
 * the document is not checked for unclosed elements. Rejects with the first XML error, or with
 * whatever a handler throws, and stops unzipping at once.
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
