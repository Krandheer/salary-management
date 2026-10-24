import { loadConfig } from '../config.ts';
import { openDatabase } from '../db/database.ts';
import { runMigrations } from '../db/migrate.ts';
import { systemClock } from '../shared/clock.ts';
import { generateSeedEmployees } from './generateEmployees.ts';
import { SEED_EMPLOYEE_COUNT, SEED_RANDOM_SEED } from './seedCatalogue.ts';
import { replaceAllEmployees } from './seedDatabase.ts';

const config = loadConfig(process.env);
const clock = systemClock(config.timeZone);
const db = openDatabase(config.databasePath);
runMigrations(db);

const employees = generateSeedEmployees({
  count: SEED_EMPLOYEE_COUNT,
  randomSeed: SEED_RANDOM_SEED,
  today: clock.today(),
});
replaceAllEmployees(db, employees, clock.now());
console.log(`Seeded ${employees.length} employees into ${config.databasePath}`);
