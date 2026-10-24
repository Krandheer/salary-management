import type { CountryCode, IsoDate } from '@acme/contracts';

export interface SeedSalaryEntry {
  amount: number;
  effectiveDate: IsoDate;
  reason: string;
}

export interface SeedEmployee {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: CountryCode;
  employmentType: string;
  hireDate: IsoDate;
  salaryHistory: SeedSalaryEntry[];
}

export interface SeedOptions {
  count: number;
  randomSeed: number;
  today: IsoDate;
}

export function generateSeedEmployees(_options: SeedOptions): SeedEmployee[] {
  throw new Error('not implemented');
}

export function salaryBandFor(
  _countryCode: CountryCode,
  _title: string,
): { min: number; max: number } {
  throw new Error('not implemented');
}
