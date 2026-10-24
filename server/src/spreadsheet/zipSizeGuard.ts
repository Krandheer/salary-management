import JSZip from 'jszip';

export interface ArchiveLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
}

/** The archive, loaded once and ready to read, or why it may not be read. */
export type ArchiveOpening =
  | { outcome: 'opened'; archive: JSZip }
  | { outcome: 'too-many-entries' | 'too-large' | 'unreadable' };

type UncompressedSizeCheck = 'within-limit' | 'too-large' | 'unreadable';

const CENTRAL_DIRECTORY_HEADER = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

/**
 * jszip keeps each entry's central-directory sizes on a private `_data` record; its typings
 * describe the shape in a comment but don't export it.
 */
interface EntryWithDeclaredSize {
  _data?: { uncompressedSize?: unknown };
}

/**
 * jszip reads 32-bit sizes as signed, so a declaration of 2 GB or more comes back negative;
 * that can only be too large. A missing size counts as zero: the streamed count still applies.
 */
function declaredSizeOf(entry: JSZip.JSZipObject): number {
  const declared = (entry as EntryWithDeclaredSize)._data?.uncompressedSize;
  if (typeof declared !== 'number') return 0;
  return declared < 0 ? Number.POSITIVE_INFINITY : declared;
}

/**
 * Unzips one entry chunk by chunk, keeping nothing, and stops as soon as it passes the budget.
 * Resolves to the bytes it unzipped, or null when the budget was passed.
 */
function inflatedBytesWithin(entry: JSZip.JSZipObject, budget: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const stream = entry.nodeStream('nodebuffer');
    let inflated = 0;
    const countChunk = (chunk: Buffer) => {
      inflated += chunk.length;
      if (inflated <= budget) return;
      stream.removeListener('data', countChunk);
      stream.pause();
      resolve(null);
    };
    stream.on('data', countChunk);
    stream.on('end', () => resolve(inflated));
    stream.on('error', reject);
  });
}

async function isInflatedTotalWithin(
  entries: readonly JSZip.JSZipObject[],
  maxBytes: number,
): Promise<boolean> {
  let remaining = maxBytes;
  for (const entry of entries) {
    const inflated = await inflatedBytesWithin(entry, remaining);
    if (inflated === null) return false;
    remaining -= inflated;
  }
  return true;
}

/**
 * Whether more entries than `limit` could be loaded, found without loading any. jszip reads one
 * central-directory header per entry, each starting with this signature, and keeps reading while
 * the signature repeats, whatever count the archive's end record declares; so the signature's
 * occurrences bound the entries it can load. Loading the directory is itself the cost to avoid:
 * jszip builds an object per entry, about 670 ms and 370 MB for 118,000 empty entries in 10 MB.
 */
function mayHoldMoreEntriesThan(content: Buffer, limit: number): boolean {
  let headers = 0;
  let at = content.indexOf(CENTRAL_DIRECTORY_HEADER);
  while (at !== -1) {
    headers += 1;
    if (headers > limit) return true;
    at = content.indexOf(CENTRAL_DIRECTORY_HEADER, at + CENTRAL_DIRECTORY_HEADER.length);
  }
  return false;
}

/**
 * Whether the entries unzip to no more than `maxBytes` in total. The sizes the archive declares
 * are checked first, without unzipping; then each entry is unzipped as a stream and counted, so an
 * archive that under-declares its sizes is still caught.
 */
async function checkUncompressedSize(
  entries: readonly JSZip.JSZipObject[],
  maxBytes: number,
): Promise<UncompressedSizeCheck> {
  const declaredTotal = entries.reduce((total, entry) => total + declaredSizeOf(entry), 0);
  if (declaredTotal > maxBytes) return 'too-large';
  try {
    return (await isInflatedTotalWithin(entries, maxBytes)) ? 'within-limit' : 'too-large';
  } catch {
    return 'unreadable';
  }
}

/**
 * Opens an upload as a zip archive, once, after checking it is safe to read: no more entries than
 * `maxEntries`, checked before jszip reads the central directory, and no more than
 * `maxUncompressedBytes` once unzipped, checked before any workbook parser holds a part in memory.
 * jszip is the zip reader exceljs itself uses, so both see the same entries.
 */
export async function openArchiveWithinLimits(
  content: Buffer,
  limits: ArchiveLimits,
): Promise<ArchiveOpening> {
  if (mayHoldMoreEntriesThan(content, limits.maxEntries)) return { outcome: 'too-many-entries' };
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(content);
  } catch {
    return { outcome: 'unreadable' };
  }
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  const sizeCheck = await checkUncompressedSize(entries, limits.maxUncompressedBytes);
  return sizeCheck === 'within-limit' ? { outcome: 'opened', archive } : { outcome: sizeCheck };
}
