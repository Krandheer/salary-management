import type { CountryCode } from '@acme/contracts';

/** The reason on the first salary history entry of every employee. */
export const STARTING_SALARY_REASON = 'Starting salary';

interface SalaryPlacement {
  annualSalary: number;
  countryCode: CountryCode;
}

/**
 * A new salary history entry is needed when the amount or the country changed; re-saving the
 * same amount in the same country is not a change.
 */
export function isNewHistoryEntryNeeded(
  stored: SalaryPlacement,
  proposed: SalaryPlacement,
): boolean {
  return (
    proposed.annualSalary !== stored.annualSalary || proposed.countryCode !== stored.countryCode
  );
}
