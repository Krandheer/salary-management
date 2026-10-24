import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ImportPreview } from '@acme/contracts';
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

const REJECTED_PREVIEW: ImportPreview = {
  totals: { create: 0, update: 0, unchanged: 0, error: 1 },
  creates: [],
  updates: [],
  errors: [{ row: 2, email: null, messages: ['Work Email: Work email is required'] }],
};

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
    [new ImportRejectedError(REJECTED_PREVIEW), 422, 'IMPORT_REJECTED'],
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
    const response = await request(appThrowing(new ImportRejectedError(REJECTED_PREVIEW))).get(
      '/boom',
    );

    expect(response.body.error.preview).toEqual(REJECTED_PREVIEW);
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
