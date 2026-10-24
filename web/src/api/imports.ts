import type { ImportPreview } from '@acme/contracts';
import { requestJson } from './http';

/** Sends the file as multipart form data; the browser sets the Content-Type and its boundary. */
export function previewImport(file: File): Promise<ImportPreview> {
  const body = new FormData();
  body.append('file', file);
  return requestJson<ImportPreview>('/api/imports/preview', { method: 'POST', body });
}
