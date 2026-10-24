import { Router, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { parseEmployeeFilters } from '../employees/employeeListQuery.ts';
import { ImportFileError } from '../shared/errors.ts';
import type { DownloadableFile, ExportService } from './exportService.ts';
import type { ImportService } from './importService.ts';
import { fileTooLargeError, MAX_IMPORT_BYTES } from './workbookReader.ts';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const IMPORT_FILE_FIELD = 'file';

export interface SpreadsheetServices {
  exportService: ExportService;
  importService: ImportService;
}

function sendAttachment(res: Response, file: DownloadableFile): void {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.send(file.content);
}

/** Any failure while receiving the upload is the request's fault, so it is a file-level 400. */
function toImportFileError(error: unknown): ImportFileError {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return fileTooLargeError();
  }
  return new ImportFileError(
    'INVALID_FILE',
    'The upload must be a single .xlsx file and nothing else',
  );
}

/**
 * Accepts exactly one file part named "file", held in memory and capped at 10 MB while it
 * streams in, so an oversized upload is refused before any of it is parsed.
 */
function receiveImportFile(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 0, parts: 1 },
  }).single(IMPORT_FILE_FIELD);
  return (req, res, next) => {
    upload(req, res, (error?: unknown) => next(error ? toImportFileError(error) : undefined));
  };
}

function uploadedFile(req: Request): Express.Multer.File {
  if (!req.file) throw new ImportFileError('INVALID_FILE', 'Choose an .xlsx file to import');
  return req.file;
}

export function spreadsheetRouter({ exportService, importService }: SpreadsheetServices): Router {
  const router = Router();
  router.get('/api/exports/employees', async (req, res) => {
    const file = await exportService.exportEmployees(parseEmployeeFilters(req.query));
    sendAttachment(res, file);
  });
  router.get('/api/imports/template', async (_req, res) => {
    sendAttachment(res, await exportService.template());
  });
  router.post('/api/imports/preview', receiveImportFile(), async (req, res) => {
    const file = uploadedFile(req);
    res.json(await importService.preview(file.buffer, file.originalname));
  });
  router.post('/api/imports', receiveImportFile(), async (req, res) => {
    const file = uploadedFile(req);
    res.json(await importService.apply(file.buffer, file.originalname));
  });
  return router;
}
