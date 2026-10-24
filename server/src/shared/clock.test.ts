import { describe, expect, it } from 'vitest';
import { fixedClock, systemClock } from './clock.ts';

describe('fixedClock', () => {
  it('always reports the given date as today', () => {
    const clock = fixedClock('2026-10-24');

    expect(clock.today()).toBe('2026-10-24');
    expect(clock.now().startsWith('2026-10-24')).toBe(true);
  });
});

describe('systemClock', () => {
  it('reports today as an ISO date in the given time zone', () => {
    expect(systemClock('UTC').today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
