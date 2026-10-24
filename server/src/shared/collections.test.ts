import { describe, expect, it } from 'vitest';
import { groupBy } from './collections.ts';

describe('groupBy', () => {
  it('returns no groups for no items', () => {
    expect(groupBy([], (item: number) => item).size).toBe(0);
  });

  it('collects items under their key, keeping the order within each group', () => {
    const groups = groupBy(['apple', 'avocado', 'banana', 'apricot'], (word) => word[0]);

    expect(groups.get('a')).toEqual(['apple', 'avocado', 'apricot']);
    expect(groups.get('b')).toEqual(['banana']);
  });

  it('lists keys in the order they were first seen', () => {
    const groups = groupBy([3, 1, 3, 2, 1], (n) => n);

    expect([...groups.keys()]).toEqual([3, 1, 2]);
  });

  it('accepts any iterable, not just arrays', () => {
    const groups = groupBy(new Set([1, 2, 3, 4]), (n) => n % 2);

    expect(groups.get(0)).toEqual([2, 4]);
    expect(groups.get(1)).toEqual([1, 3]);
  });

  it('groups a large input in linear time by pushing, not copying', () => {
    const items = Array.from({ length: 200_000 }, (_, i) => i);

    const startedAt = performance.now();
    const groups = groupBy(items, () => 'all');

    expect(groups.get('all')).toHaveLength(200_000);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
