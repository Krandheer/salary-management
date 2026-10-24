import { and, asc, count, eq, sql, type SQL } from 'drizzle-orm';
import type {
  CountryCode,
  CurrencyCode,
  EmployeeListPage,
  EmployeeStatus,
  EmployeeSummary,
} from '@acme/contracts';
import type { AppDatabase } from '../db/database.ts';
import { currentSalaries, employees } from '../db/schema.ts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';

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

  private countEmployees(condition: SQL | undefined): number {
    const row = this.db.select({ total: count() }).from(employees).where(condition).get();
    return row?.total ?? 0;
  }
}
