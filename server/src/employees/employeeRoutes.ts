import { Router } from 'express';
import type { JobTitleOptions } from '@acme/contracts';
import { NotFoundError } from '../shared/errors.ts';
import { parseEmployeeFilters, parseEmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeService } from './employeeService.ts';

function parseEmployeeId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new NotFoundError(`Employee ${raw} not found`);
  return Number(raw);
}

/** A JSON request body as a plain object; anything else counts as an empty body. */
function toInputRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function employeeRouter(service: EmployeeService): Router {
  const router = Router();
  router.get('/api/employees', (req, res) => {
    res.json(service.listEmployees(parseEmployeeListQuery(req.query)));
  });
  router.get('/api/employees/job-titles', (req, res) => {
    const jobTitles = service.listJobTitleOptions(parseEmployeeFilters(req.query));
    res.json({ jobTitles } satisfies JobTitleOptions);
  });
  router.post('/api/employees', (req, res) => {
    res.status(201).json(service.createEmployee(toInputRecord(req.body)));
  });
  router.get('/api/employees/:id', (req, res) => {
    res.json(service.getEmployee(parseEmployeeId(req.params.id)));
  });
  router.patch('/api/employees/:id', (req, res) => {
    res.json(service.updateEmployee(parseEmployeeId(req.params.id), toInputRecord(req.body)));
  });
  return router;
}
