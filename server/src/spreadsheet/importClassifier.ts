import type {
  CountryCode,
  CurrencyCode,
  ImportCreate,
  ImportFieldChange,
  ImportPreview,
  ImportRowError,
  ImportUpdate,
  IsoDate,
} from '@acme/contracts';
import {
  validateHireDateAgainstHistory,
  validateRehireHireDate,
  type EmployeeFields,
} from '../employees/employeeValidation.ts';
import { isNewHistoryEntryNeeded } from '../employees/salaryHistoryRules.ts';
import { currencyFor, findCountry } from '../reference/referenceData.ts';
import { normalizeKey } from '../shared/text.ts';
import type { ParsedImportRow } from './importRowParser.ts';
import { columnMessage, TEMPLATE_COLUMNS, type TemplateField } from './templateColumns.ts';

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
  /** Every inactive record with the email, most recent exit first. */
  inactive: ExistingEmployee[];
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

type RowClassification =
  | { kind: 'create'; create: ImportCreate; operation: ImportOperation }
  | { kind: 'update'; update: ImportUpdate; operation: ImportOperation }
  | { kind: 'unchanged' }
  | { kind: 'error'; error: ImportRowError };

const DUPLICATE_EMAIL = columnMessage('email', 'Duplicate email in file');
const UNCHANGED: RowClassification = { kind: 'unchanged' };

function countryNameOf(code: CountryCode): string {
  return findCountry(code)?.name ?? code;
}

/** How each template column shows an employee's value; salary and dates as plain text. */
const SHOWN_VALUE_OF: Record<TemplateField, (fields: EmployeeFields, currency: string) => string> =
  {
    fullName: (fields) => fields.fullName,
    email: (fields) => fields.email,
    jobTitle: (fields) => fields.jobTitle,
    department: (fields) => fields.department,
    country: (fields) => countryNameOf(fields.countryCode),
    currency: (_fields, currency) => currency,
    annualSalary: (fields) => String(fields.annualSalary),
    employmentType: (fields) => fields.employmentType,
    hireDate: (fields) => fields.hireDate,
  };

/** Every template column whose value would change, in column order. */
export function diffFields(
  existing: ExistingEmployee,
  incoming: EmployeeFields,
): ImportFieldChange[] {
  const incomingCurrency = currencyFor(incoming.countryCode);
  return TEMPLATE_COLUMNS.flatMap(({ header, key }) => {
    const from = SHOWN_VALUE_OF[key](existing.fields, existing.currentCurrency);
    const to = SHOWN_VALUE_OF[key](incoming, incomingCurrency);
    return from === to ? [] : [{ field: header, from, to }];
  });
}

function findDuplicateEmails(rows: readonly ParsedImportRow[]): Set<string> {
  const rowsPerEmail = new Map<string, number>();
  for (const { email } of rows) {
    if (email !== null) {
      const key = normalizeKey(email);
      rowsPerEmail.set(key, (rowsPerEmail.get(key) ?? 0) + 1);
    }
  }
  return new Set([...rowsPerEmail].filter(([, count]) => count > 1).map(([email]) => email));
}

function anError(row: ParsedImportRow, messages: string[]): RowClassification {
  const email = row.email === null ? null : normalizeKey(row.email);
  return { kind: 'error', error: { row: row.rowNumber, email, messages } };
}

function aCreate(
  rowNumber: number,
  fields: EmployeeFields,
  rehireOf: number | null,
): RowClassification {
  const email = normalizeKey(fields.email);
  return {
    kind: 'create',
    create: { row: rowNumber, email, rehireOf },
    operation: { kind: 'create', fields: { ...fields, email }, rehireOf },
  };
}

function plannedSalaryChange(active: ExistingEmployee, incoming: EmployeeFields) {
  if (!isNewHistoryEntryNeeded(active.fields, incoming)) return null;
  return { amount: incoming.annualSalary, currency: currencyFor(incoming.countryCode) };
}

/** A changed hire date must still come after the exit date of the person's latest earlier record. */
function hireDateProblems(
  incoming: EmployeeFields,
  active: ExistingEmployee,
  latestInactive: ExistingEmployee | null,
): string[] {
  const isHireDateChanged = incoming.hireDate !== active.fields.hireDate;
  const problems = [
    validateHireDateAgainstHistory(incoming.hireDate, active.earliestSalaryDate),
    isHireDateChanged
      ? validateRehireHireDate(incoming.hireDate, latestInactive?.exitDate ?? null)
      : null,
  ];
  return problems.flatMap((problem) => (problem ? [columnMessage('hireDate', problem)] : []));
}

function classifyAgainstActive(
  row: ParsedImportRow,
  incoming: EmployeeFields,
  active: ExistingEmployee,
  latestInactive: ExistingEmployee | null,
): RowClassification {
  const problems = hireDateProblems(incoming, active, latestInactive);
  if (problems.length > 0) return anError(row, problems);
  const email = active.fields.email;
  return {
    kind: 'update',
    update: { row: row.rowNumber, email, changes: diffFields(active, incoming) },
    operation: {
      kind: 'update',
      employeeId: active.id,
      fields: { ...incoming, email },
      salaryChange: plannedSalaryChange(active, incoming),
    },
  };
}

/** Inactive records are never changed: a row that differs is either a rehire or an error. */
function classifyAgainstInactive(
  row: ParsedImportRow,
  incoming: EmployeeFields,
  inactive: ExistingEmployee,
): RowClassification {
  if (validateRehireHireDate(incoming.hireDate, inactive.exitDate) === null) {
    return aCreate(row.rowNumber, incoming, inactive.id);
  }
  const explanation =
    `Employee #${inactive.id} is inactive and can't be changed; ` +
    `a rehire needs a hire date after their exit date (${inactive.exitDate})`;
  return anError(row, [columnMessage('email', explanation)]);
}

/**
 * A row equal to any stored record with its email changes nothing, so an export of active or
 * inactive employees re-imports cleanly even when a person left and came back.
 */
function isIdenticalToAnyRecord(match: ImportMatch, incoming: EmployeeFields): boolean {
  const records = match.active ? [match.active, ...match.inactive] : match.inactive;
  return records.some((record) => diffFields(record, incoming).length === 0);
}

function classifyRow(
  row: ParsedImportRow,
  existing: ImportSnapshot,
  duplicateEmails: ReadonlySet<string>,
): RowClassification {
  const isDuplicate = row.email !== null && duplicateEmails.has(normalizeKey(row.email));
  const parseMessages = row.outcome.ok ? [] : row.outcome.messages;
  if (!row.outcome.ok || isDuplicate) {
    return anError(row, isDuplicate ? [...parseMessages, DUPLICATE_EMAIL] : parseMessages);
  }
  const incoming = row.outcome.fields;
  const match = existing.get(normalizeKey(incoming.email));
  if (!match) return aCreate(row.rowNumber, incoming, null);
  if (isIdenticalToAnyRecord(match, incoming)) return UNCHANGED;
  const latestInactive = match.inactive[0] ?? null;
  if (match.active) return classifyAgainstActive(row, incoming, match.active, latestInactive);
  if (latestInactive) return classifyAgainstInactive(row, incoming, latestInactive);
  return aCreate(row.rowNumber, incoming, null);
}

function assemblePlan(classifications: readonly RowClassification[]): ImportPlan {
  const preview: ImportPreview = {
    totals: { create: 0, update: 0, unchanged: 0, error: 0 },
    creates: [],
    updates: [],
    errors: [],
  };
  const operations: ImportOperation[] = [];
  for (const classification of classifications) {
    preview.totals[classification.kind] += 1;
    if (classification.kind === 'create') preview.creates.push(classification.create);
    if (classification.kind === 'update') preview.updates.push(classification.update);
    if (classification.kind === 'error') preview.errors.push(classification.error);
    if ('operation' in classification) operations.push(classification.operation);
  }
  return { preview, operations };
}

/**
 * Decides what importing each row would do, against a snapshot of the stored employees.
 * A row equal to any stored record with its email is unchanged; otherwise it matches the active
 * employee by email, else the most recent inactive one. An email on more than one row is an error.
 */
export function classifyImportRows(
  rows: readonly ParsedImportRow[],
  existing: ImportSnapshot,
): ImportPlan {
  const duplicateEmails = findDuplicateEmails(rows);
  const inRowOrder = [...rows].sort((a, b) => a.rowNumber - b.rowNumber);
  return assemblePlan(inRowOrder.map((row) => classifyRow(row, existing, duplicateEmails)));
}
