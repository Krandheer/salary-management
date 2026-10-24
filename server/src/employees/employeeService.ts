import { PAGE_SIZE, type EmployeeListPage } from '@acme/contracts';
import type { EmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeRepository } from './employeeRepository.ts';

export class EmployeeService {
  constructor(private readonly repository: EmployeeRepository) {}

  listEmployees(query: EmployeeListQuery): EmployeeListPage {
    return this.repository.listPage(query, PAGE_SIZE);
  }
}
