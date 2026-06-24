'use client';

import { useEffect, useState } from 'react';
import { AppError } from '@/lib/errors';
import {
  getExcludedLogicalDatabases,
  getTestedLogicalDatabases,
} from '@/app/lib/api/logical-db';
import { buildModalData } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import type {
  LogicalDbDataHook,
  LogicalDbDataState,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

/**
 * Loads the Step 5 logical-DB modal data: the discovered (tested) DBs for the
 * left panel and the current skip policy for the right panel, fetched in
 * parallel by `resourceId` (the modal's only key — spec B §6 D-1). The adapter
 * (`buildModalData`) maps them to the modal's render rows + a seeded initial
 * draft (existing skips pre-applied / greyed-out).
 *
 * Keeps the loading/ready/error state machine + retry/abort idiom: the active
 * key (`targetSourceId#resourceId#nonce`) resets state to `loading` during
 * render on change, and each fetch is cancelled via an AbortController.
 */
export const useLogicalDatabases = (
  targetSourceId: number,
  resourceId: string,
): LogicalDbDataHook => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<LogicalDbDataState>({ status: 'loading' });

  // Track the key the current state corresponds to so we can reset to 'loading'
  // during render when the target/resource or retry nonce changes — avoids a
  // synchronous setState inside useEffect.
  const fetchKey = `${targetSourceId}#${resourceId}#${retryNonce}`;
  const [activeKey, setActiveKey] = useState(fetchKey);
  if (fetchKey !== activeKey) {
    setActiveKey(fetchKey);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      getTestedLogicalDatabases(targetSourceId, resourceId, { signal: controller.signal }),
      getExcludedLogicalDatabases(targetSourceId, resourceId, { signal: controller.signal }),
    ])
      .then(([tested, excluded]) => {
        if (controller.signal.aborted) return;
        const { databases, initialDraft } = buildModalData(tested, excluded);
        setState({ status: 'ready', databases, initialDraft });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: '논리 DB 정보를 불러오지 못했습니다.' });
      });

    return () => controller.abort();
  }, [targetSourceId, resourceId, retryNonce]);

  return {
    state,
    retry: () => setRetryNonce((n) => n + 1),
  };
};
