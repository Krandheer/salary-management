import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
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
import { errorHandler, notFoundHandler } from './errorHandler.ts';

function appThrowing(error: unknown, logger = { error: vi.fn() }) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use('/api', notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

describe('errorHandler', () => {
  it.each([
    [new ValidationError({ email: 'Required' }), 400, 'VALIDATION_FAILED'],
    [new InvalidQueryError('bad page'), 400, 'INVALID_QUERY'],
    [new EmailTakenError(), 409, 'EMAIL_TAKEN'],
    [new EmployeeInactiveError(), 409, 'EMPLOYEE_INACTIVE'],
    [new NotFoundError('Employee not found'), 404, 'NOT_FOUND'],
    [new ImportFileError('HEADER_MISMATCH'), 400, 'HEADER_MISMATCH'],
    [new ImportRejectedError({ totals: {} }), 422, 'IMPORT_REJECTED'],
    [new ImportNotAppliedError(), 500, 'IMPORT_NOT_APPLIED'],
  ])('maps %o to status %i and code %s', async (error, status, code) => {
    const response = await request(appThrowing(error)).get('/boom');

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(typeof response.body.error.message).toBe('string');
  });

  it('includes fieldErrors for a validation failure', async () => {
    const response = await request(appThrowing(new ValidationError({ email: 'Required' }))).get(
      '/boom',
    );

    expect(response.body.error.fieldErrors).toEqual({ email: 'Required' });
  });

  it('includes the preview for a rejected import', async () => {
    const preview = { totals: { error: 2 } };

    const response = await request(appThrowing(new ImportRejectedError(preview))).get('/boom');

    expect(response.body.error.preview).toEqual(preview);
  });

  it('hides the details of an unknown error and logs it', async () => {
    const logger = { error: vi.fn() };

    const response = await request(appThrowing(new Error('db password leaked'), logger)).get(
      '/boom',
    );

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('leaked');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('answers unknown /api routes with a NOT_FOUND error body', async () => {
    const response = await request(appThrowing(new Error('unused'))).get('/api/missing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
