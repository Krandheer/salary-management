import type { CreateEmployeeRequest } from '@acme/contracts';

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
