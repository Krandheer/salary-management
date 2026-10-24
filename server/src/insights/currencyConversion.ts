import type { CurrencyCode } from '@acme/contracts';

export interface CurrencyAmount {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Mean of the amounts in US dollars, rounded once to a whole dollar. Math.round rounds
 * halves up for the positive salaries used here. Rounding only the final mean keeps a
 * group's average from drifting by one dollar per employee.
 */
export function averageInUsd(
  amounts: readonly CurrencyAmount[],
  toUsd: Readonly<Record<CurrencyCode, number>>,
): number {
  if (amounts.length === 0) throw new RangeError('Cannot average an empty list of salaries');
  const totalUsd = amounts.reduce((sum, { amount, currency }) => sum + amount * toUsd[currency], 0);
  return Math.round(totalUsd / amounts.length);
}
