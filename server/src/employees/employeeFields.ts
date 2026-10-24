import type { CountryCode, IsoDate } from '@acme/contracts';

/** An employee's fields after validation: trimmed, lower-cased email, and a numeric salary. */
export interface EmployeeFields {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: CountryCode;
  employmentType: string;
  hireDate: IsoDate;
  annualSalary: number;
}
