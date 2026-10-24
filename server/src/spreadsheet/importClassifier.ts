import type { CurrencyCode, ImportFieldChange, ImportPreview, IsoDate } from '@acme/contracts';
import type { EmployeeFields } from '../employees/employeeValidation.ts';
import type { ParsedImportRow } from './importRowParser.ts';

/** A stored employee as the import compares it; `fields.annualSalary` is the current salary. */
export interface ExistingEmployee {
  id: number;
  fields: EmployeeFields;
  currentCurrency: CurrencyCode;
  earliestSalaryDate: IsoDate;
  exitDate: IsoDate | null;
}

export interface ImportMatch {
  active: ExistingEmployee | null;
  latestInactive: ExistingEmployee | null;
}

/** The stored employees by lower-cased email. */
export type ImportSnapshot = Map<string, ImportMatch>;

export type ImportOperation =
  | { kind: 'create'; fields: EmployeeFields; rehireOf: number | null }
  | {
      kind: 'update';
      employeeId: number;
      fields: EmployeeFields;
      salaryChange: { amount: number; currency: CurrencyCode } | null;
    };

export interface ImportPlan {
  preview: ImportPreview;
  operations: ImportOperation[];
}

export function diffFields(
  _existing: ExistingEmployee,
  _incoming: EmployeeFields,
): ImportFieldChange[] {
  throw new Error('Not implemented');
}

export function classifyImportRows(
  _rows: ParsedImportRow[],
  _existing: ImportSnapshot,
): ImportPlan {
  throw new Error('Not implemented');
}
