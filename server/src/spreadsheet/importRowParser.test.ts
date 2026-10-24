import { describe, expect, it } from 'vitest';
import { parseImportRow, type ParsedImportRow } from './importRowParser.ts';
import { TEMPLATE_COLUMNS, type TemplateField } from './templateColumns.ts';
import type { RawCellValue, RawImportRow } from './workbookReader.ts';

const TODAY = '2026-10-24';

const VALID_CELLS: Record<TemplateField, RawCellValue> = {
  fullName: 'Asha Rao',
  email: 'asha.rao@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'India',
  currency: 'INR',
  annualSalary: 2_500_000,
  employmentType: 'Full-time',
  hireDate: new Date('2021-03-15T00:00:00.000Z'),
};

function aRawRow(
  overrides: Partial<Record<TemplateField, RawCellValue>> = {},
  rowNumber = 2,
): RawImportRow {
  const cells = { ...VALID_CELLS, ...overrides };
  return { rowNumber, cells: TEMPLATE_COLUMNS.map(({ key }) => cells[key]) };
}

function messagesOf(parsed: ParsedImportRow): string[] {
  if (parsed.outcome.ok) throw new Error('Expected the row to have errors');
  return parsed.outcome.messages;
}

function fieldsOf(parsed: ParsedImportRow) {
  if (!parsed.outcome.ok)
    throw new Error(`Unexpected errors: ${parsed.outcome.messages.join('; ')}`);
  return parsed.outcome.fields;
}

describe('parseImportRow: a valid row', () => {
  it('turns the cells into employee fields with the country code and an ISO hire date', () => {
    const parsed = parseImportRow(aRawRow(), TODAY);

    expect(fieldsOf(parsed)).toEqual({
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      employmentType: 'Full-time',
      hireDate: '2021-03-15',
      annualSalary: 2_500_000,
    });
  });

  it('keeps the spreadsheet row number', () => {
    expect(parseImportRow(aRawRow({}, 7), TODAY).rowNumber).toBe(7);
  });

  it('trims text and stores the email in lower case', () => {
    const parsed = parseImportRow(
      aRawRow({ fullName: '  Asha Rao ', email: ' Asha.Rao@ACME.example ' }),
      TODAY,
    );

    expect(parsed.email).toBe('asha.rao@acme.example');
    expect(fieldsOf(parsed)).toMatchObject({
      fullName: 'Asha Rao',
      email: 'asha.rao@acme.example',
    });
  });

  it('matches country, department and employment type ignoring letter case and spaces', () => {
    const parsed = parseImportRow(
      aRawRow({
        country: ' united KINGDOM ',
        currency: 'GBP',
        annualSalary: 60_000,
        department: 'customer support ',
        employmentType: ' PART-TIME',
      }),
      TODAY,
    );

    expect(fieldsOf(parsed)).toMatchObject({
      countryCode: 'GB',
      department: 'Customer Support',
      employmentType: 'Part-time',
    });
  });

  it('accepts the currency in any letter case', () => {
    expect(parseImportRow(aRawRow({ currency: ' inr ' }), TODAY).outcome.ok).toBe(true);
  });
});

describe('parseImportRow: Annual Salary', () => {
  it('accepts text made only of digits', () => {
    expect(fieldsOf(parseImportRow(aRawRow({ annualSalary: ' 85000 ' }), TODAY)).annualSalary).toBe(
      85_000,
    );
  });

  it.each([['85,000'], ['INR 85000'], ['₹85000'], [85_000.5]])(
    'rejects %o as not a whole number',
    (annualSalary) => {
      const parsed = parseImportRow(aRawRow({ annualSalary }), TODAY);

      expect(messagesOf(parsed)).toEqual(['Annual Salary: Annual salary must be a whole number']);
    },
  );

  it('rejects a salary above the country maximum with the shared rule', () => {
    const parsed = parseImportRow(aRawRow({ annualSalary: 4_000_000_001 }), TODAY);

    expect(messagesOf(parsed)).toEqual([
      'Annual Salary: Annual salary cannot be more than 4,000,000,000',
    ]);
  });
});

describe('parseImportRow: Hire Date', () => {
  it('accepts text in YYYY-MM-DD form', () => {
    expect(fieldsOf(parseImportRow(aRawRow({ hireDate: '2024-01-31' }), TODAY)).hireDate).toBe(
      '2024-01-31',
    );
  });

  it.each([[45_322], ['31/01/2024'], ['2024-02-30']])('rejects %o as not a date', (hireDate) => {
    const parsed = parseImportRow(aRawRow({ hireDate }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Hire Date: Hire date must be a valid date']);
  });

  it('rejects a future hire date with the shared rule', () => {
    const parsed = parseImportRow(aRawRow({ hireDate: '2026-10-25' }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Hire Date: Hire date cannot be in the future']);
  });
});

describe('parseImportRow: Currency', () => {
  it("rejects a currency that is not the country's currency", () => {
    const parsed = parseImportRow(aRawRow({ currency: 'USD' }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Currency: Currency must be INR for India']);
  });

  it('rejects an empty currency', () => {
    const parsed = parseImportRow(aRawRow({ currency: null }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Currency: Currency must be INR for India']);
  });

  it('rejects a country code in place of the country name', () => {
    const parsed = parseImportRow(aRawRow({ country: 'IN' }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Country: Country must be one of the listed options']);
  });

  it('does not judge the currency when the country is not recognised', () => {
    const parsed = parseImportRow(aRawRow({ country: 'Narnia', currency: 'NAR' }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Country: Country must be one of the listed options']);
  });
});

describe('parseImportRow: shared validation messages', () => {
  it('prefixes every message with its column header and lists them in column order', () => {
    const parsed = parseImportRow(
      aRawRow({
        fullName: '   ',
        email: 'not-an-email',
        jobTitle: null,
        department: 'Catering',
        employmentType: 'Intern',
        hireDate: null,
      }),
      TODAY,
    );

    expect(messagesOf(parsed)).toEqual([
      'Full Name: Full name is required',
      'Work Email: Work email must look like name@company.com',
      'Job Title: Job title is required',
      'Department: Department must be one of the listed options',
      'Employment Type: Employment type must be one of the listed options',
      'Hire Date: Hire date is required',
    ]);
  });

  it('reports the row email, lower-cased, even when the row has errors', () => {
    const parsed = parseImportRow(
      aRawRow({ email: 'ASHA.RAO@acme.example', fullName: null }),
      TODAY,
    );

    expect(parsed.email).toBe('asha.rao@acme.example');
  });

  it('reports no email when the email cell is empty', () => {
    const parsed = parseImportRow(aRawRow({ email: null }), TODAY);

    expect(parsed.email).toBeNull();
    expect(messagesOf(parsed)).toEqual(['Work Email: Work email is required']);
  });

  it('rejects an empty country with the shared rule', () => {
    const parsed = parseImportRow(aRawRow({ country: null }), TODAY);

    expect(messagesOf(parsed)).toEqual(['Country: Country is required']);
  });
});
