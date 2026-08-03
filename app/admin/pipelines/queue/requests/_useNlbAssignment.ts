'use client';

/**
 * Committing one IDC resource's NLB index: PUT the pick, then refetch the NLB table so
 * every other row's occupancy moves with it.
 *
 * There is no draft layer. The choice is made inside NlbAssignModal and committed by its
 * 저장 — one act — so a request can never sit holding an unsaved assignment, and nothing
 * downstream has to warn about one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getNlbTable, putNlbIndex, type NlbTableRow } from '@/app/lib/api/task-queue-requests';

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface NlbAssignment {
  /** The resource_id whose PUT is in flight, or null. */
  savingResourceId: string | null;
  save: (resourceId: string, fromIndex: number | null, nlbIndex: number) => void;
}

export interface UseNlbAssignmentArgs {
  targetSourceId: number;
  /** Rebase the saved row's index in the page's resource list. */
  onSaved: (resourceId: string, nlbIndex: number) => void;
  /** Refreshed occupancy after a save — the assignment modal reads it. */
  onNlbTable: (rows: NlbTableRow[]) => void;
  showToast: (message: string) => void;
  /** Ran only on a landed PUT — the page closes the modal there. A failure leaves it
   *  open, so the admin can retry against the toast's reason. */
  onSuccess?: () => void;
}

export function useNlbAssignment({
  targetSourceId,
  onSaved,
  onNlbTable,
  showToast,
  onSuccess,
}: UseNlbAssignmentArgs): NlbAssignment {
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);

  // Gates the post-save toast/refetch: the section-level toast provider outlives this
  // page, so a save resolving after navigation must not fire a toast there.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const save = useCallback(
    (resourceId: string, fromIndex: number | null, nlbIndex: number): void => {
      setSavingResourceId(resourceId);
      void (async () => {
        try {
          await putNlbIndex(targetSourceId, resourceId, nlbIndex);
          onSaved(resourceId, nlbIndex);
          const nlb = await getNlbTable();
          if (!aliveRef.current) return;
          onNlbTable(nlb);
          onSuccess?.();
          showToast(
            fromIndex != null && fromIndex !== nlbIndex
              ? `NLB #${fromIndex} → #${nlbIndex} 변경을 저장했어요`
              : `NLB #${nlbIndex} 배정을 저장했어요`,
          );
        } catch (err) {
          if (aliveRef.current) showToast(errorMessage(err));
        } finally {
          setSavingResourceId(null);
        }
      })();
    },
    [targetSourceId, onSaved, onNlbTable, showToast, onSuccess],
  );

  return { savingResourceId, save };
}
