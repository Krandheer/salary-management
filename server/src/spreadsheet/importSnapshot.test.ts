import { describe, expect, it } from 'vitest';
import type { StoredEmployee } from '../employees/employeeReadModels.ts';
import { buildImportSnapshot } from './importSnapshot.ts';

const EMAIL = 'asha.rao@acme.example';

function aStored(overrides: Partial<StoredEmployee> = {}): StoredEmployee {
  return {
    id: 1,
    status: 'active',
    fields: {
      fullName: 'Asha Rao',
      email: EMAIL,
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'US',
      employmentType: 'Full-time',
      hireDate: '2020-01-15',
      annualSalary: 90_000,
    },
    currentCurrency: 'USD',
    currentSalaryDate: '2020-01-15',
    earliestSalaryDate: '2020-01-15',
    exitDate: null,
    ...overrides,
  };
}

function inactive(id: number, exitDate: string): StoredEmployee {
  return aStored({ id, status: 'inactive', exitDate });
}

describe('buildImportSnapshot', () => {
  it('is empty when nobody is stored', () => {
    expect(buildImportSnapshot([]).size).toBe(0);
  });

  it('holds the active record and no inactive ones for an email that never left', () => {
    const match = buildImportSnapshot([aStored({ id: 7 })]).get(EMAIL);

    expect(match?.active?.id).toBe(7);
    expect(match?.inactive).toEqual([]);
  });

  it('lists inactive records with the most recent exit first, whatever order they arrive in', () => {
    const match = buildImportSnapshot([
      inactive(1, '2021-03-01'),
      inactive(2, '2023-06-30'),
      inactive(3, '2022-01-01'),
    ]).get(EMAIL);

    expect(match?.active).toBeNull();
    expect(match?.inactive.map((record) => record.id)).toEqual([2, 3, 1]);
  });

  it('puts the later record first when two inactive records exited on the same day', () => {
    const match = buildImportSnapshot([inactive(4, '2022-05-05'), inactive(9, '2022-05-05')]).get(
      EMAIL,
    );

    expect(match?.inactive.map((record) => record.id)).toEqual([9, 4]);
  });

  it('keeps the active record apart from the inactive ones of the same email', () => {
    const match = buildImportSnapshot([inactive(1, '2021-03-01'), aStored({ id: 5 })]).get(EMAIL);

    expect(match?.active?.id).toBe(5);
    expect(match?.inactive.map((record) => record.id)).toEqual([1]);
  });

  it('carries the fields the import compares, not the status', () => {
    const match = buildImportSnapshot([inactive(2, '2023-06-30')]).get(EMAIL);

    expect(match?.inactive[0]).toEqual({
      id: 2,
      fields: aStored().fields,
      currentCurrency: 'USD',
      earliestSalaryDate: '2020-01-15',
      exitDate: '2023-06-30',
    });
  });

  it('keeps different emails apart', () => {
    const other = aStored({ id: 8, fields: { ...aStored().fields, email: 'b@acme.example' } });

    const snapshot = buildImportSnapshot([aStored(), other]);

    expect([...snapshot.keys()].sort()).toEqual([EMAIL, 'b@acme.example']);
  });
});
