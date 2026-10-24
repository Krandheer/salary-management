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

/** The row holding the column headers, in the template and in every export; data starts below it. */
export const HEADER_ROW_NUMBER = 1;

export const ALLOWED_VALUES_SHEET = 'Allowed values';

const HEADER_OF = Object.fromEntries(
  TEMPLATE_COLUMNS.map(({ key, header }) => [key, header]),
) as Record<TemplateField, string>;

/** An import message about one column, prefixed with that column's header. */
export function columnMessage(key: TemplateField, message: string): string {
  return `${HEADER_OF[key]}: ${message}`;
}
