import type { FieldErrors, ImportPreview } from '@acme/contracts';

export type { FieldErrors };

export type ImportFileErrorCode =
  'INVALID_FILE' | 'FILE_TOO_LARGE' | 'TOO_MANY_ROWS' | 'NO_DATA_ROWS' | 'HEADER_MISMATCH';

export class ValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Some fields are invalid');
  }
}

export class InvalidQueryError extends Error {}

export class EmailTakenError extends Error {
  constructor() {
    super('An active employee already has this email');
  }
}

export class EmployeeInactiveError extends Error {
  constructor() {
    super('This employee is inactive');
  }
}

export class NotFoundError extends Error {}

/** The uploaded file as a whole can't be imported; the message tells the HR Manager why. */
export class ImportFileError extends Error {
  constructor(
    readonly code: ImportFileErrorCode,
    message = `Import file rejected: ${code}`,
  ) {
    super(message);
  }
}

/** Re-validating the file at confirm time found row errors; the fresh preview shows them. */
export class ImportRejectedError extends Error {
  constructor(readonly preview: ImportPreview) {
    super('The import has rows with errors');
  }
}

/** Saving the import failed unexpectedly and was rolled back; `cause` is what went wrong. */
export class ImportNotAppliedError extends Error {
  constructor(cause?: unknown) {
    super('The import could not be applied; no changes were made', { cause });
  }
}
