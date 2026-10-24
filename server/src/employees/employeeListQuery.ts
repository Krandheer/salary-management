import type { EmployeeStatus } from '@acme/contracts';
import { InvalidQueryError } from '../shared/errors.ts';

export interface EmployeeListQuery {
  page: number;
  status: EmployeeStatus;
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

/** Turns raw query-string values into a valid list query, or throws InvalidQueryError. */
export function parseEmployeeListQuery(raw: Record<string, unknown>): EmployeeListQuery {
  return { page: parsePage(raw.page), status: parseStatus(raw.status) };
}
