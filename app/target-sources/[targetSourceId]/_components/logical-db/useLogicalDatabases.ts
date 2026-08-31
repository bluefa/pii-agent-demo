'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/app/components/LocaleProvider';
import { CANDIDATE_COPY } from '@/app/target-sources/[targetSourceId]/_components/candidate/copy';
import {
  getExcludedLogicalDatabases,
  getTestedLogicalDatabases,
} from '@/app/lib/api/logical-db';
import type { TcScope } from '@/app/lib/api/tc-scope';
import { buildModalData } from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-deny';
import type {
  LogicalDbDataHook,
  LogicalDbDataState,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

/**
 * Loads the Step 5 logical-DB modal data: the discovered (tested) DBs for the
 * left panel and the current skip policy for the right panel, fetched in
 * parallel by `resourceId` (the modal's only key — spec B §6 D-1). The adapter
 * (`buildModalData`) maps them to the modal's render rows + a seeded initial
 * draft (existing skips pre-applied / greyed-out).
 *
 * `scope` picks which connection-test run the tested list comes from — Step 5 reads the
 * latest run, Steps 6·7 read the last one that passed. It is part of the active key: two
 * scopes on the same resource are two different lists, so a scope change must refetch.
 *
 * Keeps the loading/ready/partial/error state machine + retry/abort idiom: the active
 * key (`targetSourceId#resourceId#scope#nonce`) resets state to `loading` during
 * render on change, and each fetch is cancelled via an AbortController.
 */
export const useLogicalDatabases = (
  targetSourceId: number,
  resourceId: string,
  scope: TcScope,
): LogicalDbDataHook => {
  const { locale } = useLocale();
  // A ref, not an effect dependency: making the fetch depend on the language would refetch
  // the whole list every time the reader flips the toggle. The wording is only read when a
  // request actually fails, so the ref is always the language in force at that moment.
  const loadFailedRef = useRef(CANDIDATE_COPY[locale].logicalDb.loadFailed);
  useEffect(() => {
    loadFailedRef.current = CANDIDATE_COPY[locale].logicalDb.loadFailed;
  }, [locale]);
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<LogicalDbDataState>({ status: 'loading' });

  // Track the key the current state corresponds to so we can reset to 'loading'
  // during render when the target/resource or retry nonce changes — avoids a
  // synchronous setState inside useEffect.
  const fetchKey = `${targetSourceId}#${resourceId}#${scope}#${retryNonce}`;
  const [activeKey, setActiveKey] = useState(fetchKey);
  if (fetchKey !== activeKey) {
    setActiveKey(fetchKey);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    const controller = new AbortController();

    // allSettled, not all: the two fetches fail into two different screens. `all` collapsed
    // them into one `error`, which blocked editing a policy we were holding in our hand.
    void Promise.allSettled([
      getTestedLogicalDatabases(targetSourceId, resourceId, scope, {
        signal: controller.signal,
      }),
      getExcludedLogicalDatabases(targetSourceId, resourceId, { signal: controller.signal }),
    ]).then(([tested, excluded]) => {
      // 한 signal 을 두 fetch 가 나눠 쓰므로 이 한 줄이 취소를 전부 걸러낸다 — 아래의 두
      // rejected 갈래에 ABORTED 검사를 따로 두면 절대 참이 되지 않는 조건이 된다.
      if (controller.signal.aborted) return;

      // ⛔ The PUT is a FULL REPLACE. Saving over a policy we could not read would delete
      // exclusions nobody asked to delete, so this failure keeps the modal out of the table.
      if (excluded.status === 'rejected') {
        setState({ status: 'error', message: loadFailedRef.current });
        return;
      }

      if (tested.status === 'rejected') {
        // Policy only — `buildModalData([], …)` already renders exactly that: every excluded
        // item as an `untested` row, plus the draft seeded from it.
        const { databases, initialDraft } = buildModalData([], excluded.value);
        setState({ status: 'partial', databases, initialDraft });
        return;
      }

      const { databases, initialDraft } = buildModalData(tested.value, excluded.value);
      setState({ status: 'ready', databases, initialDraft });
    });

    return () => controller.abort();
  }, [targetSourceId, resourceId, scope, retryNonce]);

  return {
    state,
    retry: () => setRetryNonce((n) => n + 1),
  };
};
