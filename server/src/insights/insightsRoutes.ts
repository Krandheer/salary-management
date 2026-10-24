import { Router } from 'express';
import type { InsightsService } from './insightsService.ts';

export function insightsRouter(service: InsightsService): Router {
  const router = Router();
  router.get('/api/insights/countries', (_req, res) => {
    res.json(service.countryInsights());
  });
  return router;
}
