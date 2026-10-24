import JSZip from 'jszip';

export type UncompressedSizeCheck = 'within-limit' | 'too-large' | 'unreadable';

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
 * Whether the archive's entries unzip to no more than `maxBytes` in total, checked before any
 * workbook parser holds them in memory. The sizes the archive declares are checked first, without
 * unzipping; then each entry is unzipped as a stream and counted, so an archive that under-declares
 * its sizes is still caught. jszip is the zip reader exceljs itself uses, so both see the same entries.
 */
export async function checkUncompressedSize(
  content: Buffer,
  maxBytes: number,
): Promise<UncompressedSizeCheck> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(content);
  } catch {
    return 'unreadable';
  }
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  const declaredTotal = entries.reduce((total, entry) => total + declaredSizeOf(entry), 0);
  if (declaredTotal > maxBytes) return 'too-large';
  try {
    return (await isInflatedTotalWithin(entries, maxBytes)) ? 'within-limit' : 'too-large';
  } catch {
    return 'unreadable';
  }
}
