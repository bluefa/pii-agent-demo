'use client';

/**
 * The latest pipeline run on this target (#8 `pipelines/latest`, 204 = none).
 *
 * While the run is live (PENDING · RUNNING) the summary is re-read every 8s — the same
 * cadence as the 인프라 작업 tab's current-run card. The moment a live run turns terminal,
 * `onSettled` fires once so the tab can re-read the record that run rewrote.
 *
 * A failed read keeps the last summary: an unreadable value locks nothing and unlocks
 * nothing (same rule as the tab's other loads).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLatestPipelineByTarget } from '@/app/lib/api/pipeline';
import { isLivePipeline } from '@/lib/pipeline/format';
import type { PipelineSummary } from '@/lib/pipeline/types';

const LIVE_POLL_MS = 8_000;

export interface LatestRun {
  run: PipelineSummary | null;
  /** A run is in progress on this target — every write door is locked while it is. */
  live: boolean;
  /** Re-read now (a run was just started from this tab). */
  reload: () => void;
}

/** `onSettled` must be referentially stable (a `useCallback`) — it is a poll dependency. */
export function useLatestRun(targetSourceId: number | string, onSettled: () => void): LatestRun {
  const [run, setRun] = useState<PipelineSummary | null>(null);
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey((k) => k + 1), []);
  // ponytail: not reset on target change — one spurious onSettled (a reload) at most.
  const wasLive = useRef(false);
  const live = run != null && isLivePipeline(run.status);

  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      try {
        const next = await getLatestPipelineByTarget(targetSourceId);
        if (cancelled) return;
        const nowLive = next != null && isLivePipeline(next.status);
        if (wasLive.current && !nowLive) onSettled();
        wasLive.current = nowLive;
        setRun(next);
      } catch {
        /* transient failure — keep the last summary */
      }
    };
    void tick();
    if (!live) {
      return () => {
        cancelled = true;
      };
    }
    const timer = setInterval(() => void tick(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [targetSourceId, key, live, onSettled]);

  return { run, live, reload };
}
