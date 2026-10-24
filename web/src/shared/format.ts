import type { CurrencyCode, IsoDate } from '@acme/contracts';

const WHOLE_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** The single display format for salaries, e.g. "USD 85,000". */
export function formatSalary(amount: number, currency: CurrencyCode): string {
  return `${currency} ${WHOLE_NUMBER.format(amount)}`;
}

/** Dates are shown as the stored YYYY-MM-DD. */
export function formatDate(date: IsoDate): string {
  return date;
}
