import type { CountryCode, FieldErrors, IsoDate } from '@acme/contracts';
import { normalizeKey } from '../shared/text.ts';
import type { EmployeeFields } from './employeeFields.ts';
import {
  asTrimmedText,
  dropNullMessages,
  toWholeNumber,
  validateAnnualSalary,
  validateCountry,
  validateDepartment,
  validateEmail,
  validateEmploymentType,
  validateFullName,
  validateHireDate,
  validateJobTitle,
} from './fieldRules.ts';

export type EmployeeValidation =
  { ok: true; fields: EmployeeFields } | { ok: false; fieldErrors: FieldErrors };

function collectFieldErrors(input: Record<string, unknown>, today: IsoDate): FieldErrors {
  return dropNullMessages({
    fullName: validateFullName(input.fullName),
    email: validateEmail(input.email),
    jobTitle: validateJobTitle(input.jobTitle),
    department: validateDepartment(input.department),
    country: validateCountry(input.country),
    annualSalary: validateAnnualSalary(input.annualSalary, input.country),
    employmentType: validateEmploymentType(input.employmentType),
    hireDate: validateHireDate(input.hireDate, today),
  });
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
