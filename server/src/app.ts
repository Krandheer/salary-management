import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
import { healthRouter } from './shared/healthRoutes.ts';

export interface AppDependencies {
  db: AppDatabase;
  clock: Clock;
  /** Folder holding the built web app; when absent or missing, only the API is served. */
  webDistPath?: string;
}

/** Serves the built SPA, and index.html for client-side routes (never for /api or non-HTML requests). */
function serveWebApp(app: Express, webDistPath: string): void {
  if (!existsSync(webDistPath)) return;
  app.use(express.static(webDistPath));
  app.use((req, res, next) => {
    const isClientRoute = req.method === 'GET' && !req.path.startsWith('/api');
    if (isClientRoute && req.accepts('html')) {
      res.sendFile(join(webDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

export function createApp({ db, clock, webDistPath }: AppDependencies): Express {
  const app = express();
  const employeeRepository = new EmployeeRepository(db);
  const employeeService = new EmployeeService(employeeRepository, clock);
  const insightsService = new InsightsService(employeeRepository);
  const exportService = new ExportService(employeeRepository, clock);
  const importService = new ImportService(employeeRepository, clock);
  app.use(express.json());
  app.use(healthRouter());
  app.use(referenceRouter(clock));
  app.use(employeeRouter(employeeService));
  app.use(insightsRouter(insightsService));
  app.use(spreadsheetRouter({ exportService, importService }));
  app.use('/api', notFoundHandler);
  if (webDistPath) serveWebApp(app, webDistPath);
  app.use(errorHandler(console));
  return app;
}
