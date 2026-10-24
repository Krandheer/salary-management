import { describe, expect, it } from 'vitest';
import type { CountryCode, CurrencyCode } from '@acme/contracts';
import { buildReferenceData, currencyFor, findCountryByName, toUsdRates } from './referenceData.ts';

describe('currencyFor', () => {
  const expected: [CountryCode, CurrencyCode][] = [
    ['AU', 'AUD'],
    ['CA', 'CAD'],
    ['DE', 'EUR'],
    ['IN', 'INR'],
    ['JP', 'JPY'],
    ['SG', 'SGD'],
    ['GB', 'GBP'],
    ['US', 'USD'],
  ];

  it.each(expected)('maps %s to its currency %s', (country, currency) => {
    expect(currencyFor(country)).toBe(currency);
  });
});

describe('findCountryByName', () => {
  it('matches a country name ignoring letter case and surrounding spaces', () => {
    expect(findCountryByName(' india ')?.code).toBe('IN');
  });

  it('returns undefined for an unknown country name', () => {
    expect(findCountryByName('Atlantis')).toBeUndefined();
  });
});

describe('toUsdRates', () => {
  it('values USD at exactly 1 and EUR at the ECB USD-per-EUR rate', () => {
    const rates = toUsdRates();
    expect(rates.USD).toBe(1);
    expect(rates.EUR).toBe(1.1193);
  });

  it('derives GBP as USD-per-EUR divided by GBP-per-EUR', () => {
    expect(toUsdRates().GBP).toBeCloseTo(1.336829, 6);
  });

  it('derives the other currencies from the ECB reference rates', () => {
    const rates = toUsdRates();
    expect(rates.CAD).toBeCloseTo(0.714523, 6);
    expect(rates.AUD).toBeCloseTo(0.70224, 6);
    expect(rates.SGD).toBeCloseTo(0.78218, 6);
    expect(rates.INR).toBeCloseTo(0.010532, 6);
    expect(rates.JPY).toBeCloseTo(0.006377, 6);
  });
});

describe('buildReferenceData', () => {
  it('carries the supplied date as today', () => {
    expect(buildReferenceData('2026-10-24').today).toBe('2026-10-24');
  });
});
