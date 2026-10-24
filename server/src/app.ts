import express, { type Express } from 'express';
import type { AppDatabase } from './db/database.ts';
import { EmployeeRepository } from './employees/employeeRepository.ts';
import { employeeRouter } from './employees/employeeRoutes.ts';
import { EmployeeService } from './employees/employeeService.ts';
import { referenceRouter } from './reference/referenceRoutes.ts';
import type { Clock } from './shared/clock.ts';
import { errorHandler, notFoundHandler } from './shared/errorHandler.ts';

export function createApp({ db, clock }: { db: AppDatabase; clock: Clock }): Express {
  const app = express();
  const employeeService = new EmployeeService(new EmployeeRepository(db));
  app.use(referenceRouter(clock));
  app.use(employeeRouter(employeeService));
  app.use('/api', notFoundHandler);
  app.use(errorHandler(console));
  return app;
}
