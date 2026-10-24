import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ReferenceData } from '@acme/contracts';
import { createTestApp } from '../../test/testApp.ts';

describe('GET /api/reference', () => {
  it('serves the countries, departments, employment types, rates and the clock date', async () => {
    const { app } = createTestApp({ today: '2026-03-05' });

    const response = await request(app).get('/api/reference');

    expect(response.status).toBe(200);
    const body = response.body as ReferenceData;
    expect(body.countries).toHaveLength(8);
    expect(body.departments).toHaveLength(10);
    expect(body.employmentTypes).toEqual(['Full-time', 'Part-time', 'Contractor']);
    expect(body.exchangeRates.asOf).toBe('2026-10-23');
    expect(body.exchangeRates.toUsd.USD).toBe(1);
    expect(body.today).toBe('2026-03-05');
  });

  it('answers 404 with a NOT_FOUND error body for an unknown API route', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
