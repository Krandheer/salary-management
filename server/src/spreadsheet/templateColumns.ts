export type TemplateField =
  | 'fullName'
  | 'email'
  | 'jobTitle'
  | 'department'
  | 'country'
  | 'currency'
  | 'annualSalary'
  | 'employmentType'
  | 'hireDate';

export interface TemplateColumn {
  header: string;
  key: TemplateField;
  width: number;
}

/** The one definition of the import/export columns: their headers, order and widths. */
export const TEMPLATE_COLUMNS: readonly TemplateColumn[] = [
  { header: 'Full Name', key: 'fullName', width: 26 },
  { header: 'Work Email', key: 'email', width: 34 },
  { header: 'Job Title', key: 'jobTitle', width: 28 },
  { header: 'Department', key: 'department', width: 20 },
  { header: 'Country', key: 'country', width: 18 },
  { header: 'Currency', key: 'currency', width: 10 },
  { header: 'Annual Salary', key: 'annualSalary', width: 16 },
  { header: 'Employment Type', key: 'employmentType', width: 18 },
  { header: 'Hire Date', key: 'hireDate', width: 12 },
];

export const ALLOWED_VALUES_SHEET = 'Allowed values';
