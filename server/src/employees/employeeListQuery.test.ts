import { describe, expect, it } from 'vitest';
import { InvalidQueryError } from '../shared/errors.ts';
import { parseEmployeeFilters, parseEmployeeListQuery } from './employeeListQuery.ts';

const NO_FILTERS = { searchKey: null, country: null, department: null, jobTitleKey: null };

describe('parseEmployeeListQuery', () => {
  it('defaults to the first page of active employees', () => {
    expect(parseEmployeeListQuery({})).toEqual({
      page: 1,
      status: 'active',
      ...NO_FILTERS,
    });
  });

  it('reads a page number and a status', () => {
    expect(parseEmployeeListQuery({ page: '3', status: 'inactive' })).toEqual({
      page: 3,
      status: 'inactive',
      ...NO_FILTERS,
    });
  });

  it.each(['0', '-1', 'abc', '1.5', '', ' ', '1e2', '9007199254740993'])(
    'rejects page %j',
    (page) => {
      expect(() => parseEmployeeListQuery({ page })).toThrow(InvalidQueryError);
    },
  );

  it('rejects a page given more than once', () => {
    expect(() => parseEmployeeListQuery({ page: ['1', '2'] })).toThrow(InvalidQueryError);
  });

  it.each(['deleted', 'ACTIVE', ''])('rejects status %j', (status) => {
    expect(() => parseEmployeeListQuery({ status })).toThrow(InvalidQueryError);
  });
});

describe('parseEmployeeFilters', () => {
  it('has no filters by default and defaults to active employees', () => {
    expect(parseEmployeeFilters({})).toEqual({ status: 'active', ...NO_FILTERS });
  });

  it('trims and lower-cases the search text', () => {
    expect(parseEmployeeFilters({ search: '  ANa  ' }).searchKey).toBe('ana');
  });

  it.each(['', '   '])('treats the search %j as no search', (search) => {
    expect(parseEmployeeFilters({ search }).searchKey).toBeNull();
  });

  it('trims and lower-cases the job title', () => {
    expect(parseEmployeeFilters({ jobTitle: '  Software ENGINEER ' }).jobTitleKey).toBe(
      'software engineer',
    );
  });

  it.each(['', '  '])('treats the job title %j as no job title filter', (jobTitle) => {
    expect(parseEmployeeFilters({ jobTitle }).jobTitleKey).toBeNull();
  });

  it('accepts a known country and a known department', () => {
    expect(parseEmployeeFilters({ country: 'IN', department: 'Finance' })).toMatchObject({
      country: 'IN',
      department: 'Finance',
    });
  });

  it.each(['XX', 'in', '', 'India'])('rejects the unknown country %j', (country) => {
    expect(() => parseEmployeeFilters({ country })).toThrow(InvalidQueryError);
  });

  it.each(['Kitchen', 'finance', '', "Finance'; DROP TABLE employees;--"])(
    'rejects the unknown department %j',
    (department) => {
      expect(() => parseEmployeeFilters({ department })).toThrow(InvalidQueryError);
    },
  );

  it.each(['search', 'jobTitle', 'country', 'department'])(
    'rejects %s given more than once',
    (key) => {
      expect(() => parseEmployeeFilters({ [key]: ['a', 'b'] })).toThrow(InvalidQueryError);
    },
  );

  it('carries the filters through parseEmployeeListQuery together with the page', () => {
    expect(
      parseEmployeeListQuery({ page: '2', search: 'Ana', country: 'US', department: 'Design' }),
    ).toEqual({
      page: 2,
      status: 'active',
      searchKey: 'ana',
      country: 'US',
      department: 'Design',
      jobTitleKey: null,
    });
  });
});
