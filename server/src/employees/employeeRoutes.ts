import { Router } from 'express';
import type { EmailCheckResult, JobTitleOptions } from '@acme/contracts';
import { asRecord } from '../shared/records.ts';
import { NotFoundError } from '../shared/errors.ts';
import { parseEmployeeFilters, parseEmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeService } from './employeeService.ts';

function parseEmployeeId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new NotFoundError(`Employee ${raw} not found`);
  return Number(raw);
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
  router.get('/api/employees/email-check', (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    res.json(service.checkEmail(email) satisfies EmailCheckResult);
  });
  router.post('/api/employees', (req, res) => {
    res.status(201).json(service.createEmployee(asRecord(req.body)));
  });
  router.get('/api/employees/:id', (req, res) => {
    res.json(service.getEmployee(parseEmployeeId(req.params.id)));
  });
  router.patch('/api/employees/:id', (req, res) => {
    res.json(service.updateEmployee(parseEmployeeId(req.params.id), asRecord(req.body)));
  });
  router.delete('/api/employees/:id', (req, res) => {
    res.json(service.deleteEmployee(parseEmployeeId(req.params.id), req.query.exitDate));
  });
  return router;
}
