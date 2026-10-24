import type { ImportPreview, ImportResult, IsoDate } from '@acme/contracts';
import type { EmployeeRepository } from '../employees/employeeRepository.ts';
import type { Clock } from '../shared/clock.ts';
import { ImportNotAppliedError, ImportRejectedError } from '../shared/errors.ts';
import { classifyImportRows, type ImportOperation, type ImportPlan } from './importClassifier.ts';
import { buildImportSnapshot } from './importSnapshot.ts';
import { parseImportRow, type ParsedImportRow } from './importRowParser.ts';
import { readImportFile } from './workbookReader.ts';

export const EXCEL_IMPORT_REASON = 'Excel import';

type UpdateOperation = Extract<ImportOperation, { kind: 'update' }>;

/**
 * Runs an uploaded file through read → parse → classify. Previewing never writes; applying
 * re-runs the same pipeline against the stored data and saves every row or none.
 */
export class ImportService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  async preview(content: Buffer, fileName: string): Promise<ImportPreview> {
    const rows = await this.parseFile(content, fileName, this.clock.today());
    return this.planImport(rows).preview;
  }

  /**
   * Re-validates the file against the data as it is now and applies it in one transaction.
   * Row errors → `ImportRejectedError` with the fresh preview; any other failure rolls
   * everything back → `ImportNotAppliedError` carrying the cause.
   */
  async apply(content: Buffer, fileName: string): Promise<ImportResult> {
    const today = this.clock.today();
    const rows = await this.parseFile(content, fileName, today);
    try {
      return this.employees.inTransaction(() => this.planAndApply(rows, today));
    } catch (error) {
      if (error instanceof ImportRejectedError) throw error;
      throw new ImportNotAppliedError(error);
    }
  }

  private async parseFile(
    content: Buffer,
    fileName: string,
    today: IsoDate,
  ): Promise<ParsedImportRow[]> {
    const rawRows = await readImportFile(content, fileName);
    return rawRows.map((raw) => parseImportRow(raw, today));
  }

  private planImport(rows: ParsedImportRow[]): ImportPlan {
    return classifyImportRows(rows, buildImportSnapshot(this.employees.listStoredEmployees()));
  }

  /** Must run inside the transaction: the snapshot it plans against is the one it writes to. */
  private planAndApply(rows: ParsedImportRow[], today: IsoDate): ImportResult {
    const { preview, operations } = this.planImport(rows);
    if (preview.totals.error > 0) throw new ImportRejectedError(preview);
    this.applyOperations(operations, this.clock.now(), today);
    const { create, update, unchanged } = preview.totals;
    return { created: create, updated: update, unchanged };
  }

  /** Creates write their own "Starting salary" entry; an update carries the stored email back unchanged. */
  private applyOperations(operations: ImportOperation[], recordedAt: string, today: IsoDate): void {
    for (const operation of operations) {
      if (operation.kind === 'create') this.employees.insertEmployee(operation.fields, recordedAt);
      else this.applyUpdate(operation, recordedAt, today);
    }
  }

  private applyUpdate(operation: UpdateOperation, recordedAt: string, today: IsoDate): void {
    const { employeeId, fields, salaryChange } = operation;
    this.employees.updateEmployeeFields(employeeId, fields);
    if (salaryChange === null) return;
    this.employees.insertSalaryEntry(
      employeeId,
      { ...salaryChange, effectiveDate: today, reason: EXCEL_IMPORT_REASON },
      recordedAt,
    );
  }
}
