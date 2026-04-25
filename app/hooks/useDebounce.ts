'use client';

import { useEffect, useState } from 'react';

/**
 * Returns a debounced echo of `value` that only updates after `delayMs`
 * has elapsed without further changes. Each new input restarts the
 * timer, so a typing burst yields a single trailing render at the end.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-c-preview.md §Step 5 +
 * design/guide-cms/interactions.md §3 (250ms preview debounce).
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
