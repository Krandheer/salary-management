import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  sqliteView,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const employees = sqliteTable(
  'employees',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fullName: text('full_name').notNull(),
    nameKey: text('name_key').notNull(),
    email: text('email').notNull(),
    jobTitle: text('job_title').notNull(),
    jobTitleKey: text('job_title_key').notNull(),
    department: text('department').notNull(),
    countryCode: text('country_code').notNull(),
    employmentType: text('employment_type').notNull(),
    hireDate: text('hire_date').notNull(),
    status: text('status', { enum: ['active', 'inactive'] }).notNull(),
    exitDate: text('exit_date'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    check('employees_status_check', sql`${t.status} IN ('active', 'inactive')`),
    check(
      'employees_exit_date_matches_status',
      sql`(${t.status} = 'inactive') = (${t.exitDate} IS NOT NULL)`,
    ),
    uniqueIndex('ux_employees_active_email')
      .on(t.email)
      .where(sql`${t.status} = 'active'`),
    index('ix_employees_status_name').on(t.status, t.nameKey, t.id),
    index('ix_employees_email').on(t.email),
    index('ix_employees_status_country').on(t.status, t.countryCode, t.jobTitleKey),
  ],
);

export const salaryHistory = sqliteTable(
  'salary_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    effectiveDate: text('effective_date').notNull(),
    reason: text('reason'),
    recordedAt: text('recorded_at').notNull(),
  },
  (t) => [
    check('salary_history_amount_positive', sql`${t.amount} > 0`),
    index('ix_salary_history_employee').on(
      t.employeeId,
      sql`${t.effectiveDate} DESC`,
      sql`${t.id} DESC`,
    ),
  ],
);

/** Created by the custom migration `current_salaries_view`; declared here only for typed queries. */
export const currentSalaries = sqliteView('current_salaries', {
  employeeId: integer('employee_id'),
  amount: integer('amount'),
  currency: text('currency'),
}).existing();

export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;
export type SalaryHistoryRow = typeof salaryHistory.$inferSelect;
export type NewSalaryHistoryRow = typeof salaryHistory.$inferInsert;
