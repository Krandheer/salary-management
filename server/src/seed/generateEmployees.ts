import {
  fakerEN,
  fakerEN_AU,
  fakerEN_CA,
  fakerEN_GB,
  fakerEN_IN,
  fakerEN_US,
  fakerDE,
  fakerJA,
  Faker,
  base,
  en,
} from '@faker-js/faker';
import type { CountryCode, IsoDate } from '@acme/contracts';
import {
  COUNTRIES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  currencyFor,
  toUsdRates,
} from '../reference/referenceData.ts';
import { addDays, daysBetween } from '../shared/dates.ts';
import {
  COUNTRY_PAY_FACTORS,
  COUNTRY_WEIGHTS,
  JOB_CATALOGUE,
  type JobProfile,
} from './seedCatalogue.ts';

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

const NAME_FAKERS: Readonly<Record<CountryCode, Faker>> = {
  US: fakerEN_US,
  GB: fakerEN_GB,
  DE: fakerDE,
  IN: fakerEN_IN,
  JP: fakerJA,
  CA: fakerEN_CA,
  AU: fakerEN_AU,
  SG: fakerEN,
};

const COUNTRY_CODES = COUNTRIES.map((country) => country.code);
const GUARANTEED_COVERAGE_COUNT = 18;
const MAX_HIRE_AGE_DAYS = 15 * 365;
const MAX_HISTORY_ENTRIES = 4;
const MIN_RAISE = 0.03;
const MAX_RAISE = 0.12;
const SALARY_ROUNDING = 100;
const EMAIL_DOMAIN = 'acme.example';
const STARTING_SALARY_REASON = 'Starting salary';
const RAISE_REASONS = ['Annual review', 'Promotion'] as const;

const ALL_PROFILES: readonly { department: string; profile: JobProfile }[] = Object.entries(
  JOB_CATALOGUE,
).flatMap(([department, profiles]) => profiles.map((profile) => ({ department, profile })));

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function findProfile(title: string): JobProfile {
  const match = ALL_PROFILES.find(({ profile }) => profile.title === title);
  if (!match) throw new Error(`Unknown job title in seed catalogue: ${title}`);
  return match.profile;
}

export function salaryBandFor(
  countryCode: CountryCode,
  title: string,
): { min: number; max: number } {
  const profile = findProfile(title);
  const localPerUsd = COUNTRY_PAY_FACTORS[countryCode] / toUsdRates()[currencyFor(countryCode)];
  return {
    min: roundToNearest(profile.usdMin * localPerUsd, SALARY_ROUNDING),
    max: roundToNearest(profile.usdMax * localPerUsd, SALARY_ROUNDING),
  };
}

function pickCountry(index: number, random: Faker): CountryCode {
  if (index < GUARANTEED_COVERAGE_COUNT) return COUNTRY_CODES[index % COUNTRY_CODES.length]!;
  let remaining = random.number.float({ min: 0, max: 1 });
  for (const code of COUNTRY_CODES) {
    remaining -= COUNTRY_WEIGHTS[code];
    if (remaining < 0) return code;
  }
  return COUNTRY_CODES[COUNTRY_CODES.length - 1]!;
}

function pickDepartment(index: number, random: Faker): string {
  if (index < GUARANTEED_COVERAGE_COUNT) return DEPARTMENTS[index % DEPARTMENTS.length]!;
  return random.helpers.arrayElement(DEPARTMENTS);
}

function toSlug(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildEmail(firstName: string, lastName: string, employeeNumber: number): string {
  const first = toSlug(firstName);
  const last = toSlug(lastName);
  const localPart =
    first && last ? `${first}.${last}.${employeeNumber}` : `employee.${employeeNumber}`;
  return `${localPart}@${EMAIL_DOMAIN}`;
}

function pickRaiseDates(
  hireDate: IsoDate,
  today: IsoDate,
  wanted: number,
  random: Faker,
): IsoDate[] {
  const span = daysBetween(hireDate, today);
  const count = Math.min(wanted, span);
  return Array.from({ length: count }, (_, i) => {
    const first = Math.floor((span * i) / count) + 1;
    const last = Math.floor((span * (i + 1)) / count);
    return addDays(hireDate, random.number.int({ min: first, max: last }));
  });
}

function buildSalaryHistory(
  countryCode: CountryCode,
  title: string,
  hireDate: IsoDate,
  today: IsoDate,
  random: Faker,
): SeedSalaryEntry[] {
  const band = salaryBandFor(countryCode, title);
  const lowerHalfCeiling = (band.min + band.max) / 2;
  let amount = roundToNearest(
    random.number.float({ min: band.min, max: lowerHalfCeiling }),
    SALARY_ROUNDING,
  );
  const history: SeedSalaryEntry[] = [
    { amount, effectiveDate: hireDate, reason: STARTING_SALARY_REASON },
  ];
  const wantedRaises = random.number.int({ min: 0, max: MAX_HISTORY_ENTRIES - 1 });
  for (const effectiveDate of pickRaiseDates(hireDate, today, wantedRaises, random)) {
    const raise = random.number.float({ min: MIN_RAISE, max: MAX_RAISE });
    amount = Math.min(band.max, roundToNearest(amount * (1 + raise), SALARY_ROUNDING));
    history.push({ amount, effectiveDate, reason: random.helpers.arrayElement(RAISE_REASONS) });
  }
  return history;
}

function seedNameFakers(randomSeed: number): void {
  COUNTRY_CODES.forEach((code, offset) => NAME_FAKERS[code].seed(randomSeed + offset + 1));
}

function generateEmployee(index: number, options: SeedOptions, random: Faker): SeedEmployee {
  const countryCode = pickCountry(index, random);
  const department = pickDepartment(index, random);
  const profile = random.helpers.arrayElement(JOB_CATALOGUE[department] ?? []);
  const nameSource = NAME_FAKERS[countryCode];
  const firstName = nameSource.person.firstName();
  const lastName = nameSource.person.lastName();
  const hireDate = addDays(options.today, -random.number.int({ min: 0, max: MAX_HIRE_AGE_DAYS }));
  return {
    fullName: `${firstName} ${lastName}`,
    email: buildEmail(firstName, lastName, index + 1),
    jobTitle: profile.title,
    department,
    countryCode,
    employmentType: random.helpers.arrayElement(EMPLOYMENT_TYPES),
    hireDate,
    salaryHistory: buildSalaryHistory(countryCode, profile.title, hireDate, options.today, random),
  };
}

export function generateSeedEmployees(options: SeedOptions): SeedEmployee[] {
  seedNameFakers(options.randomSeed);
  const random = new Faker({ locale: [en, base] });
  random.seed(options.randomSeed);
  return Array.from({ length: options.count }, (_, index) =>
    generateEmployee(index, options, random),
  );
}
