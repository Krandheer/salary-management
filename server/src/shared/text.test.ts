import { describe, expect, it } from 'vitest';
import { normalizeKey, trimToNull } from './text.ts';

describe('normalizeKey', () => {
  it('trims surrounding spaces and lower-cases', () => {
    expect(normalizeKey('  Software ENGINEER ')).toBe('software engineer');
  });
});

describe('trimToNull', () => {
  it('trims a value', () => {
    expect(trimToNull('  Promotion ')).toBe('Promotion');
  });

  it.each([['   '], [''], [null], [undefined]])('turns %j into null', (value) => {
    expect(trimToNull(value)).toBeNull();
  });
});
