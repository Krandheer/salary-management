import type { FieldErrors, IsoDate } from '@acme/contracts';
import { isIsoDate } from '../shared/dates.ts';
import type { EmployeeFields } from './employeeFields.ts';
import { asTrimmedText, validateHireDateAgainstHistory } from './fieldRules.ts';
import { validateEmployeeFields } from './newEmployeeRules.ts';
import {
  SALARY_CHANGE_AMOUNT,
  SALARY_CHANGE_DATE,
  validateSalaryChange,
  type SalaryChangeValidation,
  type ValidSalaryChange,
} from './salaryChangeRules.ts';

export type EmployeeUpdateValidation =
  | { ok: true; fields: EmployeeFields; salaryChange: ValidSalaryChange | null }
  | { ok: false; fieldErrors: FieldErrors };

/** The stored facts the edit-only rules judge against. */
interface EditContext {
  earliestSalaryDate: IsoDate;
  currentSalaryDate: IsoDate;
}

const EDITABLE_FIELDS = [
  'fullName',
  'email',
  'jobTitle',
  'department',
  'country',
  'employmentType',
  'hireDate',
] as const;

function currentAsInput(current: EmployeeFields): Record<string, unknown> {
  const { countryCode, ...others } = current;
  return { ...others, country: countryCode };
}

function pickEditableFields(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    EDITABLE_FIELDS.filter((name) => patch[name] !== undefined).map((name) => [name, patch[name]]),
  );
}

/** The patch laid over the stored employee, in the shape the field rules take. */
function mergePatch(
  current: EmployeeFields,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...currentAsInput(current), ...pickEditableFields(patch) };
}

/** The proposed salary change judged against the hire date and country being saved, or null when none is proposed. */
function validateProposedSalaryChange(
  current: EmployeeFields,
  merged: Record<string, unknown>,
  patch: Record<string, unknown>,
  today: IsoDate,
): SalaryChangeValidation | null {
  if (patch.salaryChange === undefined || patch.salaryChange === null) return null;
  return validateSalaryChange(patch.salaryChange, {
    today,
    hireDate: isIsoDate(merged.hireDate) ? merged.hireDate : current.hireDate,
    countryCode: asTrimmedText(merged.country),
  });
}

/**
 * A change dated before the current salary would not become current, leaving the current
 * salary in the old country's currency; so a country change must start on or after it.
 */
function validateCountryChangeDate(
  effectiveDate: IsoDate,
  currentSalaryDate: IsoDate,
): string | null {
  if (effectiveDate >= currentSalaryDate) return null;
  return `When the country changes, the effective date can't be before the current salary's (${currentSalaryDate})`;
}

function collectCountryChangeErrors(
  salaryChange: SalaryChangeValidation | null,
  context: EditContext,
): FieldErrors {
  if (salaryChange === null) {
    return { [SALARY_CHANGE_AMOUNT]: 'Enter a new salary when the country changes' };
  }
  if (!salaryChange.ok) return {};
  const dateError = validateCountryChangeDate(
    salaryChange.change.effectiveDate,
    context.currentSalaryDate,
  );
  return dateError ? { [SALARY_CHANGE_DATE]: dateError } : {};
}

function collectEditOnlyErrors(
  current: EmployeeFields,
  merged: Record<string, unknown>,
  fieldErrors: FieldErrors,
  salaryChange: SalaryChangeValidation | null,
  context: EditContext,
): FieldErrors {
  const isCountryChanged =
    !fieldErrors.country && asTrimmedText(merged.country) !== current.countryCode;
  const hireDate = merged.hireDate;
  const historyError =
    !fieldErrors.hireDate && typeof hireDate === 'string'
      ? validateHireDateAgainstHistory(hireDate, context.earliestSalaryDate)
      : null;
  return {
    ...(isCountryChanged ? collectCountryChangeErrors(salaryChange, context) : {}),
    ...(historyError ? { hireDate: historyError } : {}),
  };
}

/** The stored salary is not re-judged on an edit, so its error (if any) is not reported. */
function withoutStoredSalaryError(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([name]) => name !== 'annualSalary'),
  );
}

/**
 * Merges the patch onto the stored employee and re-applies the shared field rules, plus the
 * edit-only rules: a country change needs a new salary dated no earlier than the current
 * salary, and the hire date cannot move past the earliest salary history entry. The salary
 * change is judged by `validateSalaryChange` against the hire date and country being saved;
 * the stored salary is never re-judged.
 */
export function validateEmployeeUpdate(
  current: EmployeeFields,
  patch: Record<string, unknown>,
  context: EditContext & { today: IsoDate },
): EmployeeUpdateValidation {
  const merged = mergePatch(current, patch);
  const salaryChange = validateProposedSalaryChange(current, merged, patch, context.today);
  const newAmount = salaryChange?.ok ? salaryChange.change.amount : current.annualSalary;
  const validation = validateEmployeeFields(
    { ...merged, annualSalary: newAmount },
    { today: context.today },
  );
  const fieldRuleErrors = validation.ok ? {} : withoutStoredSalaryError(validation.fieldErrors);
  const fieldErrors = {
    ...fieldRuleErrors,
    ...(salaryChange?.ok === false ? salaryChange.fieldErrors : {}),
    ...collectEditOnlyErrors(current, merged, fieldRuleErrors, salaryChange, context),
  };

  if (!validation.ok || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    fields: validation.fields,
    salaryChange: salaryChange?.ok ? salaryChange.change : null,
  };
}
