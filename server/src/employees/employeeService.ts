import {
  PAGE_SIZE,
  type EmailCheckResult,
  type EmployeeDetail,
  type EmployeeListPage,
} from '@acme/contracts';
import { currencyFor } from '../reference/referenceData.ts';
import type { Clock } from '../shared/clock.ts';
import {
  EmailTakenError,
  EmployeeInactiveError,
  NotFoundError,
  ValidationError,
} from '../shared/errors.ts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';
import type { EditableState, EmployeeRepository } from './employeeRepository.ts';
import {
  validateEmployeeFields,
  validateEmployeeUpdate,
  validateExitDate,
  validateRehireHireDate,
  type EmployeeFields,
  type ValidSalaryChange,
} from './employeeValidation.ts';
import { isIsoDate } from '../shared/dates.ts';
import { groupBy } from '../shared/collections.ts';
import { isNewHistoryEntryNeeded } from './salaryHistoryRules.ts';
import { normalizeKey } from '../shared/text.ts';
import { compareTitles, pickDisplayTitle } from './jobTitles.ts';

/** The rehire rule depends on the hire date and on which earlier records share the email. */
function isRehireRuleAffected(stored: EmployeeFields, updated: EmployeeFields): boolean {
  return updated.hireDate !== stored.hireDate || updated.email !== stored.email;
}

export class EmployeeService {
  constructor(
    private readonly repository: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  listEmployees(query: EmployeeListQuery): EmployeeListPage {
    return this.repository.listPage(query, PAGE_SIZE);
  }

  /** Each distinct job title of the employees in view once, A to Z. */
  listJobTitleOptions(filters: EmployeeFilters): string[] {
    const rowsByKey = groupBy(
      this.repository.listJobTitleSpellings(filters),
      (row) => row.jobTitleKey,
    );
    const spellingsByKey = [...rowsByKey.values()].map((rows) => rows.map((row) => row.jobTitle));
    return spellingsByKey.map(pickDisplayTitle).sort(compareTitles);
  }

  createEmployee(input: Record<string, unknown>): EmployeeDetail {
    const validation = validateEmployeeFields(input, { today: this.clock.today() });
    if (!validation.ok) throw new ValidationError(validation.fieldErrors);
    if (this.repository.findActiveIdByEmail(validation.fields.email) !== null) {
      throw new EmailTakenError();
    }
    this.checkRehireHireDate(validation.fields);
    const id = this.repository.inTransaction(() =>
      this.repository.insertEmployee(validation.fields, this.clock.now()),
    );
    return this.getEmployee(id);
  }

  /** Soft delete: the record stays, inactive, with its exit date. A blank exit date means today. */
  deleteEmployee(id: number, exitDate: unknown): EmployeeDetail {
    this.repository.inTransaction(() => this.applyDeletion(id, exitDate));
    return this.getEmployee(id);
  }

  /** Who holds this email now, and who held it before; the add form shows this before saving. */
  checkEmail(email: string): EmailCheckResult {
    const key = normalizeKey(email);
    return {
      activeEmployeeId: this.repository.findActiveIdByEmail(key),
      inactiveEmployees: this.repository.findInactiveByEmail(key),
    };
  }

  updateEmployee(id: number, patch: Record<string, unknown>): EmployeeDetail {
    this.repository.inTransaction(() => this.applyUpdate(id, patch));
    return this.getEmployee(id);
  }

  getEmployee(id: number): EmployeeDetail {
    const detail = this.repository.getDetail(id);
    if (!detail) throw new NotFoundError(`Employee ${id} not found`);
    return detail;
  }

  private applyUpdate(id: number, patch: Record<string, unknown>): void {
    const state = this.loadEditableState(id);
    const validation = validateEmployeeUpdate(state.fields, patch, {
      today: this.clock.today(),
      earliestSalaryDate: state.earliestSalaryDate,
      currentSalaryDate: state.currentSalaryDate,
    });
    if (!validation.ok) throw new ValidationError(validation.fieldErrors);
    const { fields, salaryChange } = validation;
    if (this.repository.findActiveIdByEmail(fields.email, id) !== null) {
      throw new EmailTakenError();
    }
    if (isRehireRuleAffected(state.fields, fields)) this.checkRehireHireDate(fields);
    this.repository.updateEmployeeFields(id, fields);
    if (salaryChange && this.isSalaryEntryNeeded(state.fields, fields, salaryChange)) {
      const entry = { ...salaryChange, currency: currencyFor(fields.countryCode) };
      this.repository.insertSalaryEntry(id, entry, this.clock.now());
    }
  }

  private isSalaryEntryNeeded(
    stored: EmployeeFields,
    updated: EmployeeFields,
    change: ValidSalaryChange,
  ): boolean {
    const proposed = { annualSalary: change.amount, countryCode: updated.countryCode };
    return isNewHistoryEntryNeeded(stored, proposed);
  }

  private applyDeletion(id: number, exitDate: unknown): void {
    const state = this.loadEditableState(id);
    const today = this.clock.today();
    const chosenDate = exitDate === undefined || exitDate === '' ? today : exitDate;
    const error = validateExitDate(chosenDate, { today, hireDate: state.fields.hireDate });
    if (error !== null || !isIsoDate(chosenDate)) {
      throw new ValidationError({ exitDate: error ?? 'Exit date must be a valid date' });
    }
    this.repository.deactivate(id, chosenDate);
  }

  /** Only inactive records count, so an edited (always active) employee is never judged against itself. */
  private checkRehireHireDate(fields: EmployeeFields): void {
    const [latest] = this.repository.findInactiveByEmail(fields.email);
    const error = validateRehireHireDate(fields.hireDate, latest?.exitDate ?? null);
    if (error) throw new ValidationError({ hireDate: error });
  }

  private loadEditableState(id: number): EditableState {
    const state = this.repository.getEditableState(id);
    if (!state) throw new NotFoundError(`Employee ${id} not found`);
    if (state.status === 'inactive') throw new EmployeeInactiveError();
    return state;
  }
}
