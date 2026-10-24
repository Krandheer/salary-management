import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { MalformedXlsxError } from './malformedXlsxError.ts';
import { parseXmlEntry } from './xmlEntry.ts';

async function entryOf(xml: string): Promise<JSZip.JSZipObject> {
  const archive = await JSZip.loadAsync(
    await new JSZip().file('part.xml', xml).generateAsync({ type: 'nodebuffer' }),
  );
  return archive.file('part.xml')!;
}

/** Elements nested `depth` deep, the root included. */
function nested(depth: number): string {
  return '<a>'.repeat(depth) + '</a>'.repeat(depth);
}

function elementWithAttributes(count: number): string {
  const attributes = Array.from({ length: count }, (_, index) => ` a${index}="1"`).join('');
  return `<a${attributes}/>`;
}

async function parse(xml: string): Promise<string[]> {
  const opened: string[] = [];
  await parseXmlEntry(await entryOf(xml), { onOpen: (tag) => opened.push(tag.name) });
  return opened;
}

describe('parseXmlEntry: limits that keep a hostile part from exhausting memory', () => {
  it('reads elements nested 64 deep', async () => {
    await expect(parse(nested(64))).resolves.toHaveLength(64);
  });

  it('rejects elements nested 65 deep', async () => {
    await expect(parse(nested(65))).rejects.toBeInstanceOf(MalformedXlsxError);
  });

  it('does not count self-closing or already closed elements towards the depth', async () => {
    const xml = `<root>${'<a/>'.repeat(200)}${nested(63).repeat(3)}</root>`;

    await expect(parse(xml)).resolves.toHaveLength(1 + 200 + 63 * 3);
  });

  it('reads an element with 64 attributes', async () => {
    await expect(parse(`<root>${elementWithAttributes(64)}</root>`)).resolves.toEqual([
      'root',
      'a',
    ]);
  });

  it('rejects an element with 65 attributes', async () => {
    await expect(parse(`<root>${elementWithAttributes(65)}</root>`)).rejects.toBeInstanceOf(
      MalformedXlsxError,
    );
  });

  it('counts attributes per element, not across siblings', async () => {
    const xml = `<root>${elementWithAttributes(64).repeat(3)}</root>`;

    await expect(parse(xml)).resolves.toHaveLength(4);
  });

  it('still hands closing tags to the handlers', async () => {
    const closed: string[] = [];

    await parseXmlEntry(await entryOf('<root><a/><b></b></root>'), {
      onClose: (tag) => closed.push(tag.name),
    });

    expect(closed).toEqual(['a', 'b', 'root']);
  });
});
