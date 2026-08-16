import { useCallback, useEffect, useState } from 'react';
import { getTestConnectionCompletionStatus } from '@/app/lib/api';
import type { TestConnectionCompletionStatus } from '@/app/lib/api';
import type { TestConnectionUIState } from '@/app/hooks/useTestConnectionPolling';

type CompletionValue = TestConnectionCompletionStatus['test_connection_status'] | null;

interface StoredCompletion {
  targetSourceId: number;
  runVersion: number | null;
  refreshKey: number;
  value: CompletionValue;
  /** logical_database_updated_at — the policy-changed card's "정책 변경 {시각}" meta. */
  policyChangedAt: string | null;
}

export interface UseTcCompletionStatusReturn {
  /** Latest completion-status verdict — null before the first read or on failure. */
  completion: CompletionValue;
  /** CTA gate: only LATEST_TEST_CONNECTION_SUCCESS opens 완료 승인 요청. */
  approvalEnabled: boolean;
  /** When the logical-DB policy last changed — null outside a valid verdict. */
  policyChangedAt: string | null;
  /** Re-read now (after a logical-DB policy save). */
  refresh: () => void;
}

/**
 * Step 5 completion-status wiring, shared by the cloud and IDC cards. Reads
 * GET …/test-connection/completion-status whenever the run settles SUCCESS
 * (and on demand after a logical-DB save), so the 완료 승인 요청 gate and the
 * card's settled verdict states (성공/정책 변경/확인 완료 — foldTcCardState)
 * all run on the contract's verdict instead of a local guess.
 *
 * The stored verdict carries the identity it was fetched for (target · run
 * version · refresh key); anything else reads as null — a new run never briefly
 * reuses the previous run's verdict, and no setState happens synchronously in
 * the effect.
 */
export const useTcCompletionStatus = (
  targetSourceId: number,
  uiState: TestConnectionUIState,
  runVersion: number | null,
): UseTcCompletionStatusReturn => {
  const [stored, setStored] = useState<StoredCompletion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (uiState !== 'SUCCESS') return;
    let active = true;
    void getTestConnectionCompletionStatus(targetSourceId)
      .then((status) => {
        if (active) {
          setStored({
            targetSourceId,
            runVersion,
            refreshKey,
            value: status.test_connection_status ?? null,
            policyChangedAt: status.logical_database_updated_at ?? null,
          });
        }
      })
      .catch(() => {
        if (active) {
          setStored({ targetSourceId, runVersion, refreshKey, value: null, policyChangedAt: null });
        }
      });
    return () => {
      active = false;
    };
  }, [uiState, targetSourceId, runVersion, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const valid =
    uiState === 'SUCCESS' &&
    stored !== null &&
    stored.targetSourceId === targetSourceId &&
    stored.runVersion === runVersion &&
    stored.refreshKey === refreshKey;
  const completion = valid ? stored.value : null;

  return {
    completion,
    approvalEnabled: completion === 'LATEST_TEST_CONNECTION_SUCCESS',
    policyChangedAt: valid ? stored.policyChangedAt : null,
    refresh,
  };
};
