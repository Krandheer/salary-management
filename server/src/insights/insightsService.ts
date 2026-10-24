import type {
  CountryCode,
  CountryInsight,
  CountryInsights,
  CountryJobTitleInsights,
  JobTitleInsight,
} from '@acme/contracts';
import type { ActiveSalaryRow, EmployeeRepository } from '../employees/employeeRepository.ts';
import { compareTitles, pickDisplayTitle } from '../employees/jobTitles.ts';
import { NotFoundError } from '../shared/errors.ts';
import { findCountry } from '../reference/referenceData.ts';
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
}
