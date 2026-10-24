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

/** Query-string parameters of the employee list; every one is optional. */
export interface EmployeeListParams {
  search?: string;
  country?: CountryCode;
  department?: string;
  jobTitle?: string;
  status?: EmployeeStatus;
  page?: number;
}

/** The distinct job titles (one display spelling each, A to Z) of the employees in view. */
export interface JobTitleOptions {
  jobTitles: string[];
}

/** Validation messages keyed by request field path, e.g. `annualSalary`. */
export type FieldErrors = Record<string, string>;

export interface SalaryHistoryEntry {
  id: number;
  amount: number;
  currency: CurrencyCode;
  effectiveDate: IsoDate;
  reason: string | null;
  recordedAt: string;
}

/** Another employment record that shares the employee's email. */
export interface LinkedEmployment {
  id: number;
  hireDate: IsoDate;
  exitDate: IsoDate | null;
  status: EmployeeStatus;
}

export interface EmployeeDetail extends EmployeeSummary {
  email: string;
  employmentType: string;
  hireDate: IsoDate;
  /** Newest effective date first; the first entry is the current salary. */
  salaryHistory: SalaryHistoryEntry[];
  linkedEmployments: LinkedEmployment[];
}

/** What the add form sends. The server validates and normalises every value. */
export interface CreateEmployeeRequest {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  annualSalary: string | number;
  employmentType: string;
  hireDate: string;
}

/**
 * What the edit form sends: only the fields that changed. A new salary goes in
 * `salaryChange`; it is required when the country changes.
 */
export interface UpdateEmployeeRequest {
  fullName?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  country?: string;
  employmentType?: string;
  hireDate?: string;
  salaryChange?: {
    amount: string | number;
    /** Defaults to today; cannot be in the future or before the hire date. */
    effectiveDate?: string;
    /** Optional free text; blank means no reason. */
    reason?: string;
  };
}
