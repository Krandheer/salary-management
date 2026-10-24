import { Router } from 'express';
import { parseEmployeeListQuery } from './employeeListQuery.ts';
import type { EmployeeService } from './employeeService.ts';

export function employeeRouter(service: EmployeeService): Router {
  const router = Router();
  router.get('/api/employees', (req, res) => {
    res.json(service.listEmployees(parseEmployeeListQuery(req.query)));
  });
  return router;
}
