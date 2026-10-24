import { describe, expect, it } from 'vitest';
import {
  isWellFormedEmail,
  validateAnnualSalary,
  validateCountry,
  validateDepartment,
  validateEmail,
  validateEmployeeFields,
  validateEmployeeUpdate,
  validateEmploymentType,
  validateFullName,
  validateHireDate,
  validateExitDate,
  validateJobTitle,
  validateRehireHireDate,
  validateSalaryChange,
} from './employeeValidation.ts';
import type { EmployeeFields } from './employeeValidation.ts';

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

describe('required text fields', () => {
  it.each([
    ['full name', validateFullName],
    ['work email', validateEmail],
    ['job title', validateJobTitle],
  ])('%s is required when missing, empty or only spaces', (_label, validate) => {
    expect(validate(undefined)).toMatch(/required/i);
    expect(validate('')).toMatch(/required/i);
    expect(validate('   ')).toMatch(/required/i);
    expect(validate(null)).toMatch(/required/i);
  });

  it('accepts a full name with non-Latin characters and no length limit', () => {
    expect(validateFullName('田中 太郎')).toBeNull();
    expect(validateFullName('A'.repeat(5000))).toBeNull();
  });

  it('accepts any non-blank job title', () => {
    expect(validateJobTitle('  Head of Everything  ')).toBeNull();
  });
});

describe('work email format', () => {
  it.each(['asha@acme.example', 'a.b+c@sub.domain.co', '  padded@acme.example  '])(
    'accepts %s',
    (value) => {
      expect(validateEmail(value)).toBeNull();
    },
  );

  it.each([
    ['no @', 'asha.acme.example'],
    ['two @', 'a@b@acme.example'],
    ['a space', 'asha rao@acme.example'],
    ['no dot in the domain', 'asha@acme'],
    ['an empty local part', '@acme.example'],
    ['a trailing dot in the domain', 'asha@acme.'],
  ])('rejects an email with %s', (_label, value) => {
    expect(isWellFormedEmail(value)).toBe(false);
    expect(validateEmail(value)).toMatch(/email/i);
  });
});

describe('department, country and employment type', () => {
  it('accepts the listed values', () => {
    expect(validateDepartment('Customer Support')).toBeNull();
    expect(validateCountry('JP')).toBeNull();
    expect(validateEmploymentType('Contractor')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateDepartment('')).toMatch(/required/i);
    expect(validateCountry(undefined)).toMatch(/required/i);
    expect(validateEmploymentType('  ')).toMatch(/required/i);
  });

  it('rejects values outside the fixed lists', () => {
    expect(validateDepartment('Astrology')).toMatch(/department/i);
    expect(validateCountry('XX')).toMatch(/country/i);
    expect(validateEmploymentType('Intern')).toMatch(/employment type/i);
  });
});

describe('annual salary', () => {
  it('is required', () => {
    expect(validateAnnualSalary(undefined, 'US')).toMatch(/required/i);
    expect(validateAnnualSalary('', 'US')).toMatch(/required/i);
  });

  it.each([1.5, '1.5', 'abc', '12abc', NaN])('rejects %s as not a whole number', (value) => {
    expect(validateAnnualSalary(value, 'US')).toMatch(/whole number/i);
  });

  it.each([0, -1, '0', '-5'])('rejects %s as not greater than zero', (value) => {
    expect(validateAnnualSalary(value, 'US')).toMatch(/greater than zero/i);
  });

  it('accepts exactly the country maximum and rejects one above it', () => {
    expect(validateAnnualSalary(50_000_000, 'US')).toBeNull();
    expect(validateAnnualSalary(50_000_001, 'US')).toMatch(/50,000,000/);
    expect(validateAnnualSalary(4_000_000_000, 'IN')).toBeNull();
    expect(validateAnnualSalary(4_000_000_001, 'IN')).toMatch(/4,000,000,000/);
  });

  it('accepts a whole number typed as text', () => {
    expect(validateAnnualSalary('85000', 'US')).toBeNull();
  });

  it('skips the maximum check when the country itself is invalid', () => {
    expect(validateAnnualSalary(999_999_999_999, 'XX')).toBeNull();
    expect(validateAnnualSalary(999_999_999_999, undefined)).toBeNull();
  });
});

describe('hire date', () => {
  it('is required', () => {
    expect(validateHireDate(undefined, TODAY)).toMatch(/required/i);
    expect(validateHireDate('', TODAY)).toMatch(/required/i);
  });

  it.each(['1950-01-01', '2000-02-29', TODAY])('accepts %s', (value) => {
    expect(validateHireDate(value, TODAY)).toBeNull();
  });

  it('rejects the day before 1950-01-01', () => {
    expect(validateHireDate('1949-12-31', TODAY)).toMatch(/1950-01-01/);
  });

  it('rejects a date after today', () => {
    expect(validateHireDate('2026-10-25', TODAY)).toMatch(/future/i);
  });

  it.each(['2026-02-30', 'yesterday', '2026-1-5', 20260101])(
    'rejects %s as not a real date',
    (value) => {
      expect(validateHireDate(value, TODAY)).toMatch(/valid date/i);
    },
  );
});

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
  const context = { today: TODAY, earliestSalaryDate: '2024-03-01' };

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
  const context = { today: TODAY, earliestSalaryDate: '2024-03-01' };

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

describe('validateExitDate', () => {
  const context = { today: TODAY, hireDate: '2024-03-01' };

  it('accepts a date between the hire date and today, inclusive of both ends', () => {
    expect(validateExitDate('2025-06-30', context)).toBeNull();
    expect(validateExitDate('2024-03-01', context)).toBeNull();
    expect(validateExitDate(TODAY, context)).toBeNull();
  });

  it('rejects a date in the future', () => {
    expect(validateExitDate('2026-10-25', context)).toBe('Exit date cannot be in the future');
  });

  it('rejects a date before the hire date', () => {
    expect(validateExitDate('2024-02-29', context)).toBe(
      'Exit date cannot be before the hire date',
    );
  });

  it.each([['2025-02-30'], ['soon'], [20250101], [['2025-01-01', '2025-01-02']], [null]])(
    'rejects %j as not a valid date',
    (value) => {
      expect(validateExitDate(value, context)).toBe('Exit date must be a valid date');
    },
  );
});

describe('validateRehireHireDate', () => {
  it('accepts any hire date when there is no earlier inactive record', () => {
    expect(validateRehireHireDate('2024-03-01', null)).toBeNull();
  });

  it('rejects a hire date equal to the latest exit date', () => {
    expect(validateRehireHireDate('2025-06-30', '2025-06-30')).toBe(
      'Hire date must be after the previous exit date (2025-06-30)',
    );
  });

  it('rejects a hire date before the latest exit date', () => {
    expect(validateRehireHireDate('2025-06-29', '2025-06-30')).not.toBeNull();
  });

  it('accepts a hire date the day after the latest exit date', () => {
    expect(validateRehireHireDate('2025-07-01', '2025-06-30')).toBeNull();
  });
});
