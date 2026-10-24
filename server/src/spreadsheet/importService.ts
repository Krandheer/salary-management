import type { ImportPreview } from '@acme/contracts';
import type { EmployeeRepository } from '../employees/employeeRepository.ts';
import type { Clock } from '../shared/clock.ts';
import { classifyImportRows, type ImportPlan } from './importClassifier.ts';
import { parseImportRow, type ParsedImportRow } from './importRowParser.ts';
import { readImportFile } from './workbookReader.ts';

/** Runs an uploaded file through read → parse → classify. Previewing never writes. */
export class ImportService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  async preview(content: Buffer, fileName: string): Promise<ImportPreview> {
    const rows = await this.parseFile(content, fileName);
    return this.planImport(rows).preview;
  }

  private async parseFile(content: Buffer, fileName: string): Promise<ParsedImportRow[]> {
    const today = this.clock.today();
    const rawRows = await readImportFile(content, fileName);
    return rawRows.map((raw) => parseImportRow(raw, today));
  }

  private planImport(rows: ParsedImportRow[]): ImportPlan {
    return classifyImportRows(rows, this.employees.loadImportSnapshot());
  }
}
