import { describe, expect, it } from 'vitest';
import { validateSalaryChange } from './salaryChangeRules.ts';

const TODAY = '2026-10-24';

describe('validateSalaryChange', () => {
  const context = { today: TODAY, hireDate: '2020-01-15', countryCode: 'US' } as const;

  it('dates the change today and records no reason when neither is given', () => {
    expect(validateSalaryChange({ amount: '90000' }, context)).toEqual({
      ok: true,
      change: { amount: 90_000, effectiveDate: TODAY, reason: null },
    });
  });

  it('uses the effective date and reason that were given, trimming the reason', () => {
    const result = validateSalaryChange(
      { amount: 90_000, effectiveDate: '2025-04-01', reason: '  Annual review ' },
      context,
    );

    expect(result).toEqual({
      ok: true,
      change: { amount: 90_000, effectiveDate: '2025-04-01', reason: 'Annual review' },
    });
  });

  it.each([[''], ['   '], [null]])('treats an effective date of %j as today', (effectiveDate) => {
    expect(validateSalaryChange({ amount: 90_000, effectiveDate }, context)).toMatchObject({
      ok: true,
      change: { effectiveDate: TODAY },
    });
  });

  it('rejects an effective date in the future', () => {
    const result = validateSalaryChange({ amount: 90_000, effectiveDate: '2026-10-25' }, context);

    expect(result).toEqual({
      ok: false,
      fieldErrors: { 'salaryChange.effectiveDate': expect.stringMatching(/future/i) },
    });
  });

  it('accepts an effective date of today', () => {
    expect(validateSalaryChange({ amount: 90_000, effectiveDate: TODAY }, context).ok).toBe(true);
  });

  it('rejects an effective date before the hire date', () => {
    const result = validateSalaryChange({ amount: 90_000, effectiveDate: '2020-01-14' }, context);

    expect(result).toEqual({
      ok: false,
      fieldErrors: { 'salaryChange.effectiveDate': expect.stringMatching(/hire date/i) },
    });
  });

  it('accepts an effective date equal to the hire date', () => {
    const result = validateSalaryChange({ amount: 90_000, effectiveDate: '2020-01-15' }, context);

    expect(result.ok).toBe(true);
  });

  it.each([['2025-02-30'], ['yesterday'], [20250101], ['2025-1-1']])(
    'rejects %j as an effective date',
    (effectiveDate) => {
      const result = validateSalaryChange({ amount: 90_000, effectiveDate }, context);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.effectiveDate']);
    },
  );

  it.each([[''], ['   '], [null], [undefined]])('saves a reason of %j as no reason', (reason) => {
    expect(validateSalaryChange({ amount: 90_000, reason }, context)).toMatchObject({
      ok: true,
      change: { reason: null },
    });
  });

  it('accepts a very long reason without truncating it', () => {
    const reason = 'x'.repeat(10_000);

    expect(validateSalaryChange({ amount: 90_000, reason }, context)).toMatchObject({
      ok: true,
      change: { reason },
    });
  });

  it('rejects a reason that is not text', () => {
    const result = validateSalaryChange({ amount: 90_000, reason: 42 }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.reason']);
  });

  it('reports the amount under salaryChange.amount, checked against the given country', () => {
    const result = validateSalaryChange({ amount: 50_000_001 }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors['salaryChange.amount']).toMatch(/cannot be more than 50,000,000/);
  });

  it('reports every problem at once', () => {
    const result = validateSalaryChange({ amount: 'lots', effectiveDate: '2999-01-01' }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'salaryChange.amount',
      'salaryChange.effectiveDate',
    ]);
  });

  it.each([[undefined], [null], ['90000'], [42]])(
    'asks for an amount when the change is %j',
    (input) => {
      const result = validateSalaryChange(input, context);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.amount']);
    },
  );
});
