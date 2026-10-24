import type { FieldErrors } from '@acme/contracts';
import { ApiError } from '@/api/http';

const EMAIL_TAKEN = 'EMAIL_TAKEN';

const SALARY_CHANGE_PREFIX = 'salaryChange.';

/** The edit request nests the salary change; the form calls the new salary `annualSalary` and the rest by their own names. */
function toFormFieldName(requestField: string): string {
  if (requestField === 'salaryChange.amount') return 'annualSalary';
  return requestField.startsWith(SALARY_CHANGE_PREFIX)
    ? requestField.slice(SALARY_CHANGE_PREFIX.length)
    : requestField;
}

function toFormFieldNames(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([name, message]) => [toFormFieldName(name), message]),
  );
}

/** The field errors a failed save should show next to the fields, or null for other failures. */
export function toFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError)) return null;
  if (error.fieldErrors) return toFormFieldNames(error.fieldErrors);
  if (error.code === EMAIL_TAKEN) return { email: error.message };
  return null;
}
