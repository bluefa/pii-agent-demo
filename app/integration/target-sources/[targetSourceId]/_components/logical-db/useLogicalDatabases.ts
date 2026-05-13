'use client';

import { useEffect, useState } from 'react';
import type {
  LogicalDatabase,
  LogicalDbDataHook,
  LogicalDbDataState,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

/**
 * Local stub for logical-database data.
 *
 * BFF endpoint is not implemented. This hook returns a deterministic
 * fake list keyed on resourceId so the modal renders for any row. When
 * the BFF endpoint lands, replace the body with a real fetch call —
 * the hook's return shape is the BFF integration contract.
 */
export const useLogicalDatabases = (resourceId: string): LogicalDbDataHook => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<LogicalDbDataState>({ status: 'loading' });
  // Track the key the current state corresponds to so we can reset to 'loading'
  // during render when the resourceId or retry nonce changes — avoids a
  // synchronous setState inside useEffect.
  const fetchKey = `${resourceId}#${retryNonce}`;
  const [activeKey, setActiveKey] = useState(fetchKey);
  if (fetchKey !== activeKey) {
    setActiveKey(fetchKey);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const databases = buildFakeDatabases(resourceId);
      setState({ status: 'ready', databases });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [resourceId, retryNonce]);

  return {
    state,
    retry: () => setRetryNonce((n) => n + 1),
  };
};

const buildFakeDatabases = (resourceId: string): LogicalDatabase[] => {
  // Deterministic fake list keyed on resourceId so the modal looks plausible.
  // Length 12 to exercise scroll + search + pagination paths.
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${resourceId}.db_${String(i + 1).padStart(2, '0')}`,
    name: `db_${String(i + 1).padStart(2, '0')}`,
  }));
};
