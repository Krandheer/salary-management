import type {
  CountryCode,
  CountryReference,
  CurrencyCode,
  IsoDate,
  ReferenceData,
} from '@acme/contracts';

export function findCountryByName(_name: string): CountryReference | undefined {
  throw new Error('not implemented');
}

export function currencyFor(_code: CountryCode): CurrencyCode {
  throw new Error('not implemented');
}

export function toUsdRates(): Record<CurrencyCode, number> {
  throw new Error('not implemented');
}

export function buildReferenceData(_today: IsoDate): ReferenceData {
  throw new Error('not implemented');
}
