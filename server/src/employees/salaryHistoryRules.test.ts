import { describe, expect, it } from 'vitest';
import { isNewHistoryEntryNeeded } from './salaryHistoryRules.ts';

const stored = { annualSalary: 90_000, countryCode: 'US' } as const;

describe('isNewHistoryEntryNeeded', () => {
  it('is not needed when the amount and the country are both unchanged', () => {
    expect(isNewHistoryEntryNeeded(stored, { ...stored })).toBe(false);
  });

  it('is needed when the amount changed', () => {
    expect(isNewHistoryEntryNeeded(stored, { ...stored, annualSalary: 95_000 })).toBe(true);
  });

  it('is needed when only the country changed', () => {
    expect(isNewHistoryEntryNeeded(stored, { ...stored, countryCode: 'GB' })).toBe(true);
  });
});
