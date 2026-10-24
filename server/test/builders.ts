import type { CountryCode, CurrencyCode, EmployeeStatus, IsoDate } from '@acme/contracts';
import type { AppDatabase } from '../src/db/database.ts';
import { employees, salaryHistory } from '../src/db/schema.ts';
import { currencyFor } from '../src/reference/referenceData.ts';
import { normalizeKey } from '../src/shared/text.ts';

export interface SalaryFixture {
  amount: number;
  effectiveDate: IsoDate;
  currency?: CurrencyCode;
  reason?: string | null;
}

export interface EmployeeFixture {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: CountryCode;
  employmentType: string;
  hireDate: IsoDate;
  status: EmployeeStatus;
  exitDate: IsoDate | null;
  salaryHistory: SalaryFixture[];
}

const RECORDED_AT = '2026-01-01T00:00:00.000Z';
let sequence = 0;

function defaultFixture(): EmployeeFixture {
  sequence += 1;
  return {
    fullName: `Employee ${sequence}`,
    email: `employee.${sequence}@acme.example`,
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'US',
    employmentType: 'Full-time',
    hireDate: '2020-01-15',
    status: 'active',
    exitDate: null,
    salaryHistory: [],
  };
}

/** Inserts an employee and its salary history directly (history ids follow array order); returns the employee id. */
export function insertEmployee(db: AppDatabase, overrides: Partial<EmployeeFixture> = {}): number {
  const fixture = { ...defaultFixture(), ...overrides };
  const history = fixture.salaryHistory.length
    ? fixture.salaryHistory
    : [{ amount: 85_000, effectiveDate: fixture.hireDate }];

  return db.transaction(() => {
    const row = db
      .insert(employees)
      .values({
        fullName: fixture.fullName,
        nameKey: normalizeKey(fixture.fullName),
        email: fixture.email,
        jobTitle: fixture.jobTitle,
        jobTitleKey: normalizeKey(fixture.jobTitle),
        department: fixture.department,
        countryCode: fixture.countryCode,
        employmentType: fixture.employmentType,
        hireDate: fixture.hireDate,
        status: fixture.status,
        exitDate: fixture.exitDate,
        createdAt: RECORDED_AT,
      })
      .returning({ id: employees.id })
      .get();
    for (const entry of history) {
      db.insert(salaryHistory)
        .values({
          employeeId: row.id,
          amount: entry.amount,
          currency: entry.currency ?? currencyFor(fixture.countryCode),
          effectiveDate: entry.effectiveDate,
          reason: entry.reason ?? null,
          recordedAt: RECORDED_AT,
        })
        .run();
    }
    return row.id;
  });
}
