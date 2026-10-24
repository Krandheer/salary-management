import { useCallback, useEffect, useState } from 'react';

/**
 * The latest `value`, once it has stopped changing for `delayMs`, and a way to
 * apply a value straight away (skipping the wait).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  const applyNow = useCallback((next: T) => setDebounced(next), []);
  return [debounced, applyNow];
}
