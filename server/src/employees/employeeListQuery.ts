import type { CountryCode, EmployeeStatus } from '@acme/contracts';
import { DEPARTMENTS, findCountry } from '../reference/referenceData.ts';
import { InvalidQueryError } from '../shared/errors.ts';
import { normalizeKey } from '../shared/text.ts';

/** Which employees are in view: the status plus the optional search text and filters. */
export interface EmployeeFilters {
  status: EmployeeStatus;
  searchKey: string | null;
  country: CountryCode | null;
  department: string | null;
  jobTitleKey: string | null;
}

export interface EmployeeListQuery extends EmployeeFilters {
  page: number;
}

const FIRST_PAGE = 1;
const DIGITS_ONLY = /^\d+$/;

function parsePage(raw: unknown): number {
  if (raw === undefined) return FIRST_PAGE;
  const page = typeof raw === 'string' && DIGITS_ONLY.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(page) || page < FIRST_PAGE) {
    throw new InvalidQueryError('page must be a positive whole number');
  }
  return page;
}

function parseStatus(raw: unknown): EmployeeStatus {
  if (raw === undefined) return 'active';
  if (raw === 'active' || raw === 'inactive') return raw;
  throw new InvalidQueryError('status must be "active" or "inactive"');
}

function parseKey(raw: unknown, name: string): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== 'string') throw new InvalidQueryError(`${name} must be given once`);
  return normalizeKey(raw) || null;
}

function parseCountry(raw: unknown): CountryCode | null {
  if (raw === undefined) return null;
  const country = typeof raw === 'string' ? findCountry(raw) : undefined;
  if (!country) throw new InvalidQueryError('country must be a known country code');
  return country.code;
}

function parseDepartment(raw: unknown): string | null {
  if (raw === undefined) return null;
  const department = DEPARTMENTS.find((known) => known === raw);
  if (!department) throw new InvalidQueryError('department must be a known department');
  return department;
}

/** Turns raw query-string values into the status, search and filters, or throws InvalidQueryError. */
export function parseEmployeeFilters(raw: Record<string, unknown>): EmployeeFilters {
  return {
    status: parseStatus(raw.status),
    searchKey: parseKey(raw.search, 'search'),
    country: parseCountry(raw.country),
    department: parseDepartment(raw.department),
    jobTitleKey: parseKey(raw.jobTitle, 'jobTitle'),
  };
}

/** Turns raw query-string values into a valid list query, or throws InvalidQueryError. */
export function parseEmployeeListQuery(raw: Record<string, unknown>): EmployeeListQuery {
  return { ...parseEmployeeFilters(raw), page: parsePage(raw.page) };
}
