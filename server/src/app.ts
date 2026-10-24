import express, { type Express } from 'express';
import type { AppDatabase } from './db/database.ts';
import { referenceRouter } from './reference/referenceRoutes.ts';
import type { Clock } from './shared/clock.ts';
import { errorHandler, notFoundHandler } from './shared/errorHandler.ts';

export function createApp({ clock }: { db: AppDatabase; clock: Clock }): Express {
  const app = express();
  app.use(referenceRouter(clock));
  app.use('/api', notFoundHandler);
  app.use(errorHandler(console));
  return app;
}
