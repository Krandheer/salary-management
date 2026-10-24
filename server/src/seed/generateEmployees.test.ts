import { beforeAll, describe, expect, it } from 'vitest';
import { generateSeedEmployees, salaryBandFor, type SeedEmployee } from './generateEmployees.ts';

const TODAY = '2026-10-24';
const OPTIONS = { count: 10_000, randomSeed: 20261024, today: TODAY };
const ALL_COUNTRIES = ['AU', 'CA', 'DE', 'GB', 'IN', 'JP', 'SG', 'US'];
const ALL_DEPARTMENTS = [
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
const COUNTRY_MAXIMUM: Record<string, number> = {
  AU: 75_000_000,
  CA: 70_000_000,
  DE: 45_000_000,
  IN: 4_000_000_000,
  JP: 7_500_000_000,
  SG: 65_000_000,
  GB: 40_000_000,
  US: 50_000_000,
};

describe('generateSeedEmployees', () => {
  let employees: SeedEmployee[];

  beforeAll(() => {
    employees = generateSeedEmployees(OPTIONS);
  });

  it('generates exactly the requested number of employees', () => {
    expect(employees).toHaveLength(10_000);
  });

  it('produces identical output for the same random seed', () => {
    expect(generateSeedEmployees(OPTIONS)).toEqual(employees);
  });

  it('produces different output for a different random seed', () => {
    const other = generateSeedEmployees({ ...OPTIONS, count: 50, randomSeed: 1 });

    expect(other.map((e) => e.fullName)).not.toEqual(employees.slice(0, 50).map((e) => e.fullName));
  });

  it('covers all 8 countries and all 10 departments', () => {
    expect([...new Set(employees.map((e) => e.countryCode))].sort()).toEqual(ALL_COUNTRIES);
    expect([...new Set(employees.map((e) => e.department))].sort()).toEqual(ALL_DEPARTMENTS);
  });

  it('covers every country and department even in a small set', () => {
    const small = generateSeedEmployees({ ...OPTIONS, count: 18 });

    expect(new Set(small.map((e) => e.countryCode)).size).toBe(8);
    expect(new Set(small.map((e) => e.department)).size).toBe(10);
  });

  it('gives every employee a unique email', () => {
    expect(new Set(employees.map((e) => e.email)).size).toBe(10_000);
  });

  it('gives every employee a non-empty name, title and a valid employment type', () => {
    for (const e of employees) {
      expect(e.fullName.trim()).not.toBe('');
      expect(e.jobTitle.trim()).not.toBe('');
      expect(['Full-time', 'Part-time', 'Contractor']).toContain(e.employmentType);
    }
  });

  it('keeps every hire date on or before today', () => {
    expect(employees.every((e) => e.hireDate <= TODAY)).toBe(true);
  });

  it('gives 1 to 4 salary history entries, the first on the hire date', () => {
    for (const e of employees) {
      expect(e.salaryHistory.length).toBeGreaterThanOrEqual(1);
      expect(e.salaryHistory.length).toBeLessThanOrEqual(4);
      expect(e.salaryHistory[0]?.effectiveDate).toBe(e.hireDate);
      expect(e.salaryHistory[0]?.reason).toBe('Starting salary');
    }
  });

  it('dates every history entry between the hire date and today, in order', () => {
    for (const e of employees) {
      const dates = e.salaryHistory.map((entry) => entry.effectiveDate);
      expect(dates.every((d) => d >= e.hireDate && d <= TODAY)).toBe(true);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it('keeps every salary within the band for its country and title and below the country maximum', () => {
    for (const e of employees) {
      const band = salaryBandFor(e.countryCode, e.jobTitle);
      for (const entry of e.salaryHistory) {
        expect(entry.amount).toBeGreaterThanOrEqual(band.min);
        expect(entry.amount).toBeLessThanOrEqual(band.max);
        expect(entry.amount).toBeLessThanOrEqual(COUNTRY_MAXIMUM[e.countryCode] ?? 0);
        expect(Number.isInteger(entry.amount)).toBe(true);
      }
    }
  });
});

describe('salaryBandFor', () => {
  it('rounds band edges to the nearest 100 in local currency', () => {
    const band = salaryBandFor('IN', 'Software Engineer');

    expect(band.min % 100).toBe(0);
    expect(band.max % 100).toBe(0);
    expect(band.min).toBeLessThan(band.max);
  });

  it('scales a band by the country pay factor and currency, so India is far above USD figures', () => {
    expect(salaryBandFor('IN', 'Software Engineer').min).toBeGreaterThan(
      salaryBandFor('US', 'Software Engineer').min,
    );
  });
});
