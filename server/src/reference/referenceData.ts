import type {
  CountryCode,
  CountryReference,
  CurrencyCode,
  IsoDate,
  ReferenceData,
} from '@acme/contracts';

export const COUNTRIES: readonly CountryReference[] = [
  { code: 'AU', name: 'Australia', currency: 'AUD', maxAnnualSalary: 75_000_000 },
  { code: 'CA', name: 'Canada', currency: 'CAD', maxAnnualSalary: 70_000_000 },
  { code: 'DE', name: 'Germany', currency: 'EUR', maxAnnualSalary: 45_000_000 },
  { code: 'IN', name: 'India', currency: 'INR', maxAnnualSalary: 4_000_000_000 },
  { code: 'JP', name: 'Japan', currency: 'JPY', maxAnnualSalary: 7_500_000_000 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', maxAnnualSalary: 65_000_000 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', maxAnnualSalary: 40_000_000 },
  { code: 'US', name: 'United States', currency: 'USD', maxAnnualSalary: 50_000_000 },
];

export const DEPARTMENTS: readonly string[] = [
  'Customer Support',
  'Design',
  'Engineering',
  'Finance',
  'Human Resources',
  'Legal',
  'Marketing',
  'Operations',
  'Product',
  'Sales',
];

export const EMPLOYMENT_TYPES: readonly string[] = ['Full-time', 'Part-time', 'Contractor'];

/** ECB euro reference rates: units of each currency per 1 EUR. */
export const ECB_RATES_PER_EUR: Readonly<Record<CurrencyCode, number>> = {
  EUR: 1,
  USD: 1.1193,
  JPY: 175.51,
  GBP: 0.83728,
  INR: 106.272,
  CAD: 1.5665,
  AUD: 1.5939,
  SGD: 1.431,
};

export const RATES_AS_OF: IsoDate = '2026-10-23';
export const RATES_SOURCE = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export function findCountry(code: string): CountryReference | undefined {
  return COUNTRIES.find((country) => country.code === code);
}

export function requireCountry(code: string): CountryReference {
  const country = findCountry(code);
  if (!country) throw new Error(`Unknown country code: ${code}`);
  return country;
}

export function findCountryByName(name: string): CountryReference | undefined {
  const wanted = name.trim().toLowerCase();
  return COUNTRIES.find((country) => country.name.toLowerCase() === wanted);
}

export function currencyFor(code: CountryCode): CurrencyCode {
  return requireCountry(code).currency;
}

export function toUsdRates(): Record<CurrencyCode, number> {
  const usdPerEur = ECB_RATES_PER_EUR.USD;
  const entries = Object.entries(ECB_RATES_PER_EUR).map(
    ([currency, perEur]) => [currency, usdPerEur / perEur] as const,
  );
  return Object.fromEntries(entries) as Record<CurrencyCode, number>;
}

export function buildReferenceData(today: IsoDate): ReferenceData {
  return {
    countries: COUNTRIES.map((country) => ({ ...country })),
    departments: [...DEPARTMENTS],
    employmentTypes: [...EMPLOYMENT_TYPES],
    exchangeRates: { asOf: RATES_AS_OF, source: RATES_SOURCE, toUsd: toUsdRates() },
    today,
  };
}
