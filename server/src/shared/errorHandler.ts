import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@acme/contracts';
import {
  EmailTakenError,
  EmployeeInactiveError,
  ImportFileError,
  ImportNotAppliedError,
  ImportRejectedError,
  InvalidQueryError,
  NotFoundError,
  ValidationError,
} from './errors.ts';

export interface ErrorLogger {
  error(...args: unknown[]): void;
}

interface HttpFailure {
  status: number;
  body: ApiErrorBody;
}

function failure(status: number, code: string, message: string, extra = {}): HttpFailure {
  return { status, body: { error: { code, message, ...extra } } };
}

/** body-parser's error for a request body that is not valid JSON. */
function isMalformedJsonBody(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  );
}

function toHttpFailure(error: unknown): HttpFailure | null {
  if (error instanceof ValidationError)
    return failure(400, 'VALIDATION_FAILED', error.message, { fieldErrors: error.fieldErrors });
  if (isMalformedJsonBody(error))
    return failure(400, 'VALIDATION_FAILED', 'Request body is not valid JSON');
  if (error instanceof InvalidQueryError) return failure(400, 'INVALID_QUERY', error.message);
  if (error instanceof EmailTakenError) return failure(409, 'EMAIL_TAKEN', error.message);
  if (error instanceof EmployeeInactiveError)
    return failure(409, 'EMPLOYEE_INACTIVE', error.message);
  if (error instanceof NotFoundError) return failure(404, 'NOT_FOUND', error.message);
  if (error instanceof ImportFileError) return failure(400, error.code, error.message);
  if (error instanceof ImportRejectedError)
    return failure(422, 'IMPORT_REJECTED', error.message, { preview: error.preview });
  if (error instanceof ImportNotAppliedError)
    return failure(500, 'IMPORT_NOT_APPLIED', error.message);
  return null;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`));
};

export function errorHandler(logger: ErrorLogger): ErrorRequestHandler {
  // Express identifies error middleware by its four parameters.
  return (error, _req, res, _next) => {
    const known = toHttpFailure(error);
    if (known) {
      if (known.status >= 500) logger.error(error);
      res.status(known.status).json(known.body);
      return;
    }
    logger.error(error);
    res.status(500).json(failure(500, 'INTERNAL_ERROR', 'Something went wrong').body);
  };
}
