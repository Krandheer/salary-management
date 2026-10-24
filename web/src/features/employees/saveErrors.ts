import type { FieldErrors } from '@acme/contracts';
import { ApiError } from '@/api/http';

const EMAIL_TAKEN = 'EMAIL_TAKEN';

/** The edit request names the new salary `salaryChange.amount`; the form calls that field `annualSalary`. */
function toFormFieldNames(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([name, message]) => [
      name === 'salaryChange.amount' ? 'annualSalary' : name,
      message,
    ]),
  );
}

/** The field errors a failed save should show next to the fields, or null for other failures. */
export function toFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError)) return null;
  if (error.fieldErrors) return toFormFieldNames(error.fieldErrors);
  if (error.code === EMAIL_TAKEN) return { email: error.message };
  return null;
}
