import type { EmployeeRepository } from '../employees/employeeRepository.ts';
import type { EmployeeFilters } from '../employees/employeeListQuery.ts';
import type { Clock } from '../shared/clock.ts';
import { buildEmployeesWorkbook, buildTemplateWorkbook } from './workbookWriter.ts';

export const TEMPLATE_FILE_NAME = 'employee-import-template.xlsx';

export interface DownloadableFile {
  fileName: string;
  content: Buffer;
}

export class ExportService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  async exportEmployees(filters: EmployeeFilters): Promise<DownloadableFile> {
    const content = await buildEmployeesWorkbook(this.employees.listForExport(filters));
    return { fileName: `employees-${this.clock.today()}.xlsx`, content };
  }

  async template(): Promise<DownloadableFile> {
    return { fileName: TEMPLATE_FILE_NAME, content: await buildTemplateWorkbook() };
  }
}
