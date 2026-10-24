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
import { groupBy } from '../shared/collections.ts';
import { NotFoundError } from '../shared/errors.ts';
import { RATES_AS_OF, RATES_SOURCE, findCountry, toUsdRates } from '../reference/referenceData.ts';
import { averageInUsd } from './currencyConversion.ts';
import { summarizeSalaries } from './statistics.ts';

function summarizeJobTitle(rows: readonly ActiveSalaryRow[]): JobTitleInsight {
  return {
    jobTitle: pickDisplayTitle(rows.map((row) => row.jobTitle)),
    ...summarizeSalaries(rows.map((row) => row.amount)),
  };
}

function countryUsdComparisons(
  rows: readonly ActiveSalaryRow[],
  toUsd: Record<CurrencyCode, number>,
): CountryUsdComparison[] {
  const comparisons = [...groupBy(rows, (row) => row.countryCode)].map(
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
  const comparisons = [...groupBy(rows, (row) => row.department)].map(
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
    const rowsByCountry = groupBy(
      this.employees.listActiveCurrentSalaries(),
      (row) => row.countryCode,
    );
    const countries = [...rowsByCountry].map(([code, group]): CountryInsight => {
      const country = findCountry(code)!;
      return {
        country: country.code,
        countryName: country.name,
        currency: country.currency,
        ...summarizeSalaries(group.map((row) => row.amount)),
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
    const jobTitles = [...groupBy(countryRows, (row) => row.jobTitleKey).values()].map(
      summarizeJobTitle,
    );
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
