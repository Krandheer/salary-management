import type { CountryCode, CountryInsight, CountryInsights } from '@acme/contracts';
import type { ActiveSalaryRow, EmployeeRepository } from '../employees/employeeRepository.ts';
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
}
