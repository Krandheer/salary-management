import { Router, type Response } from 'express';
import { parseEmployeeFilters } from '../employees/employeeListQuery.ts';
import type { DownloadableFile, ExportService } from './exportService.ts';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendAttachment(res: Response, file: DownloadableFile): void {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.send(file.content);
}

export function spreadsheetRouter(exportService: ExportService): Router {
  const router = Router();
  router.get('/api/exports/employees', async (req, res) => {
    const file = await exportService.exportEmployees(parseEmployeeFilters(req.query));
    sendAttachment(res, file);
  });
  router.get('/api/imports/template', async (_req, res) => {
    sendAttachment(res, await exportService.template());
  });
  return router;
}
