import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('uses the documented defaults when no environment is set', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      databasePath: './data/salary.db',
      timeZone: 'UTC',
      seedOnEmpty: false,
      webDistPath: '../web/dist',
    });
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({
      PORT: '4100',
      DATABASE_PATH: '/tmp/x.db',
      APP_TIMEZONE: 'Asia/Kolkata',
      SEED_ON_EMPTY: 'true',
      WEB_DIST_PATH: '/srv/web',
    });

    expect(config).toEqual({
      port: 4100,
      databasePath: '/tmp/x.db',
      timeZone: 'Asia/Kolkata',
      seedOnEmpty: true,
      webDistPath: '/srv/web',
    });
  });

  it('rejects a port that is not a positive integer', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
