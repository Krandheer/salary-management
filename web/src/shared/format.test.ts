import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatSalary } from './format';

describe('formatSalary', () => {
  it.each([
    [85_000, 'USD', 'USD 85,000'],
    [1_850_000, 'INR', 'INR 1,850,000'],
    [9_500_000, 'JPY', 'JPY 9,500,000'],
    [0, 'EUR', 'EUR 0'],
  ] as const)('formats %i %s as %s', (amount, currency, expected) => {
    expect(formatSalary(amount, currency)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('shows an ISO date as it is', () => {
    expect(formatDate('2026-10-24')).toBe('2026-10-24');
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1,000'],
    [20_001, '20,001'],
  ])('formats %i as %s', (count, expected) => {
    expect(formatCount(count)).toBe(expected);
  });
});
