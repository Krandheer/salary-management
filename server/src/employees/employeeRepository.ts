import { asc, count, eq, type SQL } from 'drizzle-orm';
import type {
  CountryCode,
  CurrencyCode,
  EmployeeListPage,
  EmployeeStatus,
  EmployeeSummary,
} from '@acme/contracts';
import type { AppDatabase } from '../db/database.ts';
import { currentSalaries, employees } from '../db/schema.ts';
import type { EmployeeListQuery } from './employeeListQuery.ts';

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

export class EmployeeRepository {
  constructor(private readonly db: AppDatabase) {}

  listPage(query: EmployeeListQuery, pageSize: number): EmployeeListPage {
    const isInStatus = eq(employees.status, query.status);
    const total = this.countEmployees(isInStatus);
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
      .where(isInStatus)
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

  private countEmployees(condition: SQL): number {
    const row = this.db.select({ total: count() }).from(employees).where(condition).get();
    return row?.total ?? 0;
  }
}
