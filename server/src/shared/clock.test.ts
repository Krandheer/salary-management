import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, systemClock } from './clock.ts';

afterEach(() => vi.useRealTimers());

describe('fixedClock', () => {
  it('always reports the given date as today', () => {
    const clock = fixedClock('2026-10-24');

    expect(clock.today()).toBe('2026-10-24');
    expect(clock.now().startsWith('2026-10-24')).toBe(true);
  });
});

describe('systemClock', () => {
  it('reports the calendar date of the current instant in the given time zone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T20:30:00.000Z'));

    expect(systemClock('UTC').today()).toBe('2026-10-24');
    expect(systemClock('Asia/Kolkata').today()).toBe('2026-10-25');
    expect(systemClock('America/Los_Angeles').today()).toBe('2026-10-24');
  });

  it('reports now as the current instant in UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T20:30:00.000Z'));

    expect(systemClock('Asia/Kolkata').now()).toBe('2026-10-24T20:30:00.000Z');
  });
});
