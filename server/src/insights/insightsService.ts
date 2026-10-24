import type {
  CountryCode,
  CurrencyCode,
  CountryInsight,
  CountryInsights,
  CountryJobTitleInsights,
  CountryUsdComparison,
  DepartmentUsdComparison,
  JobTitleInsight,
  OrganisationComparison,
} from '@acme/contracts';
import type { ActiveSalaryRow, EmployeeRepository } from '../employees/employeeRepository.ts';
import { compareTitles, pickDisplayTitle } from '../employees/jobTitles.ts';
import { NotFoundError } from '../shared/errors.ts';
import { RATES_AS_OF, RATES_SOURCE, findCountry, toUsdRates } from '../reference/referenceData.ts';
import { averageInUsd } from './currencyConversion.ts';
import { summarizeSalaries } from './statistics.ts';

function groupAmountsByCountry(rows: readonly ActiveSalaryRow[]): Map<CountryCode, number[]> {
  const amountsByCountry = new Map<CountryCode, number[]>();
  for (const { countryCode, amount } of rows) {
    const amounts = amountsByCountry.get(countryCode) ?? [];
    amounts.push(amount);
    amountsByCountry.set(countryCode, amounts);
  }
  return amountsByCountry;
}

function summarizeJobTitle(rows: readonly ActiveSalaryRow[]): JobTitleInsight {
  return {
    jobTitle: pickDisplayTitle(rows.map((row) => row.jobTitle)),
    ...summarizeSalaries(rows.map((row) => row.amount)),
  };
}

function groupByJobTitleKey(rows: readonly ActiveSalaryRow[]): ActiveSalaryRow[][] {
  const rowsByKey = new Map<string, ActiveSalaryRow[]>();
  for (const row of rows) {
    const group = rowsByKey.get(row.jobTitleKey) ?? [];
    group.push(row);
    rowsByKey.set(row.jobTitleKey, group);
  }
  return [...rowsByKey.values()];
}

function groupRowsBy<K>(
  rows: readonly ActiveSalaryRow[],
  keyOf: (row: ActiveSalaryRow) => K,
): Map<K, ActiveSalaryRow[]> {
  const rowsByKey = new Map<K, ActiveSalaryRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = rowsByKey.get(key) ?? [];
    group.push(row);
    rowsByKey.set(key, group);
  }
  return rowsByKey;
}

function countryUsdComparisons(
  rows: readonly ActiveSalaryRow[],
  toUsd: Record<CurrencyCode, number>,
): CountryUsdComparison[] {
  const comparisons = [...groupRowsBy(rows, (row) => row.countryCode)].map(
    ([code, group]): CountryUsdComparison => {
      const country = findCountry(code)!;
      return {
        country: country.code,
        countryName: country.name,
        headcount: group.length,
        averageSalaryUsd: averageInUsd(group, toUsd),
      };
    },
  );
  return comparisons.sort((a, b) => a.countryName.localeCompare(b.countryName));
}

function departmentUsdComparisons(
  rows: readonly ActiveSalaryRow[],
  toUsd: Record<CurrencyCode, number>,
): DepartmentUsdComparison[] {
  const comparisons = [...groupRowsBy(rows, (row) => row.department)].map(
    ([department, group]): DepartmentUsdComparison => ({
      department,
      headcount: group.length,
      averageSalaryUsd: averageInUsd(group, toUsd),
    }),
  );
  return comparisons.sort((a, b) => a.department.localeCompare(b.department));
}

export class InsightsService {
  constructor(private readonly employees: EmployeeRepository) {}

  countryInsights(): CountryInsights {
    const amountsByCountry = groupAmountsByCountry(this.employees.listActiveCurrentSalaries());
    const countries = [...amountsByCountry].map(([code, amounts]): CountryInsight => {
      const country = findCountry(code)!;
      return {
        country: country.code,
        countryName: country.name,
        currency: country.currency,
        ...summarizeSalaries(amounts),
      };
    });
    countries.sort((a, b) => a.countryName.localeCompare(b.countryName));
    return { countries };
  }

  jobTitleInsights(countryCode: CountryCode): CountryJobTitleInsights {
    const country = findCountry(countryCode);
    if (!country) throw new NotFoundError(`Unknown country ${countryCode}`);
    const countryRows = this.employees
      .listActiveCurrentSalaries()
      .filter((row) => row.countryCode === country.code);
    const jobTitles = groupByJobTitleKey(countryRows).map(summarizeJobTitle);
    jobTitles.sort((a, b) => compareTitles(a.jobTitle, b.jobTitle));
    return {
      country: country.code,
      countryName: country.name,
      currency: country.currency,
      jobTitles,
    };
  }

  organisationComparison(): OrganisationComparison {
    const rows = this.employees.listActiveCurrentSalaries();
    const toUsd = toUsdRates();
    return {
      referenceCurrency: 'USD',
      ratesAsOf: RATES_AS_OF,
      ratesSource: RATES_SOURCE,
      toUsd,
      byCountry: countryUsdComparisons(rows, toUsd),
      byDepartment: departmentUsdComparisons(rows, toUsd),
    };
  }
}
