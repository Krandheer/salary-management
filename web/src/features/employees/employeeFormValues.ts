import type { CreateEmployeeRequest, EmployeeDetail, UpdateEmployeeRequest } from '@acme/contracts';

/** What the HR Manager has typed or chosen; every value is text and the server judges it. */
export interface EmployeeFormValues {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  annualSalary: string;
  employmentType: string;
  hireDate: string;
  /** Edit only: when the new salary takes effect. */
  effectiveDate: string;
  /** Edit only: why the salary changes. */
  reason: string;
}

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  fullName: '',
  email: '',
  jobTitle: '',
  department: '',
  country: '',
  annualSalary: '',
  employmentType: '',
  hireDate: '',
  effectiveDate: '',
  reason: '',
};

export function toCreateRequest(values: EmployeeFormValues): CreateEmployeeRequest {
  return {
    fullName: values.fullName,
    email: values.email,
    jobTitle: values.jobTitle,
    department: values.department,
    country: values.country,
    annualSalary: values.annualSalary,
    employmentType: values.employmentType,
    hireDate: values.hireDate,
  };
}

/**
 * The edit form starts from the stored values. The salary field holds a new amount, so it starts
 * empty, and the change takes effect today unless the date is moved.
 */
export function toEditFormValues(employee: EmployeeDetail, today: string): EmployeeFormValues {
  return {
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    country: employee.country,
    annualSalary: '',
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    effectiveDate: today,
    reason: '',
  };
}

const EDITABLE_TEXT_FIELDS = [
  'fullName',
  'email',
  'jobTitle',
  'department',
  'country',
  'employmentType',
  'hireDate',
] as const;

function toSalaryChange(
  values: EmployeeFormValues,
): NonNullable<UpdateEmployeeRequest['salaryChange']> {
  const change: NonNullable<UpdateEmployeeRequest['salaryChange']> = {
    amount: values.annualSalary,
  };
  if (values.effectiveDate !== '') change.effectiveDate = values.effectiveDate;
  if (values.reason !== '') change.reason = values.reason;
  return change;
}

/** Only the fields that differ from where the form started, plus the new salary when one is typed. */
export function toUpdateRequest(
  values: EmployeeFormValues,
  initial: EmployeeFormValues,
): UpdateEmployeeRequest {
  const changed = EDITABLE_TEXT_FIELDS.filter((name) => values[name] !== initial[name]);
  const request: UpdateEmployeeRequest = Object.fromEntries(
    changed.map((name) => [name, values[name]]),
  );
  if (values.annualSalary.trim() !== '') request.salaryChange = toSalaryChange(values);
  return request;
}
