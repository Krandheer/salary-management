const ENGLISH = 'en';

export function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, ENGLISH);
}

function countSpellings(spellings: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const spelling of spellings) {
    const trimmed = spelling.trim();
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  return counts;
}

/** Of the spellings of one job title, the most common (trimmed) one; ties go to the first A to Z. */
export function pickDisplayTitle(spellings: readonly string[]): string {
  const ranked = [...countSpellings(spellings)].sort(
    ([titleA, countA], [titleB, countB]) => countB - countA || compareTitles(titleA, titleB),
  );
  return ranked[0]?.[0] ?? '';
}
