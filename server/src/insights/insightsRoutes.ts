import { Router } from 'express';
import type { CountryCode } from '@acme/contracts';
import type { InsightsService } from './insightsService.ts';

export function insightsRouter(service: InsightsService): Router {
  const router = Router();
  router.get('/api/insights/countries', (_req, res) => {
    res.json(service.countryInsights());
  });
  router.get('/api/insights/countries/:code/job-titles', (req, res) => {
    res.json(service.jobTitleInsights(req.params.code as CountryCode));
  });
  return router;
}
