import type { CountryReference, IsoDate } from '@acme/contracts';
import { validateEmployeeFields, type EmployeeFields } from '../employees/employeeValidation.ts';
import { DEPARTMENTS, EMPLOYMENT_TYPES, findCountryByName } from '../reference/referenceData.ts';
import { normalizeKey } from '../shared/text.ts';
import { columnMessage, TEMPLATE_COLUMNS, type TemplateField } from './templateColumns.ts';
import type { RawCellValue, RawImportRow } from './workbookReader.ts';

export type ImportRowOutcome =
  { ok: true; fields: EmployeeFields } | { ok: false; messages: string[] };

export interface ParsedImportRow {
  rowNumber: number;
  /** The row's email, trimmed and lower-cased, or null when the cell is empty. */
  email: string | null;
  outcome: ImportRowOutcome;
}

type RowCells = Record<TemplateField, RawCellValue>;

/** Problems by template field; apart from `currency`, the keys are the shared validators' field names. */
type RowProblems = Partial<Record<TemplateField, string>>;

function cellsByField(raw: RawImportRow): RowCells {
  return Object.fromEntries(
    TEMPLATE_COLUMNS.map(({ key }, index) => [key, raw.cells[index] ?? null]),
  ) as RowCells;
}

function toIsoDateText(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

function toText(value: RawCellValue): string | null {
  if (value === null) return null;
  if (value instanceof Date) return toIsoDateText(value);
  return String(value);
}

/** A date cell becomes YYYY-MM-DD; anything else is left for the shared hire-date rule to judge. */
function toIsoDate(value: RawCellValue): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : toIsoDateText(value);
  return typeof value === 'string' ? value.trim() : value;
}

/** The canonical spelling of a reference value typed in any letter case, or the text as typed. */
function toCanonical(text: string | null, allowed: readonly string[]): string | null {
  if (text === null) return null;
  return allowed.find((option) => normalizeKey(option) === normalizeKey(text)) ?? text;
}

/**
 * The country code for the shared rule. Cells hold country names, so a name that matched
 * nothing is passed lower-cased: it can never equal a code (such as "US"), and the shared
 * rule reports it as not one of the listed options.
 */
function toCountryInput(value: RawCellValue, country: CountryReference | undefined): unknown {
  return country?.code ?? toText(value)?.toLowerCase() ?? null;
}

function toRowEmail(value: RawCellValue): string | null {
  const email = normalizeKey(toText(value) ?? '');
  return email === '' ? null : email;
}

function toEmployeeInput(
  cells: RowCells,
  country: CountryReference | undefined,
): Record<string, unknown> {
  return {
    fullName: toText(cells.fullName),
    email: toText(cells.email),
    jobTitle: toText(cells.jobTitle),
    department: toCanonical(toText(cells.department), DEPARTMENTS),
    country: toCountryInput(cells.country, country),
    annualSalary: cells.annualSalary,
    employmentType: toCanonical(toText(cells.employmentType), EMPLOYMENT_TYPES),
    hireDate: toIsoDate(cells.hireDate),
  };
}

/** The Currency column must be the country's currency; it is only judged once the country is known. */
function findCurrencyProblem(
  value: RawCellValue,
  country: CountryReference | undefined,
): string | null {
  if (!country || normalizeKey(toText(value) ?? '') === normalizeKey(country.currency)) return null;
  return `Currency must be ${country.currency} for ${country.name}`;
}

function toColumnMessages(problems: RowProblems): string[] {
  return TEMPLATE_COLUMNS.flatMap(({ key }) => {
    const problem = problems[key];
    return problem ? [columnMessage(key, problem)] : [];
  });
}

/**
 * Turns one spreadsheet row into employee fields using the shared validation rules, or into
 * every problem found, each prefixed with its column header.
 */
export function parseImportRow(raw: RawImportRow, today: IsoDate): ParsedImportRow {
  const cells = cellsByField(raw);
  const country = findCountryByName(toText(cells.country) ?? '');
  const validation = validateEmployeeFields(toEmployeeInput(cells, country), { today });
  const currencyProblem = findCurrencyProblem(cells.currency, country);
  const messages = toColumnMessages({
    ...(validation.ok ? {} : validation.fieldErrors),
    ...(currencyProblem ? { currency: currencyProblem } : {}),
  });
  const email = toRowEmail(cells.email);
  if (validation.ok && messages.length === 0) {
    return { rowNumber: raw.rowNumber, email, outcome: { ok: true, fields: validation.fields } };
  }
  return { rowNumber: raw.rowNumber, email, outcome: { ok: false, messages } };
}
