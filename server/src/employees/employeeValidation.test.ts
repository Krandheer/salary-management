import { describe, expect, it } from 'vitest';
import { validateEmployeeFields } from './employeeValidation.ts';

const TODAY = '2026-10-24';

function aValidInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Asha Rao',
    email: 'asha.rao@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    country: 'IN',
    annualSalary: 1_850_000,
    employmentType: 'Full-time',
    hireDate: '2024-03-01',
    ...overrides,
  };
}

describe('validateEmployeeFields', () => {
  it('returns normalised fields for valid input', () => {
    const result = validateEmployeeFields(
      aValidInput({
        fullName: '  Asha Rao ',
        email: '  Asha.Rao@ACME.example ',
        jobTitle: ' Software Engineer  ',
        annualSalary: '1850000',
      }),
      { today: TODAY },
    );

    expect(result).toEqual({
      ok: true,
      fields: {
        fullName: 'Asha Rao',
        email: 'asha.rao@acme.example',
        jobTitle: 'Software Engineer',
        department: 'Engineering',
        countryCode: 'IN',
        employmentType: 'Full-time',
        hireDate: '2024-03-01',
        annualSalary: 1_850_000,
      },
    });
  });

  it('reports every invalid field at once, keyed by request field name', () => {
    const result = validateEmployeeFields(
      {
        fullName: '   ',
        email: 'nope',
        jobTitle: '',
        department: 'Astrology',
        country: 'XX',
        annualSalary: 0,
        employmentType: '',
        hireDate: '2999-01-01',
      },
      { today: TODAY },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'annualSalary',
      'country',
      'department',
      'email',
      'employmentType',
      'fullName',
      'hireDate',
      'jobTitle',
    ]);
  });

  it('reports every field as required for an empty input', () => {
    const result = validateEmployeeFields({}, { today: TODAY });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toHaveLength(8);
  });

  it('checks the salary maximum against the chosen country', () => {
    const result = validateEmployeeFields(
      aValidInput({ country: 'US', annualSalary: 50_000_001 }),
      {
        today: TODAY,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors)).toEqual(['annualSalary']);
  });
});
