'use client';

/**
 * Per-row NLB index editing for the P3 IDC detail: a local draft the row's select
 * writes to, and a save that PUTs one resource then refetches the NLB table so
 * occupancy moves for every other row's option list.
 *
 * Split out of the page (AP-B1): the draft, the in-flight row, the optimistic
 * baseline and the toast copy are one concern, and the page only needs to hand it a
 * setter for the resource list it owns.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearNlbDraft,
  effectiveNlbIndex,
  setNlbDraft,
  type NlbDraft,
} from '@/app/admin/pipelines/queue/requests/_logic';
import {
  getNlbTable,
  putNlbIndex,
  type NlbTableRow,
  type RequestResourceRow,
} from '@/app/lib/api/task-queue-requests';

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface NlbAssignment {
  draft: NlbDraft;
  savingResourceId: string | null;
  select: (row: RequestResourceRow, nlbIndex: number) => void;
  save: (row: RequestResourceRow) => void;
  /** Drop every pending edit — the page calls this when it refetches the request. */
  reset: () => void;
}

export interface UseNlbAssignmentArgs {
  targetSourceId: number;
  /** Rebase one row's saved index after a successful PUT. */
  onSaved: (resourceId: string, nlbIndex: number) => void;
  /** Refreshed occupancy after a save — the option labels carry it. */
  onNlbTable: (rows: NlbTableRow[]) => void;
  showToast: (message: string) => void;
}

export function useNlbAssignment({
  targetSourceId,
  onSaved,
  onNlbTable,
  showToast,
}: UseNlbAssignmentArgs): NlbAssignment {
  const [draft, setDraft] = useState<NlbDraft>({});
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

  const select = useCallback((row: RequestResourceRow, nlbIndex: number): void => {
    setDraft((prev) => setNlbDraft(prev, row, nlbIndex));
  }, []);

  const reset = useCallback((): void => setDraft({}), []);

  const save = useCallback(
    (row: RequestResourceRow): void => {
      const resourceId = row.resourceId;
      if (resourceId == null) return;
      const nextIndex = effectiveNlbIndex(row, draft);
      if (nextIndex == null) return;
      const fromIndex = row.nlbIndex;

      setSavingResourceId(resourceId);
      void (async () => {
        try {
          await putNlbIndex(targetSourceId, resourceId, nextIndex);
          onSaved(resourceId, nextIndex);
          setDraft((prev) => clearNlbDraft(prev, resourceId));
          const nlb = await getNlbTable();
          if (!aliveRef.current) return;
          onNlbTable(nlb);
          showToast(
            fromIndex != null && fromIndex !== nextIndex
              ? `NLB #${fromIndex} → #${nextIndex} 변경을 저장했어요`
              : `NLB #${nextIndex} 배정을 저장했어요`,
          );
        } catch (err) {
          if (aliveRef.current) showToast(errorMessage(err));
        } finally {
          setSavingResourceId(null);
        }
      })();
    },
    [draft, targetSourceId, onSaved, onNlbTable, showToast],
  );

  return { draft, savingResourceId, select, save, reset };
}
