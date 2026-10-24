import { describe, expect, it } from 'vitest';
import { anImportRow, buildImportFile } from '../../test/importWorkbook.ts';
import { buildZip, withDeclaredUncompressedSizes } from '../../test/zipArchive.ts';
import { checkUncompressedSize } from './zipSizeGuard.ts';

const LIMIT = 1_000;

describe('checkUncompressedSize', () => {
  it('passes a real workbook that unzips to less than the limit', async () => {
    const workbook = await buildImportFile([anImportRow()]);

    await expect(checkUncompressedSize(workbook, 10 * 1024 * 1024)).resolves.toBe('within-limit');
  });

  it('passes entries that unzip to exactly the limit in total', async () => {
    const archive = await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(400) });

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('within-limit');
  });

  it('flags entries whose declared sizes add up to more than the limit, though each is under it', async () => {
    const archive = await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(401) });

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('too-large');
  });

  it('flags a crafted archive whose declared sizes exceed the limit', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(10) }),
      () => 0xf000_0000,
    );

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('too-large');
  });

  it('flags an entry that unzips past the limit while declaring a small size', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'bomb.xml': Buffer.alloc(50 * LIMIT) }),
      () => 10,
    );

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('too-large');
  });

  it('counts what earlier entries unzipped to when a later entry under-declares its size', async () => {
    const honestThenLying = (entryIndex: number) => (entryIndex === 0 ? 600 : 1);
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(600) }),
      honestThenLying,
    );

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('too-large');
  });

  it('reports bytes that are not a zip archive as unreadable', async () => {
    await expect(checkUncompressedSize(Buffer.from('name,email\nA,a@b.co'), LIMIT)).resolves.toBe(
      'unreadable',
    );
  });

  it('reports an entry that unzips to a different size than it declares as unreadable', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(500) }),
      () => 10,
    );

    await expect(checkUncompressedSize(archive, LIMIT)).resolves.toBe('unreadable');
  });
});
