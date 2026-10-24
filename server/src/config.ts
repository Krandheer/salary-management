export interface AppConfig {
  port: number;
  databasePath: string;
  timeZone: string;
  seedOnEmpty: boolean;
  webDistPath: string;
}

const DEFAULT_PORT = 3000;

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${raw}"`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePort(env.PORT),
    databasePath: env.DATABASE_PATH ?? './data/salary.db',
    timeZone: env.APP_TIMEZONE ?? 'UTC',
    seedOnEmpty: env.SEED_ON_EMPTY === 'true',
    webDistPath: env.WEB_DIST_PATH ?? '../web/dist',
  };
}
