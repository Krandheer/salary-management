import type { IsoDate } from '@acme/contracts';
import type { EmployeeFields } from '../employees/employeeValidation.ts';
import type { RawImportRow } from './workbookReader.ts';

export type ImportRowOutcome =
  { ok: true; fields: EmployeeFields } | { ok: false; messages: string[] };

export interface ParsedImportRow {
  rowNumber: number;
  email: string | null;
  outcome: ImportRowOutcome;
}

export function parseImportRow(_raw: RawImportRow, _today: IsoDate): ParsedImportRow {
  throw new Error('Not implemented');
}
