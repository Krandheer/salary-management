import express, { type Express } from 'express';
import type { AppDatabase } from './db/database.ts';
import { EmployeeRepository } from './employees/employeeRepository.ts';
import { employeeRouter } from './employees/employeeRoutes.ts';
import { EmployeeService } from './employees/employeeService.ts';
import { insightsRouter } from './insights/insightsRoutes.ts';
import { InsightsService } from './insights/insightsService.ts';
import { referenceRouter } from './reference/referenceRoutes.ts';
import { ExportService } from './spreadsheet/exportService.ts';
import { ImportService } from './spreadsheet/importService.ts';
import { spreadsheetRouter } from './spreadsheet/spreadsheetRoutes.ts';
import type { Clock } from './shared/clock.ts';
import { errorHandler, notFoundHandler } from './shared/errorHandler.ts';

export function createApp({ db, clock }: { db: AppDatabase; clock: Clock }): Express {
  const app = express();
  const employeeRepository = new EmployeeRepository(db);
  const employeeService = new EmployeeService(employeeRepository, clock);
  const insightsService = new InsightsService(employeeRepository);
  const exportService = new ExportService(employeeRepository, clock);
  const importService = new ImportService(employeeRepository, clock);
  app.use(express.json());
  app.use(referenceRouter(clock));
  app.use(employeeRouter(employeeService));
  app.use(insightsRouter(insightsService));
  app.use(spreadsheetRouter({ exportService, importService }));
  app.use('/api', notFoundHandler);
  app.use(errorHandler(console));
  return app;
}
