import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { fixedClock } from './shared/clock.ts';
import { createTestApp, createTestDb } from '../test/testApp.ts';

const INDEX_HTML = '<!doctype html><title>ACME</title><div id="root"></div>';
const ASSET_JS = 'console.log("asset");';

function createWebDist(): string {
  const dist = mkdtempSync(join(tmpdir(), 'acme-web-dist-'));
  writeFileSync(join(dist, 'index.html'), INDEX_HTML);
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'assets', 'app.js'), ASSET_JS);
  return dist;
}

describe('GET /api/health', () => {
  it('reports ok so the host can check the service is alive', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('serving the built web app', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({
      db: createTestDb(),
      clock: fixedClock('2026-10-24'),
      webDistPath: createWebDist(),
    });
  });

  it('serves index.html at the root', async () => {
    const response = await request(app).get('/').set('Accept', 'text/html');

    expect(response.status).toBe(200);
    expect(response.text).toBe(INDEX_HTML);
  });

  it('serves static assets as files', async () => {
    const response = await request(app).get('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.text).toBe(ASSET_JS);
  });

  it('falls back to index.html for a client-side route so deep links and refresh work', async () => {
    const response = await request(app).get('/employees/5').set('Accept', 'text/html');

    expect(response.status).toBe(200);
    expect(response.text).toBe(INDEX_HTML);
  });

  it('returns a JSON 404 for an unknown API route, never the HTML page', async () => {
    const response = await request(app).get('/api/unknown').set('Accept', 'text/html');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not answer a non-GET request to a client route with the HTML page', async () => {
    const response = await request(app).post('/employees/5').set('Accept', 'text/html');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('ACME');
  });

  it('does not answer a request that does not accept HTML with the HTML page', async () => {
    const response = await request(app).get('/employees/5').set('Accept', 'application/json');

    expect(response.status).toBe(404);
  });

  it('still serves the API alongside the web app', async () => {
    const response = await request(app).get('/api/reference');

    expect(response.status).toBe(200);
    expect(response.body.today).toBe('2026-10-24');
  });
});

describe('without a web build', () => {
  it('starts and answers client routes with a plain 404 when the web dist folder is missing', async () => {
    const app = createApp({
      db: createTestDb(),
      clock: fixedClock('2026-10-24'),
      webDistPath: join(tmpdir(), 'acme-no-such-dist'),
    });

    const response = await request(app).get('/employees').set('Accept', 'text/html');

    expect(response.status).toBe(404);
  });
});
