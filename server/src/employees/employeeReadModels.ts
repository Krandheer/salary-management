import type { CurrencyCode, EmployeeStatus, IsoDate } from '@acme/contracts';
import type { EmployeeFields } from './employeeValidation.ts';

/** A stored employee with the facts other modules judge it by; `fields.annualSalary` is the current salary. */
export interface StoredEmployee {
  id: number;
  status: EmployeeStatus;
  fields: EmployeeFields;
  currentCurrency: CurrencyCode;
  currentSalaryDate: IsoDate;
  earliestSalaryDate: IsoDate;
  exitDate: IsoDate | null;
}

/** One exported employee; the country is shown by name, as in the import template. */
export interface ExportRow {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryName: string;
  currency: string;
  annualSalary: number;
  employmentType: string;
  hireDate: string;
}
