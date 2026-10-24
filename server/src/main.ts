import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { runMigrations } from './db/migrate.ts';
import { employees } from './db/schema.ts';
import { systemClock } from './shared/clock.ts';
import { generateSeedEmployees } from './seed/generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from './seed/seedCatalogue.ts';
import { replaceAllEmployees } from './seed/seedDatabase.ts';

const config = loadConfig(process.env);
const clock = systemClock(config.timeZone);
const db = openDatabase(config.databasePath);
runMigrations(db);

if (
  config.seedOnEmpty &&
  db.select({ id: employees.id }).from(employees).limit(1).all().length === 0
) {
  const seeded = generateSeedEmployees({
    count: SEED_EMPLOYEE_COUNT,
    randomSeed: SEED_RANDOM_SEED,
    today: clock.today(),
  });
  replaceAllEmployees(db, seeded, clock.now());
  console.log(`Seeded ${seeded.length} employees`);
}

createApp({ db, clock }).listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
