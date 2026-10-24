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

/** What the add form learns about an email before saving: who holds it now, and who held it before. */
export interface EmailCheckResult {
  activeEmployeeId: number | null;
  /** Most recent exit first. */
  inactiveEmployees: LinkedEmployment[];
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

/** Current annual salary figures for a group of active employees, in one currency. */
export interface SalaryStats {
  headcount: number;
  min: number;
  max: number;
  /** Rounded to a whole currency unit, halves up. */
  mean: number;
  /** Rounded to a whole currency unit, halves up. */
  median: number;
}

export interface CountryInsight extends SalaryStats {
  country: CountryCode;
  countryName: string;
  currency: CurrencyCode;
}

/** Only countries with active employees, ordered by country name A to Z. */
export interface CountryInsights {
  countries: CountryInsight[];
}

export interface JobTitleInsight extends SalaryStats {
  jobTitle: string;
}

/** Active employees of one country grouped by job title, ordered A to Z; empty when it has none. */
export interface CountryJobTitleInsights {
  country: CountryCode;
  countryName: string;
  currency: CurrencyCode;
  jobTitles: JobTitleInsight[];
}

/** One country's active employees, with the mean current salary converted to whole US dollars. */
export interface CountryUsdComparison {
  country: CountryCode;
  countryName: string;
  headcount: number;
  averageSalaryUsd: number;
}

/** One department across all countries, with the mean current salary converted to whole US dollars. */
export interface DepartmentUsdComparison {
  department: string;
  headcount: number;
  averageSalaryUsd: number;
}

/**
 * Current salaries of active employees in US dollars, at the fixed reference rates.
 * Converted figures are approximate; groups with no active employees are omitted.
 */
export interface OrganisationComparison {
  referenceCurrency: 'USD';
  ratesAsOf: IsoDate;
  ratesSource: string;
  /** US dollars per one unit of each currency. */
  toUsd: Record<CurrencyCode, number>;
  /** Ordered by country name A to Z. */
  byCountry: CountryUsdComparison[];
  /** Ordered A to Z. */
  byDepartment: DepartmentUsdComparison[];
}
