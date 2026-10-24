import { describe, expect, it } from 'vitest';
import { meanRoundedHalfUp, medianRoundedHalfUp, summarizeSalaries } from './statistics.ts';

describe('summarizeSalaries', () => {
  it('summarizes an odd count with the middle value as the median', () => {
    expect(summarizeSalaries([30, 10, 20])).toEqual({
      headcount: 3,
      min: 10,
      max: 30,
      mean: 20,
      median: 20,
    });
  });

  it('averages the two middle values for an even count', () => {
    expect(summarizeSalaries([10, 20, 30, 40])).toEqual({
      headcount: 4,
      min: 10,
      max: 40,
      mean: 25,
      median: 25,
    });
  });

  it('reports a single value as min, max, mean and median', () => {
    expect(summarizeSalaries([85_000])).toEqual({
      headcount: 1,
      min: 85_000,
      max: 85_000,
      mean: 85_000,
      median: 85_000,
    });
  });

  it('handles unsorted input without changing the caller array', () => {
    const amounts = [50, 10, 40, 20, 30];

    const summary = summarizeSalaries(amounts);

    expect(summary).toMatchObject({ min: 10, max: 50, median: 30 });
    expect(amounts).toEqual([50, 10, 40, 20, 30]);
  });

  it('keeps full precision for large INR amounts', () => {
    const summary = summarizeSalaries([4_000_000_000, 3_999_999_999]);

    expect(summary.mean).toBe(4_000_000_000);
    expect(summary.median).toBe(4_000_000_000);
    expect(summary.min).toBe(3_999_999_999);
  });

  it('throws a RangeError for empty input', () => {
    expect(() => summarizeSalaries([])).toThrow(RangeError);
  });
});

describe('meanRoundedHalfUp', () => {
  it('rounds a half up', () => {
    expect(meanRoundedHalfUp([1, 2])).toBe(2);
  });

  it('rounds below a half down', () => {
    expect(meanRoundedHalfUp([1, 1, 2])).toBe(1);
  });

  it('rounds above a half up', () => {
    expect(meanRoundedHalfUp([1, 2, 2])).toBe(2);
  });

  it('is exact when the sum is near the safe-integer limit', () => {
    const big = 1_500_000_000_000;
    expect(meanRoundedHalfUp([big, big + 1])).toBe(big + 1);
    expect(meanRoundedHalfUp([big, big, big + 1])).toBe(big);
  });
});

describe('medianRoundedHalfUp', () => {
  it('rounds the average of two middle values up on a half', () => {
    expect(medianRoundedHalfUp([1, 2])).toBe(2);
    expect(medianRoundedHalfUp([1, 4])).toBe(3);
  });

  it('returns the middle value of an odd count', () => {
    expect(medianRoundedHalfUp([1, 5, 9])).toBe(5);
  });

  it('averages two middle values that are already whole', () => {
    expect(medianRoundedHalfUp([1, 3, 5, 7])).toBe(4);
  });
});
