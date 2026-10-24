import type { EmployeeFields } from './employeeValidation.ts';
import { normalizeKey } from '../shared/text.ts';

/** The employee's own fields; the salary lives in the salary history, not on the employee row. */
export type EmployeeIdentityFields = Omit<EmployeeFields, 'annualSalary'>;

/** The `employees` columns an employee's fields fill, including the derived search keys. */
export function toEmployeeColumns(fields: EmployeeIdentityFields) {
  return {
    fullName: fields.fullName,
    nameKey: normalizeKey(fields.fullName),
    email: fields.email,
    jobTitle: fields.jobTitle,
    jobTitleKey: normalizeKey(fields.jobTitle),
    department: fields.department,
    countryCode: fields.countryCode,
    employmentType: fields.employmentType,
    hireDate: fields.hireDate,
  };
}
