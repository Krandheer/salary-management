/** numerator / denominator rounded to the nearest whole number, halves up; integers only, so no precision is lost. */
function divideRoundedHalfUp(numerator: number, denominator: number): number {
  const doubledNumerator = 2 * numerator + denominator;
  const divisor = 2 * denominator;
  return (doubledNumerator - (doubledNumerator % divisor)) / divisor;
}

export function meanRoundedHalfUp(amounts: readonly number[]): number {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return divideRoundedHalfUp(total, amounts.length);
}

export function medianRoundedHalfUp(sortedAmounts: readonly number[]): number {
  const upperMiddleIndex = Math.floor(sortedAmounts.length / 2);
  const upperMiddle = sortedAmounts[upperMiddleIndex]!;
  if (sortedAmounts.length % 2 === 1) return upperMiddle;
  return divideRoundedHalfUp(sortedAmounts[upperMiddleIndex - 1]! + upperMiddle, 2);
}

export function summarizeSalaries(amounts: readonly number[]) {
  if (amounts.length === 0) throw new RangeError('Cannot summarize an empty list of salaries');
  const sorted = [...amounts].sort((a, b) => a - b);
  return {
    headcount: sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: meanRoundedHalfUp(sorted),
    median: medianRoundedHalfUp(sorted),
  };
}
