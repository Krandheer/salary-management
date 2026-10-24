export type FieldErrors = Record<string, string>;

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

export class ImportFileError extends Error {
  constructor(readonly code: ImportFileErrorCode) {
    super(`Import file rejected: ${code}`);
  }
}

export class ImportRejectedError extends Error {
  constructor(readonly preview: unknown) {
    super('The import has rows with errors');
  }
}

export class ImportNotAppliedError extends Error {
  constructor() {
    super('The import could not be applied; no changes were made');
  }
}
