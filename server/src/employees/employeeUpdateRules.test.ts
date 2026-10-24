import { describe, expect, it } from 'vitest';
import type { EmployeeFields } from './employeeFields.ts';
import { validateEmployeeUpdate } from './employeeUpdateRules.ts';

const TODAY = '2026-10-24';

describe('validateEmployeeUpdate', () => {
  const current: EmployeeFields = {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    employmentType: 'Full-time',
    hireDate: '2024-03-01',
    annualSalary: 1_850_000,
  };
  const context = {
    today: TODAY,
    earliestSalaryDate: '2024-03-01',
    currentSalaryDate: '2024-03-01',
  };

  it('keeps every field the patch leaves out and normalises the ones it changes', () => {
    const result = validateEmployeeUpdate(current, { jobTitle: '  Staff Engineer ' }, context);

    expect(result).toEqual({
      ok: true,
      fields: { ...current, jobTitle: 'Staff Engineer' },
      salaryChange: null,
    });
  });

  it('accepts an empty patch', () => {
    expect(validateEmployeeUpdate(current, {}, context)).toEqual({
      ok: true,
      fields: current,
      salaryChange: null,
    });
  });

  it('re-applies the shared field rules to the merged result', () => {
    const result = validateEmployeeUpdate(
      current,
      { email: 'nope', fullName: '   ', department: 'Astrology', hireDate: '2999-01-01' },
      context,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'department',
      'email',
      'fullName',
      'hireDate',
    ]);
  });

  it('returns a salary change dated today with no reason', () => {
    const result = validateEmployeeUpdate(
      current,
      { salaryChange: { amount: '2000000' } },
      context,
    );

    expect(result).toEqual({
      ok: true,
      fields: { ...current, annualSalary: 2_000_000 },
      salaryChange: { amount: 2_000_000, effectiveDate: TODAY, reason: null },
    });
  });

  it('asks for a new salary when the country changes without one', () => {
    const result = validateEmployeeUpdate(current, { country: 'US' }, context);

    expect(result).toEqual({
      ok: false,
      fieldErrors: { 'salaryChange.amount': expect.stringMatching(/new salary/i) },
    });
  });

  it('accepts a country change that comes with a new salary', () => {
    const result = validateEmployeeUpdate(
      current,
      { country: 'US', salaryChange: { amount: 90_000 } },
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      fields: { countryCode: 'US', annualSalary: 90_000 },
      salaryChange: { amount: 90_000 },
    });
  });

  it('checks the new salary against the maximum of the new country', () => {
    const result = validateEmployeeUpdate(
      current,
      { country: 'GB', salaryChange: { amount: 50_000_000 } },
      context,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.amount']);
    expect(result.fieldErrors['salaryChange.amount']).toMatch(/cannot be more than 40,000,000/);
  });

  it.each([['abc'], [0], [-5], [1.5], ['']])(
    'reports a salary change of %j under salaryChange.amount',
    (amount) => {
      const result = validateEmployeeUpdate(current, { salaryChange: { amount } }, context);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.amount']);
    },
  );

  it('rejects a hire date later than the earliest salary history entry', () => {
    const result = validateEmployeeUpdate(
      current,
      { hireDate: '2024-03-02' },
      { ...context, earliestSalaryDate: '2024-03-01' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.hireDate).toMatch(/earliest salary/i);
  });

  it('accepts a hire date equal to the earliest salary history entry', () => {
    const result = validateEmployeeUpdate(
      current,
      { hireDate: '2024-06-01' },
      { ...context, earliestSalaryDate: '2024-06-01' },
    );

    expect(result).toMatchObject({ ok: true, fields: { hireDate: '2024-06-01' } });
  });
});

describe('validateEmployeeUpdate with a dated salary change', () => {
  const current: EmployeeFields = {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    employmentType: 'Full-time',
    hireDate: '2024-03-01',
    annualSalary: 1_850_000,
  };
  const context = {
    today: TODAY,
    earliestSalaryDate: '2024-03-01',
    currentSalaryDate: '2024-03-01',
  };

  it('carries the effective date and reason of the patch into the salary change', () => {
    const result = validateEmployeeUpdate(
      current,
      { salaryChange: { amount: 2_000_000, effectiveDate: '2025-01-01', reason: ' Promotion ' } },
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      salaryChange: { amount: 2_000_000, effectiveDate: '2025-01-01', reason: 'Promotion' },
    });
  });

  it('reports date errors under salaryChange.effectiveDate', () => {
    const result = validateEmployeeUpdate(
      current,
      { salaryChange: { amount: 2_000_000, effectiveDate: '2026-12-01' } },
      context,
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: { 'salaryChange.effectiveDate': expect.stringMatching(/future/i) },
    });
  });

  it('judges the effective date against the hire date being saved', () => {
    const result = validateEmployeeUpdate(
      current,
      { hireDate: '2024-03-01', salaryChange: { amount: 2_000_000, effectiveDate: '2024-02-28' } },
      context,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toEqual(['salaryChange.effectiveDate']);
  });

  it("rejects a country change dated before the current salary's effective date", () => {
    const result = validateEmployeeUpdate(
      current,
      { country: 'JP', salaryChange: { amount: 9_500_000, effectiveDate: '2025-01-01' } },
      { ...context, currentSalaryDate: '2025-06-01' },
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        'salaryChange.effectiveDate':
          "When the country changes, the effective date can't be before the current salary's (2025-06-01)",
      },
    });
  });

  it("accepts a country change dated on the current salary's effective date", () => {
    const result = validateEmployeeUpdate(
      current,
      { country: 'JP', salaryChange: { amount: 9_500_000, effectiveDate: '2025-06-01' } },
      { ...context, currentSalaryDate: '2025-06-01' },
    );

    expect(result).toMatchObject({ ok: true, fields: { countryCode: 'JP' } });
  });

  it("still allows a backdated change in the same country before the current salary's date", () => {
    const result = validateEmployeeUpdate(
      current,
      { salaryChange: { amount: 1_900_000, effectiveDate: '2024-06-01' } },
      { ...context, currentSalaryDate: '2025-06-01' },
    );

    expect(result).toMatchObject({ ok: true, salaryChange: { effectiveDate: '2024-06-01' } });
  });

  it('judges the effective date against a hire date moved earlier in the same patch', () => {
    const result = validateEmployeeUpdate(
      current,
      {
        hireDate: '2022-01-01',
        salaryChange: { amount: 2_000_000, effectiveDate: '2022-06-01' },
      },
      context,
    );

    expect(result.ok).toBe(true);
  });
});
