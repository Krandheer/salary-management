import { describe, expect, it } from 'vitest';
import type { CurrencyCode } from '@acme/contracts';
import { toUsdRates } from '../reference/referenceData.ts';
import { averageInUsd } from './currencyConversion.ts';

function ratesWith(overrides: Partial<Record<CurrencyCode, number>>): Record<CurrencyCode, number> {
  return { ...toUsdRates(), ...overrides };
}

describe('averageInUsd', () => {
  it('converts each amount to US dollars before averaging', () => {
    const rates = ratesWith({ GBP: 2 });

    const average = averageInUsd(
      [
        { amount: 100, currency: 'GBP' },
        { amount: 300, currency: 'USD' },
      ],
      rates,
    );

    expect(average).toBe(250);
  });

  it('rounds the average once at the end, not each converted salary', () => {
    const rates = ratesWith({ GBP: 0.4 });

    const average = averageInUsd(
      [
        { amount: 1, currency: 'GBP' },
        { amount: 1, currency: 'GBP' },
        { amount: 1, currency: 'USD' },
      ],
      rates,
    );

    expect(average).toBe(1);
  });

  it('rounds a half-way average up to the whole dollar', () => {
    const rates = ratesWith({ GBP: 2 });

    const average = averageInUsd(
      [
        { amount: 1, currency: 'GBP' },
        { amount: 3, currency: 'USD' },
      ],
      rates,
    );

    expect(average).toBe(3);
  });

  it('returns the salary itself for a single US dollar employee', () => {
    expect(averageInUsd([{ amount: 85_000, currency: 'USD' }], toUsdRates())).toBe(85_000);
  });

  it('refuses to average an empty group', () => {
    expect(() => averageInUsd([], toUsdRates())).toThrow(RangeError);
  });
});
