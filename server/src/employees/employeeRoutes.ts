import { Router } from 'express';
import type { JobTitleOptions } from '@acme/contracts';
import { parseEmployeeFilters, parseEmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeService } from './employeeService.ts';

export function employeeRouter(service: EmployeeService): Router {
  const router = Router();
  router.get('/api/employees', (req, res) => {
    res.json(service.listEmployees(parseEmployeeListQuery(req.query)));
  });
  router.get('/api/employees/job-titles', (req, res) => {
    const jobTitles = service.listJobTitleOptions(parseEmployeeFilters(req.query));
    res.json({ jobTitles } satisfies JobTitleOptions);
  });
  return router;
}
