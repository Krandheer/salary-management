import type { CountryCode, FieldErrors, IsoDate } from '@acme/contracts';
import { isIsoDate } from '../shared/dates.ts';
import { DEPARTMENTS, EMPLOYMENT_TYPES, findCountry } from '../reference/referenceData.ts';
import { normalizeKey, trimToNull } from '../shared/text.ts';

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

/** A salary change that passed validation, ready to be recorded as a history entry. */
export interface ValidSalaryChange {
  amount: number;
  effectiveDate: IsoDate;
  reason: string | null;
}

export type SalaryChangeValidation =
  { ok: true; change: ValidSalaryChange } | { ok: false; fieldErrors: FieldErrors };

export type EmployeeUpdateValidation =
  | { ok: true; fields: EmployeeFields; salaryChange: ValidSalaryChange | null }
  | { ok: false; fieldErrors: FieldErrors };

const SALARY_CHANGE_AMOUNT = 'salaryChange.amount';
const SALARY_CHANGE_DATE = 'salaryChange.effectiveDate';
const SALARY_CHANGE_REASON = 'salaryChange.reason';
const EDITABLE_FIELDS = [
  'fullName',
  'email',
  'jobTitle',
  'department',
  'country',
  'employmentType',
  'hireDate',
] as const;

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

/** An exit date is a real date between the hire date and today. */
export function validateExitDate(
  value: unknown,
  context: { today: IsoDate; hireDate: IsoDate },
): string | null {
  if (!isIsoDate(value)) return 'Exit date must be a valid date';
  if (value > context.today) return 'Exit date cannot be in the future';
  if (value < context.hireDate) return 'Exit date cannot be before the hire date';
  return null;
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

function dropNullMessages(errorsByField: Record<string, string | null>): FieldErrors {
  return Object.fromEntries(
    Object.entries(errorsByField).filter((entry): entry is [string, string] => entry[1] !== null),
  );
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
  return dropNullMessages(errorsByField);
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

function currentAsInput(current: EmployeeFields): Record<string, unknown> {
  const { countryCode, ...others } = current;
  return { ...others, country: countryCode };
}

function pickEditableFields(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    EDITABLE_FIELDS.filter((name) => patch[name] !== undefined).map((name) => [name, patch[name]]),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function validateEffectiveDate(
  date: unknown,
  context: { today: IsoDate; hireDate: IsoDate },
): string | null {
  if (!isIsoDate(date)) return 'Effective date must be a valid date';
  if (date > context.today) return 'Effective date cannot be in the future';
  if (date < context.hireDate) return 'Effective date cannot be before the hire date';
  return null;
}

function validateReason(reason: unknown): string | null {
  const isText = reason === undefined || reason === null || typeof reason === 'string';
  return isText ? null : 'Reason must be text';
}

/**
 * Checks a salary change: the amount like any salary, an effective date that defaults to
 * today and sits between the hire date and today, and an optional reason (blank means none).
 */
export function validateSalaryChange(
  input: unknown,
  context: { today: IsoDate; hireDate: IsoDate; countryCode: string },
): SalaryChangeValidation {
  const proposal = asRecord(input);
  const effectiveDate = isBlank(proposal.effectiveDate) ? context.today : proposal.effectiveDate;
  const fieldErrors = dropNullMessages({
    [SALARY_CHANGE_AMOUNT]: validateAnnualSalary(proposal.amount, context.countryCode),
    [SALARY_CHANGE_DATE]: validateEffectiveDate(effectiveDate, context),
    [SALARY_CHANGE_REASON]: validateReason(proposal.reason),
  });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    change: {
      amount: toWholeNumber(proposal.amount) as number,
      effectiveDate: effectiveDate as IsoDate,
      reason: trimToNull(proposal.reason as string | null | undefined),
    },
  };
}

function collectEditOnlyErrors(
  current: EmployeeFields,
  merged: Record<string, unknown>,
  fieldErrors: FieldErrors,
  isSalaryProposed: boolean,
  context: { earliestSalaryDate: IsoDate },
): FieldErrors {
  const errors: FieldErrors = {};
  if (
    !isSalaryProposed &&
    !fieldErrors.country &&
    asTrimmedText(merged.country) !== current.countryCode
  ) {
    errors[SALARY_CHANGE_AMOUNT] = 'Enter a new salary when the country changes';
  }
  const hireDate = merged.hireDate;
  const historyError =
    !fieldErrors.hireDate && typeof hireDate === 'string'
      ? validateHireDateAgainstHistory(hireDate, context.earliestSalaryDate)
      : null;
  if (historyError) errors.hireDate = historyError;
  return errors;
}

/** The stored salary is not re-judged on an edit, so its error (if any) is not reported. */
function withoutStoredSalaryError(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([name]) => name !== 'annualSalary'),
  );
}

/**
 * Merges the patch onto the stored employee and re-applies the shared field rules, plus the
 * edit-only rules: a country change needs a new salary, and the hire date cannot move past
 * the earliest salary history entry. The salary change is judged by `validateSalaryChange`
 * against the hire date and country being saved; the stored salary is never re-judged.
 */
export function validateEmployeeUpdate(
  current: EmployeeFields,
  patch: Record<string, unknown>,
  context: { today: IsoDate; earliestSalaryDate: IsoDate },
): EmployeeUpdateValidation {
  const merged = { ...currentAsInput(current), ...pickEditableFields(patch) };
  const isSalaryProposed = patch.salaryChange !== undefined && patch.salaryChange !== null;
  const salaryChange = isSalaryProposed
    ? validateSalaryChange(patch.salaryChange, {
        today: context.today,
        hireDate: isIsoDate(merged.hireDate) ? merged.hireDate : current.hireDate,
        countryCode: asTrimmedText(merged.country),
      })
    : null;
  const newAmount = salaryChange?.ok ? salaryChange.change.amount : current.annualSalary;
  const validation = validateEmployeeFields(
    { ...merged, annualSalary: newAmount },
    { today: context.today },
  );
  const fieldRuleErrors = validation.ok ? {} : withoutStoredSalaryError(validation.fieldErrors);
  const fieldErrors = {
    ...fieldRuleErrors,
    ...(salaryChange?.ok === false ? salaryChange.fieldErrors : {}),
    ...collectEditOnlyErrors(current, merged, fieldRuleErrors, isSalaryProposed, context),
  };

  if (!validation.ok || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    fields: validation.fields,
    salaryChange: salaryChange?.ok ? salaryChange.change : null,
  };
}
