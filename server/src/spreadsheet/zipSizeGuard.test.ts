import { describe, expect, it } from 'vitest';
import { anImportRow, buildImportFile } from '../../test/importWorkbook.ts';
import {
  buildZip,
  entryCountOf,
  withDeclaredEntryCount,
  withDeclaredUncompressedSizes,
  withEmptyEntries,
} from '../../test/zipArchive.ts';
import { type ArchiveLimits, openArchiveWithinLimits } from './zipSizeGuard.ts';

const LIMIT = 1_000;
const MAX_ENTRIES = 20;

async function outcomeOf(content: Buffer, limits: Partial<ArchiveLimits> = {}): Promise<string> {
  const opened = await openArchiveWithinLimits(content, {
    maxEntries: MAX_ENTRIES,
    maxUncompressedBytes: LIMIT,
    ...limits,
  });
  return opened.outcome;
}

describe('openArchiveWithinLimits: the uncompressed size', () => {
  it('opens a real workbook that unzips to less than the limit, its parts ready to read', async () => {
    const workbook = await buildImportFile([anImportRow()]);

    const opened = await openArchiveWithinLimits(workbook, {
      maxEntries: MAX_ENTRIES,
      maxUncompressedBytes: 10 * 1024 * 1024,
    });

    expect(opened.outcome).toBe('opened');
    if (opened.outcome !== 'opened') return;
    await expect(opened.archive.file('xl/workbook.xml')!.async('string')).resolves.toContain(
      '<workbook',
    );
  });

  it('opens entries that unzip to exactly the limit in total', async () => {
    const archive = await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(400) });

    await expect(outcomeOf(archive)).resolves.toBe('opened');
  });

  it('flags entries whose declared sizes add up to more than the limit, though each is under it', async () => {
    const archive = await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(401) });

    await expect(outcomeOf(archive)).resolves.toBe('too-large');
  });

  it('flags a crafted archive whose declared sizes exceed the limit', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(10) }),
      () => 0xf000_0000,
    );

    await expect(outcomeOf(archive)).resolves.toBe('too-large');
  });

  it('flags an entry that unzips past the limit while declaring a small size', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'bomb.xml': Buffer.alloc(50 * LIMIT) }),
      () => 10,
    );

    await expect(outcomeOf(archive)).resolves.toBe('too-large');
  });

  it('counts what earlier entries unzipped to when a later entry under-declares its size', async () => {
    const honestThenLying = (entryIndex: number) => (entryIndex === 0 ? 600 : 1);
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(600), 'b.xml': Buffer.alloc(600) }),
      honestThenLying,
    );

    await expect(outcomeOf(archive)).resolves.toBe('too-large');
  });

  it('reports bytes that are not a zip archive as unreadable', async () => {
    await expect(outcomeOf(Buffer.from('name,email\nA,a@b.co'))).resolves.toBe('unreadable');
  });

  it('reports an entry that unzips to a different size than it declares as unreadable', async () => {
    const archive = withDeclaredUncompressedSizes(
      await buildZip({ 'a.xml': Buffer.alloc(500) }),
      () => 10,
    );

    await expect(outcomeOf(archive)).resolves.toBe('unreadable');
  });
});

describe('openArchiveWithinLimits: the number of entries', () => {
  it('opens an archive of exactly the maximum number of entries', async () => {
    const workbook = await buildImportFile([anImportRow()]);
    const atTheLimit = await withEmptyEntries(
      workbook,
      MAX_ENTRIES - (await entryCountOf(workbook)),
    );

    await expect(outcomeOf(atTheLimit, { maxUncompressedBytes: 1024 * 1024 })).resolves.toBe(
      'opened',
    );
  });

  it('flags an archive of one entry more than the maximum', async () => {
    const workbook = await buildImportFile([anImportRow()]);
    const overTheLimit = await withEmptyEntries(
      workbook,
      MAX_ENTRIES + 1 - (await entryCountOf(workbook)),
    );

    await expect(outcomeOf(overTheLimit, { maxUncompressedBytes: 1024 * 1024 })).resolves.toBe(
      'too-many-entries',
    );
  });

  it('counts the entries an archive holds, not the number its end record declares', async () => {
    const underDeclared = withDeclaredEntryCount(
      await buildZip(
        Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${i}.xml`, Buffer.alloc(1)])),
      ),
      1,
    );

    await expect(outcomeOf(underDeclared)).resolves.toBe('too-many-entries');
  });
});
