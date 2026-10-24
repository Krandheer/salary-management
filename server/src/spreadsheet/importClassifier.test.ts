import { describe, expect, it } from 'vitest';
import type { EmployeeFields } from '../employees/employeeValidation.ts';
import {
  classifyImportRows,
  diffFields,
  type ExistingEmployee,
  type ImportMatch,
  type ImportSnapshot,
} from './importClassifier.ts';
import type { ParsedImportRow } from './importRowParser.ts';

const EMAIL = 'asha.rao@acme.example';

function someFields(overrides: Partial<EmployeeFields> = {}): EmployeeFields {
  return {
    fullName: 'Asha Rao',
    email: EMAIL,
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'US',
    employmentType: 'Full-time',
    hireDate: '2020-01-15',
    annualSalary: 85_000,
    ...overrides,
  };
}

function aValidRow(fields: Partial<EmployeeFields> = {}, rowNumber = 2): ParsedImportRow {
  const complete = someFields(fields);
  return { rowNumber, email: complete.email, outcome: { ok: true, fields: complete } };
}

function anInvalidRow(email: string | null, messages: string[], rowNumber = 2): ParsedImportRow {
  return { rowNumber, email, outcome: { ok: false, messages } };
}

function anExisting(overrides: Partial<ExistingEmployee> = {}): ExistingEmployee {
  return {
    id: 41,
    fields: someFields(),
    currentCurrency: 'USD',
    earliestSalaryDate: '2020-01-15',
    exitDate: null,
    ...overrides,
  };
}

function snapshotOf(entries: Record<string, Partial<ImportMatch>>): ImportSnapshot {
  return new Map(
    Object.entries(entries).map(([email, match]) => [
      email,
      { active: null, latestInactive: null, ...match },
    ]),
  );
}

const NOBODY = snapshotOf({});

describe('classifyImportRows: rows for active employees', () => {
  it('creates an employee for an email nobody has', () => {
    const fields = someFields();

    const plan = classifyImportRows([aValidRow()], NOBODY);

    expect(plan.preview.creates).toEqual([{ row: 2, email: EMAIL, rehireOf: null }]);
    expect(plan.preview.totals).toEqual({ create: 1, update: 0, unchanged: 0, error: 0 });
    expect(plan.operations).toEqual([{ kind: 'create', fields, rehireOf: null }]);
  });

  it('counts a row equal to the active employee as unchanged and plans nothing for it', () => {
    const plan = classifyImportRows(
      [aValidRow()],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.totals).toEqual({ create: 0, update: 0, unchanged: 1, error: 0 });
    expect(plan.preview.updates).toEqual([]);
    expect(plan.operations).toEqual([]);
  });

  it('updates the active employee and lists exactly the fields that change', () => {
    const row = aValidRow({ jobTitle: 'Staff Engineer', department: 'Product' }, 5);

    const plan = classifyImportRows([row], snapshotOf({ [EMAIL]: { active: anExisting() } }));

    expect(plan.preview.updates).toEqual([
      {
        row: 5,
        email: EMAIL,
        changes: [
          { field: 'Job Title', from: 'Software Engineer', to: 'Staff Engineer' },
          { field: 'Department', from: 'Engineering', to: 'Product' },
        ],
      },
    ]);
    expect(plan.operations).toEqual([
      {
        kind: 'update',
        employeeId: 41,
        fields: someFields({ jobTitle: 'Staff Engineer', department: 'Product' }),
        salaryChange: null,
      },
    ]);
  });

  it('plans a salary change when the amount differs from the current salary', () => {
    const plan = classifyImportRows(
      [aValidRow({ annualSalary: 90_000 })],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.updates[0]!.changes).toEqual([
      { field: 'Annual Salary', from: '85000', to: '90000' },
    ]);
    expect(plan.operations[0]).toMatchObject({ salaryChange: { amount: 90_000, currency: 'USD' } });
  });

  it("plans a salary change in the new country's currency when only the country changes", () => {
    const plan = classifyImportRows(
      [aValidRow({ countryCode: 'CA' })],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.updates[0]!.changes).toEqual([
      { field: 'Country', from: 'United States', to: 'Canada' },
      { field: 'Currency', from: 'USD', to: 'CAD' },
    ]);
    expect(plan.operations[0]).toMatchObject({ salaryChange: { amount: 85_000, currency: 'CAD' } });
  });

  it('keeps the stored email on an update, because it is the match key', () => {
    const row = aValidRow({ email: 'Asha.Rao@ACME.example', fullName: 'Asha R. Rao' });

    const plan = classifyImportRows([row], snapshotOf({ [EMAIL]: { active: anExisting() } }));

    expect(plan.preview.updates).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({ kind: 'update', fields: { email: EMAIL } });
  });

  it('allows an earlier hire date', () => {
    const plan = classifyImportRows(
      [aValidRow({ hireDate: '2019-06-01' })],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.updates[0]!.changes).toEqual([
      { field: 'Hire Date', from: '2020-01-15', to: '2019-06-01' },
    ]);
  });

  it('rejects a hire date later than the earliest salary entry', () => {
    const plan = classifyImportRows(
      [aValidRow({ hireDate: '2020-02-01' }, 3)],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.errors).toEqual([
      {
        row: 3,
        email: EMAIL,
        messages: [
          'Hire Date: Hire date cannot be later than the earliest salary entry (2020-01-15)',
        ],
      },
    ]);
    expect(plan.operations).toEqual([]);
  });

  it('matches the active employee even when inactive records share the email', () => {
    const plan = classifyImportRows(
      [aValidRow()],
      snapshotOf({
        [EMAIL]: {
          active: anExisting(),
          latestInactive: anExisting({ id: 7, exitDate: '2019-01-01' }),
        },
      }),
    );

    expect(plan.preview.totals.unchanged).toBe(1);
  });
});

describe('classifyImportRows: rows for inactive employees', () => {
  const inactive = anExisting({ id: 12, exitDate: '2024-05-01' });
  const onlyInactive = snapshotOf({ [EMAIL]: { latestInactive: inactive } });

  it('counts a row equal to the most recent inactive record as unchanged', () => {
    const plan = classifyImportRows([aValidRow()], onlyInactive);

    expect(plan.preview.totals).toEqual({ create: 0, update: 0, unchanged: 1, error: 0 });
    expect(plan.operations).toEqual([]);
  });

  it('creates a rehire linked to the inactive record when the hire date is after its exit date', () => {
    const fields = someFields({ hireDate: '2024-05-02', annualSalary: 95_000 });

    const plan = classifyImportRows([aValidRow(fields, 4)], onlyInactive);

    expect(plan.preview.creates).toEqual([{ row: 4, email: EMAIL, rehireOf: 12 }]);
    expect(plan.operations).toEqual([{ kind: 'create', fields, rehireOf: 12 }]);
  });

  it('rejects any other change, explaining that inactive records cannot be changed', () => {
    const plan = classifyImportRows(
      [aValidRow({ hireDate: '2024-05-01', jobTitle: 'Lead' })],
      onlyInactive,
    );

    expect(plan.preview.errors).toEqual([
      {
        row: 2,
        email: EMAIL,
        messages: [
          "Work Email: Employee #12 is inactive and can't be changed; a rehire needs a hire date after their exit date (2024-05-01)",
        ],
      },
    ]);
    expect(plan.operations).toEqual([]);
  });
});

describe('classifyImportRows: errors across the file', () => {
  it('rejects every row whose email appears more than once, ignoring letter case', () => {
    const rows = [
      aValidRow({ email: EMAIL }, 2),
      aValidRow({ email: 'bela.roy@acme.example' }, 3),
      aValidRow({ email: 'ASHA.RAO@acme.example' }, 4),
    ];

    const plan = classifyImportRows(rows, NOBODY);

    expect(plan.preview.errors).toEqual([
      { row: 2, email: EMAIL, messages: ['Work Email: Duplicate email in file'] },
      { row: 4, email: 'asha.rao@acme.example', messages: ['Work Email: Duplicate email in file'] },
    ]);
    expect(plan.preview.creates).toEqual([
      { row: 3, email: 'bela.roy@acme.example', rehireOf: null },
    ]);
    expect(plan.operations).toHaveLength(1);
  });

  it('adds the duplicate message to a row that already has other errors', () => {
    const rows = [aValidRow({}, 2), anInvalidRow(EMAIL, ['Full Name: Full name is required'], 3)];

    const plan = classifyImportRows(rows, NOBODY);

    expect(plan.preview.errors.map((error) => error.messages)).toEqual([
      ['Work Email: Duplicate email in file'],
      ['Full Name: Full name is required', 'Work Email: Duplicate email in file'],
    ]);
  });

  it('reports a row with parse errors as an error, with its email', () => {
    const plan = classifyImportRows(
      [anInvalidRow(EMAIL, ['Currency: Currency must be USD for United States'], 9)],
      snapshotOf({ [EMAIL]: { active: anExisting() } }),
    );

    expect(plan.preview.errors).toEqual([
      { row: 9, email: EMAIL, messages: ['Currency: Currency must be USD for United States'] },
    ]);
    expect(plan.preview.totals).toEqual({ create: 0, update: 0, unchanged: 0, error: 1 });
  });

  it('does not treat rows without an email as duplicates of each other', () => {
    const rows = [
      anInvalidRow(null, ['Work Email: Work email is required'], 2),
      anInvalidRow(null, ['Work Email: Work email is required'], 3),
    ];

    const plan = classifyImportRows(rows, NOBODY);

    expect(plan.preview.errors.map((error) => error.messages)).toEqual([
      ['Work Email: Work email is required'],
      ['Work Email: Work email is required'],
    ]);
  });

  it('totals every outcome and keeps each list in row order', () => {
    const existing = snapshotOf({
      'same@acme.example': {
        active: anExisting({ fields: someFields({ email: 'same@acme.example' }) }),
      },
      'moved@acme.example': {
        active: anExisting({ id: 2, fields: someFields({ email: 'moved@acme.example' }) }),
      },
    });
    const rows = [
      aValidRow({ email: 'new.two@acme.example' }, 6),
      aValidRow({ email: 'same@acme.example' }, 2),
      aValidRow({ email: 'moved@acme.example', department: 'Sales' }, 3),
      anInvalidRow('bad@acme.example', ['Full Name: Full name is required'], 4),
      aValidRow({ email: 'new.one@acme.example' }, 5),
    ];

    const plan = classifyImportRows(rows, existing);

    expect(plan.preview.totals).toEqual({ create: 2, update: 1, unchanged: 1, error: 1 });
    expect(plan.preview.creates.map((create) => create.row)).toEqual([5, 6]);
  });
});

describe('diffFields', () => {
  it('shows salary and hire date as plain text and the country by name', () => {
    const existing = anExisting();
    const incoming = someFields({
      annualSalary: 1_850_000,
      countryCode: 'IN',
      hireDate: '2019-12-31',
    });

    expect(diffFields(existing, incoming)).toEqual([
      { field: 'Country', from: 'United States', to: 'India' },
      { field: 'Currency', from: 'USD', to: 'INR' },
      { field: 'Annual Salary', from: '85000', to: '1850000' },
      { field: 'Hire Date', from: '2020-01-15', to: '2019-12-31' },
    ]);
  });

  it('treats a change of letter case in the name as a change', () => {
    expect(diffFields(anExisting(), someFields({ fullName: 'ASHA RAO' }))).toEqual([
      { field: 'Full Name', from: 'Asha Rao', to: 'ASHA RAO' },
    ]);
  });

  it('finds no change when every field is equal', () => {
    expect(diffFields(anExisting(), someFields())).toEqual([]);
  });
});
