import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('keeps the old value until the delay has passed without a change, then takes the new one', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current[0]).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe('ab');
  });

  it('restarts the wait on every change, so only the last value is applied', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    });

    rerender({ value: 'a' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'an' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe('');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current[0]).toBe('an');
  });

  it('applies a value straight away when asked to', () => {
    const { result } = renderHook(() => useDebouncedValue('typed', 300));

    act(() => result.current[1]('now'));

    expect(result.current[0]).toBe('now');
  });
});
