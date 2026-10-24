import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { runMigrations } from './db/migrate.ts';
import { systemClock } from './shared/clock.ts';
import { seedIfEmpty } from './seed/seedDatabase.ts';

const config = loadConfig(process.env);
const clock = systemClock(config.timeZone);
const db = openDatabase(config.databasePath);
runMigrations(db);

if (config.seedOnEmpty && seedIfEmpty(db, clock)) {
  console.log('Seeded the empty database with demo employees');
}

createApp({ db, clock, webDistPath: config.webDistPath }).listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
