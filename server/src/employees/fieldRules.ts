import type { FieldErrors, IsoDate } from '@acme/contracts';
import { isIsoDate } from '../shared/dates.ts';
import { DEPARTMENTS, EMPLOYMENT_TYPES, findCountry } from '../reference/referenceData.ts';

/** The single-field rules every employee path shares; each returns an error message or null. */

const EARLIEST_HIRE_DATE: IsoDate = '1950-01-01';
const WELL_FORMED_EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const WHOLE_NUMBER_TEXT = /^-?\d+$/;

export function asTrimmedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return typeof value === 'string' && value.trim() === '';
}

/** Keeps only the fields that have a message. */
export function dropNullMessages(errorsByField: Record<string, string | null>): FieldErrors {
  return Object.fromEntries(
    Object.entries(errorsByField).filter((entry): entry is [string, string] => entry[1] !== null),
  );
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

export function validateEmail(value: unknown): string | null {
  if (isBlank(value)) return 'Work email is required';
  return WELL_FORMED_EMAIL.test(asTrimmedText(value))
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

/** A real date that is not in the future and not before the hire date; `label` names it in the message. */
function validateDateBetweenHireAndToday(
  value: unknown,
  label: string,
  context: { today: IsoDate; hireDate: IsoDate },
): string | null {
  if (!isIsoDate(value)) return `${label} must be a valid date`;
  if (value > context.today) return `${label} cannot be in the future`;
  if (value < context.hireDate) return `${label} cannot be before the hire date`;
  return null;
}

export function validateExitDate(
  value: unknown,
  context: { today: IsoDate; hireDate: IsoDate },
): string | null {
  return validateDateBetweenHireAndToday(value, 'Exit date', context);
}

export function validateEffectiveDate(
  value: unknown,
  context: { today: IsoDate; hireDate: IsoDate },
): string | null {
  return validateDateBetweenHireAndToday(value, 'Effective date', context);
}

/** A returning employee must start after the exit date of their most recent earlier record. */
export function validateRehireHireDate(
  hireDate: IsoDate,
  latestInactiveExitDate: IsoDate | null,
): string | null {
  if (latestInactiveExitDate === null || hireDate > latestInactiveExitDate) return null;
  return `Hire date must be after the previous exit date (${latestInactiveExitDate})`;
}

/** An existing employee's hire date can't move past their earliest salary history entry. */
export function validateHireDateAgainstHistory(
  hireDate: IsoDate,
  earliestSalaryDate: IsoDate,
): string | null {
  if (hireDate <= earliestSalaryDate) return null;
  return `Hire date cannot be later than the earliest salary entry (${earliestSalaryDate})`;
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
