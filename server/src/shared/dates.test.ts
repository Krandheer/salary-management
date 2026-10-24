import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isAfter, isIsoDate, isOnOrBefore } from './dates.ts';

describe('isIsoDate', () => {
  it.each(['2026-10-24', '2024-02-29', '1950-01-01'])('accepts the real date %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-1', '24/10/2026', '', ' 2026-10-24'])(
    'rejects the non-date %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it('rejects values that are not strings', () => {
    expect(isIsoDate(20261024)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('date comparison', () => {
  it('orders ISO dates chronologically', () => {
    expect(isAfter('2026-10-25', '2026-10-24')).toBe(true);
    expect(isAfter('2026-10-24', '2026-10-24')).toBe(false);
    expect(isOnOrBefore('2026-10-24', '2026-10-24')).toBe(true);
    expect(isOnOrBefore('2026-10-25', '2026-10-24')).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('adds days across month and leap-year boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-24', '2026-10-24')).toBe(0);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetween('2026-10-24', '2026-10-20')).toBe(-4);
  });
});
