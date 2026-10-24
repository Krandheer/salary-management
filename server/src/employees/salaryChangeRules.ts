import type { FieldErrors, IsoDate } from '@acme/contracts';
import { asRecord } from '../shared/records.ts';
import { trimToNull } from '../shared/text.ts';
import {
  dropNullMessages,
  isBlank,
  toWholeNumber,
  validateAnnualSalary,
  validateEffectiveDate,
} from './fieldRules.ts';

export const SALARY_CHANGE_AMOUNT = 'salaryChange.amount';
export const SALARY_CHANGE_DATE = 'salaryChange.effectiveDate';
const SALARY_CHANGE_REASON = 'salaryChange.reason';

/** A salary change that passed validation, ready to be recorded as a history entry. */
export interface ValidSalaryChange {
  amount: number;
  effectiveDate: IsoDate;
  reason: string | null;
}

export type SalaryChangeValidation =
  { ok: true; change: ValidSalaryChange } | { ok: false; fieldErrors: FieldErrors };

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
