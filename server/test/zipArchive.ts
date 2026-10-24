import JSZip from 'jszip';

const END_OF_CENTRAL_DIRECTORY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const CENTRAL_ENTRY_HEADER_BYTES = 46;

/** A deflated zip archive holding each named entry's bytes. */
export async function buildZip(entries: Record<string, Buffer>): Promise<Buffer> {
  const archive = new JSZip();
  for (const [name, content] of Object.entries(entries)) archive.file(name, content);
  return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * A copy of the archive whose central directory declares `sizeOf(index)` as each entry's
 * uncompressed size, leaving the compressed data as it was: a crafted, lying archive.
 */
export function withDeclaredUncompressedSizes(
  archive: Buffer,
  sizeOf: (entryIndex: number) => number,
): Buffer {
  const crafted = Buffer.from(archive);
  const endRecord = crafted.lastIndexOf(END_OF_CENTRAL_DIRECTORY);
  const entryCount = crafted.readUInt16LE(endRecord + 10);
  let entryOffset = crafted.readUInt32LE(endRecord + 16);
  for (let index = 0; index < entryCount; index += 1) {
    crafted.writeUInt32LE(sizeOf(index), entryOffset + 24);
    const variableBytes =
      crafted.readUInt16LE(entryOffset + 28) +
      crafted.readUInt16LE(entryOffset + 30) +
      crafted.readUInt16LE(entryOffset + 32);
    entryOffset += CENTRAL_ENTRY_HEADER_BYTES + variableBytes;
  }
  return crafted;
}

/** A copy of the archive with one text part (such as a sheet's XML) rewritten. */
export async function rewritePart(
  archive: Buffer,
  partName: string,
  rewrite: (xml: string) => string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(archive);
  const part = zip.file(partName);
  if (!part) throw new Error(`The archive has no part named ${partName}`);
  zip.file(partName, rewrite(await part.async('string')));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** The text of one part of the archive, such as a sheet's XML. */
export async function readPart(archive: Buffer, partName: string): Promise<string> {
  const part = (await JSZip.loadAsync(archive)).file(partName);
  if (!part) throw new Error(`The archive has no part named ${partName}`);
  return part.async('string');
}

/** A copy of the archive with `count` more empty entries, as a zip packed with junk parts would have. */
export async function withEmptyEntries(archive: Buffer, count: number): Promise<Buffer> {
  const zip = await JSZip.loadAsync(archive);
  for (let index = 0; index < count; index += 1) zip.file(`junk-${index}.bin`, '');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** How many entries, folders included, the archive holds. */
export async function entryCountOf(archive: Buffer): Promise<number> {
  return Object.keys((await JSZip.loadAsync(archive)).files).length;
}

/** A copy of the archive whose end record declares `count` entries, whatever it really holds. */
export function withDeclaredEntryCount(archive: Buffer, count: number): Buffer {
  const crafted = Buffer.from(archive);
  const endRecord = crafted.lastIndexOf(END_OF_CENTRAL_DIRECTORY);
  crafted.writeUInt16LE(count, endRecord + 8);
  crafted.writeUInt16LE(count, endRecord + 10);
  return crafted;
}
