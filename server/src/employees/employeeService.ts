import { PAGE_SIZE, type EmployeeListPage } from '@acme/contracts';
import type { EmployeeFilters, EmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeRepository } from './employeeRepository.ts';
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
  constructor(private readonly repository: EmployeeRepository) {}

  listEmployees(query: EmployeeListQuery): EmployeeListPage {
    return this.repository.listPage(query, PAGE_SIZE);
  }

  /** Each distinct job title of the employees in view once, A to Z. */
  listJobTitleOptions(filters: EmployeeFilters): string[] {
    const spellingsByKey = groupSpellingsByKey(this.repository.listJobTitleSpellings(filters));
    return [...spellingsByKey.values()].map(pickDisplayTitle).sort(compareTitles);
  }
}
