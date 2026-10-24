import { and, asc, count, desc, eq, min, ne, sql, type SQL } from 'drizzle-orm';
import type {
  CountryCode,
  CurrencyCode,
  EmployeeDetail,
  EmployeeListPage,
  EmployeeStatus,
  EmployeeSummary,
  IsoDate,
  LinkedEmployment,
  SalaryHistoryEntry,
} from '@acme/contracts';
import type { AppDatabase } from '../db/database.ts';
import { currentSalaries, employees, salaryHistory, type EmployeeRow } from '../db/schema.ts';
import { currencyFor, findCountry } from '../reference/referenceData.ts';
import { normalizeKey } from '../shared/text.ts';
import { toEmployeeColumns } from './employeeColumns.ts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';
import type { ExportRow, StoredEmployee } from './employeeReadModels.ts';
import type { EmployeeFields } from './employeeValidation.ts';
import { STARTING_SALARY_REASON } from './salaryHistoryRules.ts';

/** The current salary is the first row in this order; the `current_salaries` view uses the same rule. */
export const SALARY_HISTORY_ORDER = [desc(salaryHistory.effectiveDate), desc(salaryHistory.id)];

/** The list's order, shared with the export: name A to Z, then id. */
const EMPLOYEE_LIST_ORDER = [asc(employees.nameKey), asc(employees.id)];

interface EmployeeSummaryRow {
  id: number;
  fullName: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  status: EmployeeStatus;
  exitDate: string | null;
  currentSalary: number;
  currency: string;
}

export function toEmployeeSummary(row: EmployeeSummaryRow): EmployeeSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    department: row.department,
    country: row.countryCode as CountryCode,
    currency: row.currency as CurrencyCode,
    currentSalary: row.currentSalary,
    status: row.status,
    exitDate: row.exitDate,
  };
}

/** The WHERE condition for the employees in view; every value is a bound parameter. */
function buildFilterConditions(filters: EmployeeFilters): SQL | undefined {
  const { status, searchKey, country, department, jobTitleKey } = filters;
  return and(
    eq(employees.status, status),
    searchKey ? sql`instr(${employees.nameKey}, ${searchKey}) > 0` : undefined,
    country ? eq(employees.countryCode, country) : undefined,
    department ? eq(employees.department, department) : undefined,
    jobTitleKey ? eq(employees.jobTitleKey, jobTitleKey) : undefined,
  );
}

/** One active employee's current salary, the shared input of every insight. */
export interface ActiveSalaryRow {
  countryCode: CountryCode;
  department: string;
  jobTitle: string;
  jobTitleKey: string;
  amount: number;
  currency: CurrencyCode;
}

/** What an edit starts from: the stored fields and the facts the edit rules need. */
export interface EditableState {
  fields: EmployeeFields;
  status: EmployeeStatus;
  earliestSalaryDate: IsoDate;
  currentSalaryDate: IsoDate;
}

export interface SalaryEntryInput {
  amount: number;
  currency: CurrencyCode;
  effectiveDate: IsoDate;
  reason: string | null;
}

function toEmployeeFields(employee: EmployeeRow, currentSalary: number): EmployeeFields {
  return {
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    countryCode: employee.countryCode as CountryCode,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    annualSalary: currentSalary,
  };
}

interface StoredEmployeeQueryRow {
  employee: EmployeeRow;
  currentSalary: number;
  currentCurrency: string;
  currentSalaryDate: IsoDate;
  earliestSalaryDate: IsoDate | null;
}

function toStoredEmployee(row: StoredEmployeeQueryRow): StoredEmployee {
  return {
    id: row.employee.id,
    status: row.employee.status,
    fields: toEmployeeFields(row.employee, row.currentSalary),
    currentCurrency: row.currentCurrency as CurrencyCode,
    currentSalaryDate: row.currentSalaryDate,
    earliestSalaryDate: row.earliestSalaryDate ?? row.employee.hireDate,
    exitDate: row.employee.exitDate,
  };
}

const LINK_COLUMNS = {
  id: employees.id,
  hireDate: employees.hireDate,
  exitDate: employees.exitDate,
  status: employees.status,
};

export class EmployeeRepository {
  constructor(private readonly db: AppDatabase) {}

  listPage(query: EmployeeListQuery, pageSize: number): EmployeeListPage {
    const isInView = buildFilterConditions(query);
    const total = this.countEmployees(isInView);
    const items = this.db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        jobTitle: employees.jobTitle,
        department: employees.department,
        countryCode: employees.countryCode,
        status: employees.status,
        exitDate: employees.exitDate,
        currentSalary: currentSalaries.amount,
        currency: currentSalaries.currency,
      })
      .from(employees)
      .innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))
      .where(isInView)
      .orderBy(...EMPLOYEE_LIST_ORDER)
      .limit(pageSize)
      .offset((query.page - 1) * pageSize)
      .all()
      .map(toEmployeeSummary);

    return {
      items,
      page: query.page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Every employee in view with the current salary, in the list's order and without paging. */
  listForExport(filters: EmployeeFilters): ExportRow[] {
    return this.db
      .select({
        fullName: employees.fullName,
        email: employees.email,
        jobTitle: employees.jobTitle,
        department: employees.department,
        countryCode: employees.countryCode,
        currency: currentSalaries.currency,
        annualSalary: currentSalaries.amount,
        employmentType: employees.employmentType,
        hireDate: employees.hireDate,
      })
      .from(employees)
      .innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))
      .where(buildFilterConditions(filters))
      .orderBy(...EMPLOYEE_LIST_ORDER)
      .all()
      .map(({ countryCode, ...row }) => ({
        ...row,
        countryName: findCountry(countryCode)?.name ?? countryCode,
      }));
  }

  /** One row per employee in view, ignoring the job title filter, so the job title choices stay complete. */
  listJobTitleSpellings(filters: EmployeeFilters): { jobTitleKey: string; jobTitle: string }[] {
    return this.db
      .select({ jobTitleKey: employees.jobTitleKey, jobTitle: employees.jobTitle })
      .from(employees)
      .where(buildFilterConditions({ ...filters, jobTitleKey: null }))
      .all();
  }

  /** The current salary of every active employee, in one query. */
  listActiveCurrentSalaries(): ActiveSalaryRow[] {
    return this.db
      .select({
        countryCode: employees.countryCode,
        department: employees.department,
        jobTitle: employees.jobTitle,
        jobTitleKey: employees.jobTitleKey,
        amount: currentSalaries.amount,
        currency: currentSalaries.currency,
      })
      .from(employees)
      .innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))
      .where(eq(employees.status, 'active'))
      .all() as ActiveSalaryRow[];
  }

  /** The id of the active employee with this email (already lower-cased), if any; `excludeId` skips that employee. */
  findActiveIdByEmail(email: string, excludeId?: number): number | null {
    const row = this.db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.email, normalizeKey(email)),
          eq(employees.status, 'active'),
          excludeId === undefined ? undefined : ne(employees.id, excludeId),
        ),
      )
      .get();
    return row?.id ?? null;
  }

  /** The inactive employees with this email (already lower-cased), most recent exit first. */
  findInactiveByEmail(email: string): LinkedEmployment[] {
    return this.db
      .select(LINK_COLUMNS)
      .from(employees)
      .where(and(eq(employees.email, normalizeKey(email)), eq(employees.status, 'inactive')))
      .orderBy(desc(employees.exitDate), desc(employees.id))
      .all();
  }

  /** Every other employment record with this email, newest hire first. */
  listLinkedEmployments(email: string, excludedId: number): LinkedEmployment[] {
    return this.db
      .select(LINK_COLUMNS)
      .from(employees)
      .where(and(eq(employees.email, normalizeKey(email)), ne(employees.id, excludedId)))
      .orderBy(desc(employees.hireDate), desc(employees.id))
      .all();
  }

  /** Marks the employee inactive with the exit date. There is no way back. */
  deactivate(id: number, exitDate: IsoDate): void {
    this.db
      .update(employees)
      .set({ status: 'inactive', exitDate })
      .where(eq(employees.id, id))
      .run();
  }

  /** Runs the work as one transaction; a throw undoes every write made inside it. */
  inTransaction<T>(work: () => T): T {
    return this.db.transaction(work);
  }

  /** Inserts an active employee with a first salary history entry; returns the new id. Call inside a transaction. */
  insertEmployee(fields: EmployeeFields, recordedAt: string): number {
    const { id } = this.db
      .insert(employees)
      .values({
        ...toEmployeeColumns(fields),
        status: 'active',
        exitDate: null,
        createdAt: recordedAt,
      })
      .returning({ id: employees.id })
      .get();
    this.insertSalaryEntry(
      id,
      {
        amount: fields.annualSalary,
        currency: currencyFor(fields.countryCode),
        effectiveDate: fields.hireDate,
        reason: STARTING_SALARY_REASON,
      },
      recordedAt,
    );
    return id;
  }

  getEditableState(id: number): EditableState | null {
    const row = this.selectStoredEmployees(eq(employees.id, id)).get();
    if (!row) return null;
    const { status, fields, earliestSalaryDate, currentSalaryDate } = toStoredEmployee(row);
    return { status, fields, earliestSalaryDate, currentSalaryDate };
  }

  /** Every stored employee, active or not, with its current salary and earliest salary date; unordered. */
  listStoredEmployees(): StoredEmployee[] {
    return this.selectStoredEmployees().all().map(toStoredEmployee);
  }

  /** Overwrites the employee's own fields (not the salary) and refreshes the search keys. */
  updateEmployeeFields(id: number, fields: EmployeeFields): void {
    this.db.update(employees).set(toEmployeeColumns(fields)).where(eq(employees.id, id)).run();
  }

  insertSalaryEntry(employeeId: number, entry: SalaryEntryInput, recordedAt: string): void {
    this.db
      .insert(salaryHistory)
      .values({ employeeId, ...entry, recordedAt })
      .run();
  }

  getDetail(id: number): EmployeeDetail | null {
    const row = this.db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        email: employees.email,
        jobTitle: employees.jobTitle,
        department: employees.department,
        countryCode: employees.countryCode,
        employmentType: employees.employmentType,
        hireDate: employees.hireDate,
        status: employees.status,
        exitDate: employees.exitDate,
        currentSalary: currentSalaries.amount,
        currency: currentSalaries.currency,
      })
      .from(employees)
      .innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))
      .where(eq(employees.id, id))
      .get();
    if (!row) return null;
    return {
      ...toEmployeeSummary(row),
      email: row.email,
      employmentType: row.employmentType,
      hireDate: row.hireDate,
      salaryHistory: this.listSalaryHistory(id),
      linkedEmployments: this.listLinkedEmployments(row.email, id),
    };
  }

  /** One row per employee (optionally just those matching the condition) with the facts of a StoredEmployee. */
  private selectStoredEmployees(condition?: SQL) {
    return this.db
      .select({
        employee: employees,
        currentSalary: currentSalaries.amount,
        currentCurrency: currentSalaries.currency,
        currentSalaryDate: currentSalaries.effectiveDate,
        earliestSalaryDate: min(salaryHistory.effectiveDate),
      })
      .from(employees)
      .innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))
      .innerJoin(salaryHistory, eq(salaryHistory.employeeId, employees.id))
      .where(condition)
      .groupBy(employees.id);
  }

  private listSalaryHistory(employeeId: number): SalaryHistoryEntry[] {
    return this.db
      .select()
      .from(salaryHistory)
      .where(eq(salaryHistory.employeeId, employeeId))
      .orderBy(...SALARY_HISTORY_ORDER)
      .all()
      .map((entry) => ({ ...entry, currency: entry.currency as CurrencyCode }));
  }

  private countEmployees(condition: SQL | undefined): number {
    const row = this.db.select({ total: count() }).from(employees).where(condition).get();
    return row?.total ?? 0;
  }
}
