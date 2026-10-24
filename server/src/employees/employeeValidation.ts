import type { CountryCode, FieldErrors, IsoDate } from '@acme/contracts';
import { isIsoDate } from '../shared/dates.ts';
import { DEPARTMENTS, EMPLOYMENT_TYPES, findCountry } from '../reference/referenceData.ts';
import { normalizeKey } from '../shared/text.ts';

/** The earliest hire date the app accepts. */
export const EARLIEST_HIRE_DATE: IsoDate = '1950-01-01';

/** An employee's fields after validation: trimmed, lower-cased email, and a numeric salary. */
export interface EmployeeFields {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: CountryCode;
  employmentType: string;
  hireDate: IsoDate;
  annualSalary: number;
}

export type EmployeeValidation =
  { ok: true; fields: EmployeeFields } | { ok: false; fieldErrors: FieldErrors };

const WELL_FORMED_EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const WHOLE_NUMBER_TEXT = /^-?\d+$/;

function asTrimmedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return typeof value === 'string' && value.trim() === '';
}

function validateRequiredText(value: unknown, label: string): string | null {
  return isBlank(value) ? `${label} is required` : null;
}

function validateOneOf(value: unknown, label: string, allowed: readonly string[]): string | null {
  if (isBlank(value)) return `${label} is required`;
  return allowed.includes(asTrimmedText(value))
    ? null
    : `${label} must be one of the listed options`;
}

export function validateFullName(value: unknown): string | null {
  return validateRequiredText(value, 'Full name');
}

export function isWellFormedEmail(value: string): boolean {
  return WELL_FORMED_EMAIL.test(value);
}

export function validateEmail(value: unknown): string | null {
  if (isBlank(value)) return 'Work email is required';
  return isWellFormedEmail(asTrimmedText(value))
    ? null
    : 'Work email must look like name@company.com';
}

export function validateJobTitle(value: unknown): string | null {
  return validateRequiredText(value, 'Job title');
}

export function validateDepartment(value: unknown): string | null {
  return validateOneOf(value, 'Department', DEPARTMENTS);
}

export function validateCountry(value: unknown): string | null {
  if (isBlank(value)) return 'Country is required';
  return findCountry(asTrimmedText(value)) ? null : 'Country must be one of the listed options';
}

export function validateEmploymentType(value: unknown): string | null {
  return validateOneOf(value, 'Employment type', EMPLOYMENT_TYPES);
}

export function validateHireDate(value: unknown, today: IsoDate): string | null {
  if (isBlank(value)) return 'Hire date is required';
  if (!isIsoDate(value)) return 'Hire date must be a valid date';
  if (value < EARLIEST_HIRE_DATE) return `Hire date cannot be before ${EARLIEST_HIRE_DATE}`;
  if (value > today) return 'Hire date cannot be in the future';
  return null;
}

/** The integer a salary input stands for, or null when it is not a whole number. */
export function toWholeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!WHOLE_NUMBER_TEXT.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function validateAnnualSalary(value: unknown, countryCode: unknown): string | null {
  if (isBlank(value)) return 'Annual salary is required';
  const amount = toWholeNumber(value);
  if (amount === null) return 'Annual salary must be a whole number';
  if (amount <= 0) return 'Annual salary must be greater than zero';
  const country = typeof countryCode === 'string' ? findCountry(countryCode.trim()) : undefined;
  if (country && amount > country.maxAnnualSalary) {
    return `Annual salary cannot be more than ${country.maxAnnualSalary.toLocaleString('en-US')}`;
  }
  return null;
}

function collectFieldErrors(input: Record<string, unknown>, today: IsoDate): FieldErrors {
  const errorsByField: Record<string, string | null> = {
    fullName: validateFullName(input.fullName),
    email: validateEmail(input.email),
    jobTitle: validateJobTitle(input.jobTitle),
    department: validateDepartment(input.department),
    country: validateCountry(input.country),
    annualSalary: validateAnnualSalary(input.annualSalary, input.country),
    employmentType: validateEmploymentType(input.employmentType),
    hireDate: validateHireDate(input.hireDate, today),
  };
  return Object.fromEntries(
    Object.entries(errorsByField).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

function normaliseFields(input: Record<string, unknown>): EmployeeFields {
  return {
    fullName: asTrimmedText(input.fullName),
    email: normalizeKey(asTrimmedText(input.email)),
    jobTitle: asTrimmedText(input.jobTitle),
    department: asTrimmedText(input.department),
    countryCode: asTrimmedText(input.country) as CountryCode,
    employmentType: asTrimmedText(input.employmentType),
    hireDate: input.hireDate as IsoDate,
    annualSalary: toWholeNumber(input.annualSalary) as number,
  };
}

/** Checks every rule and reports all failures at once; valid input comes back normalised. */
export function validateEmployeeFields(
  input: Record<string, unknown>,
  context: { today: IsoDate },
): EmployeeValidation {
  const fieldErrors = collectFieldErrors(input, context.today);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, fields: normaliseFields(input) };
}
