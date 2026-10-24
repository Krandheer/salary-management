import type { EmployeeListParams } from '@acme/contracts';
import { buildQueryString } from './http';

export const TEMPLATE_DOWNLOAD_URL = '/api/imports/template';

/** The download URL for the employees in view; the browser handles the attachment. */
export function buildExportUrl(view: Omit<EmployeeListParams, 'page'> = {}): string {
  return `/api/exports/employees${buildQueryString({ ...view })}`;
}
