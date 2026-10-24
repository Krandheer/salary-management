import { describe, expect, it } from 'vitest';
import { InvalidQueryError } from '../shared/errors.ts';
import { parseEmployeeListQuery } from './employeeListQuery.ts';

describe('parseEmployeeListQuery', () => {
  it('defaults to the first page of active employees', () => {
    expect(parseEmployeeListQuery({})).toEqual({ page: 1, status: 'active' });
  });

  it('reads a page number and a status', () => {
    expect(parseEmployeeListQuery({ page: '3', status: 'inactive' })).toEqual({
      page: 3,
      status: 'inactive',
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
