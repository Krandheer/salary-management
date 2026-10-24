import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type {
  CountryCode,
  CurrencyCode,
  EmployeeDetail,
  EmployeeListPage,
  EmployeeStatus,
  EmployeeSummary,
  SalaryHistoryEntry,
} from '@acme/contracts';
import type { AppDatabase } from '../db/database.ts';
import { currentSalaries, employees, salaryHistory } from '../db/schema.ts';
import { currencyFor } from '../reference/referenceData.ts';
import { normalizeKey } from '../shared/text.ts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeFields } from './employeeValidation.ts';

export const STARTING_SALARY_REASON = 'Starting salary';

/** The current salary is the first row in this order; the `current_salaries` view uses the same rule. */
export const SALARY_HISTORY_ORDER = [desc(salaryHistory.effectiveDate), desc(salaryHistory.id)];

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
export function buildFilterConditions(filters: EmployeeFilters): SQL | undefined {
  const { status, searchKey, country, department, jobTitleKey } = filters;
  return and(
    eq(employees.status, status),
    searchKey ? sql`instr(${employees.nameKey}, ${searchKey}) > 0` : undefined,
    country ? eq(employees.countryCode, country) : undefined,
    department ? eq(employees.department, department) : undefined,
    jobTitleKey ? eq(employees.jobTitleKey, jobTitleKey) : undefined,
  );
}

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
      .orderBy(asc(employees.nameKey), asc(employees.id))
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

  /** One row per employee in view, ignoring the job title filter, so the job title choices stay complete. */
  listJobTitleSpellings(filters: EmployeeFilters): { jobTitleKey: string; jobTitle: string }[] {
    return this.db
      .select({ jobTitleKey: employees.jobTitleKey, jobTitle: employees.jobTitle })
      .from(employees)
      .where(buildFilterConditions({ ...filters, jobTitleKey: null }))
      .all();
  }

  /** The id of the active employee with this email (already lower-cased), if any. */
  findActiveIdByEmail(email: string): number | null {
    const row = this.db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.email, normalizeKey(email)), eq(employees.status, 'active')))
      .get();
    return row?.id ?? null;
  }

  /** Inserts an active employee with a first salary history entry; returns the new id. */
  insertEmployee(fields: EmployeeFields, recordedAt: string): number {
    return this.db.transaction(() => {
      const { id } = this.db
        .insert(employees)
        .values({
          fullName: fields.fullName,
          nameKey: normalizeKey(fields.fullName),
          email: fields.email,
          jobTitle: fields.jobTitle,
          jobTitleKey: normalizeKey(fields.jobTitle),
          department: fields.department,
          countryCode: fields.countryCode,
          employmentType: fields.employmentType,
          hireDate: fields.hireDate,
          status: 'active',
          exitDate: null,
          createdAt: recordedAt,
        })
        .returning({ id: employees.id })
        .get();
      this.db
        .insert(salaryHistory)
        .values({
          employeeId: id,
          amount: fields.annualSalary,
          currency: currencyFor(fields.countryCode),
          effectiveDate: fields.hireDate,
          reason: STARTING_SALARY_REASON,
          recordedAt,
        })
        .run();
      return id;
    });
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
      linkedEmployments: [],
    };
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
