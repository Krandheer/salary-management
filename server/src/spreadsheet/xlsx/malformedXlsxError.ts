/**
 * Thrown for XML that exceljs's full loader would also fail on, or that passes the limits the
 * reader puts on a part's shape to keep memory bounded; the reader reports it as unreadable.
 */
export class MalformedXlsxError extends Error {
  override readonly name = 'MalformedXlsxError';
}
