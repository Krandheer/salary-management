/** Thrown for XML that exceljs's full loader would also fail on; the reader reports it as unreadable. */
export class MalformedXlsxError extends Error {
  override readonly name = 'MalformedXlsxError';
}
