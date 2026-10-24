import { describe, expect, it } from 'vitest';
import { asRecord } from './records.ts';

describe('asRecord', () => {
  it('returns a plain object as it is', () => {
    const body = { name: 'Asha' };

    expect(asRecord(body)).toBe(body);
  });

  it.each([undefined, null, 'text', 42, true, ['a', 'b']])(
    'treats %j as an empty record',
    (value) => {
      expect(asRecord(value)).toEqual({});
    },
  );
});
