/** A calendar date formatted as YYYY-MM-DD. */
export type IsoDate = string;

export type EmployeeStatus = 'active' | 'inactive';

export type CountryCode = 'AU' | 'CA' | 'DE' | 'IN' | 'JP' | 'SG' | 'GB' | 'US';

export type CurrencyCode = 'AUD' | 'CAD' | 'EUR' | 'INR' | 'JPY' | 'SGD' | 'GBP' | 'USD';

export interface CountryReference {
  code: CountryCode;
  name: string;
  currency: CurrencyCode;
  maxAnnualSalary: number;
}

export interface ExchangeRates {
  asOf: IsoDate;
  source: string;
  toUsd: Record<CurrencyCode, number>;
}

export interface ReferenceData {
  countries: CountryReference[];
  departments: string[];
  employmentTypes: string[];
  exchangeRates: ExchangeRates;
  today: IsoDate;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    preview?: unknown;
  };
}

/** Rows per page in the employee list. */
export const PAGE_SIZE = 25;

export interface EmployeeSummary {
  id: number;
  fullName: string;
  jobTitle: string;
  department: string;
  country: CountryCode;
  currency: CurrencyCode;
  currentSalary: number;
  status: EmployeeStatus;
  exitDate: IsoDate | null;
}

export interface EmployeeListPage {
  items: EmployeeSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
