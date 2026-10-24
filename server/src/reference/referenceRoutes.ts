import { Router } from 'express';
import type { Clock } from '../shared/clock.ts';
import { buildReferenceData } from './referenceData.ts';

export function referenceRouter(clock: Clock): Router {
  const router = Router();
  router.get('/api/reference', (_req, res) => {
    res.json(buildReferenceData(clock.today()));
  });
  return router;
}
