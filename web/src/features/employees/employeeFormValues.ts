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
};

export function toCreateRequest(values: EmployeeFormValues): CreateEmployeeRequest {
  return { ...values };
}

/** The edit form starts from the stored values; the salary field holds a new amount, so it starts empty. */
export function toEditFormValues(employee: EmployeeDetail): EmployeeFormValues {
  return {
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    country: employee.country,
    annualSalary: '',
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
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

/** Only the fields that differ from where the form started, plus the new salary when one is typed. */
export function toUpdateRequest(
  values: EmployeeFormValues,
  initial: EmployeeFormValues,
): UpdateEmployeeRequest {
  const changed = EDITABLE_TEXT_FIELDS.filter((name) => values[name] !== initial[name]);
  const request: UpdateEmployeeRequest = Object.fromEntries(
    changed.map((name) => [name, values[name]]),
  );
  if (values.annualSalary.trim() !== '') request.salaryChange = { amount: values.annualSalary };
  return request;
}
