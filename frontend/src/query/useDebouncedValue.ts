/**
 * Назначение: debounce значения для автопересчёта calc.
 */

import { useEffect, useState } from 'react';

/**
 * @param value — исходное значение
 * @param delayMs — задержка, мс
 * @returns debounced-значение
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebounced(value); }, delayMs);
    return () => { window.clearTimeout(timer); };
  }, [value, delayMs]);

  return debounced;
}
