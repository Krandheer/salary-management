import { PAGE_SIZE, type EmployeeDetail, type EmployeeListPage } from '@acme/contracts';
import type { Clock } from '../shared/clock.ts';
import { EmailTakenError, NotFoundError, ValidationError } from '../shared/errors.ts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeRepository } from './employeeRepository.ts';
import { validateEmployeeFields } from './employeeValidation.ts';
import { compareTitles, pickDisplayTitle } from './jobTitles.ts';

function groupSpellingsByKey(
  rows: readonly { jobTitleKey: string; jobTitle: string }[],
): Map<string, string[]> {
  const spellingsByKey = new Map<string, string[]>();
  for (const { jobTitleKey, jobTitle } of rows) {
    spellingsByKey.set(jobTitleKey, [...(spellingsByKey.get(jobTitleKey) ?? []), jobTitle]);
  }
  return spellingsByKey;
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
    const spellingsByKey = groupSpellingsByKey(this.repository.listJobTitleSpellings(filters));
    return [...spellingsByKey.values()].map(pickDisplayTitle).sort(compareTitles);
  }

  createEmployee(input: Record<string, unknown>): EmployeeDetail {
    const validation = validateEmployeeFields(input, { today: this.clock.today() });
    if (!validation.ok) throw new ValidationError(validation.fieldErrors);
    if (this.repository.findActiveIdByEmail(validation.fields.email) !== null) {
      throw new EmailTakenError();
    }
    const id = this.repository.insertEmployee(validation.fields, this.clock.now());
    return this.getEmployee(id);
  }

  getEmployee(id: number): EmployeeDetail {
    const detail = this.repository.getDetail(id);
    if (!detail) throw new NotFoundError(`Employee ${id} not found`);
    return detail;
  }
}
