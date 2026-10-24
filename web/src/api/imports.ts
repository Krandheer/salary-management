import type { ApiErrorBody, ImportPreview, ImportResult } from '@acme/contracts';
import { ApiError, requestJson } from './http';

/** What confirming did: everything was saved, or nothing was because re-checking found errors. */
export type ImportConfirmation =
  { isApplied: true; result: ImportResult } | { isApplied: false; preview: ImportPreview };

const IMPORT_REJECTED_STATUS = 422;

function fileForm(file: File): FormData {
  const body = new FormData();
  body.append('file', file);
  return body;
}

/** Sends the file as multipart form data; the browser sets the Content-Type and its boundary. */
export function previewImport(file: File): Promise<ImportPreview> {
  return requestJson<ImportPreview>('/api/imports/preview', {
    method: 'POST',
    body: fileForm(file),
  });
}

/** The fresh preview a 422 carries when the data changed since the file was previewed. */
function rejectedPreviewOf(error: unknown): ImportPreview | null {
  if (!(error instanceof ApiError) || error.status !== IMPORT_REJECTED_STATUS) return null;
  const preview = (error.body as ApiErrorBody | undefined)?.error.preview;
  return preview ? (preview as ImportPreview) : null;
}

/** Sends the same file again; the server re-checks it in full and saves every row or none. */
export async function confirmImport(file: File): Promise<ImportConfirmation> {
  try {
    const result = await requestJson<ImportResult>('/api/imports', {
      method: 'POST',
      body: fileForm(file),
    });
    return { isApplied: true, result };
  } catch (error) {
    const preview = rejectedPreviewOf(error);
    if (preview) return { isApplied: false, preview };
    throw error;
  }
}
