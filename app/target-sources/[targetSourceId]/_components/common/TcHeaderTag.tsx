'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { foldAgentStatuses } from '@/lib/test-connection-summary';

interface TcHeaderTagProps {
  targetSourceId: number;
}

/**
 * The latest connection-test verdict, hung under the stepper's 연결 테스트 step (P5).
 * Draws nothing when the target has never run a test.
 *
 * It reads latest_version once on mount and does not poll. Step 5's card owns its own
 * polling, but #661 severed that feed from this tag (see WaitingConnectionTestStep,
 * where the downgrade is recorded), so a verdict that flips while you sit on Step 5
 * reaches the card and not this tag until the next mount.
 *
 * The copy drops the word 연결 because the step name sits directly above it, and drops
 * the run number at the owner's request. That second cost is known: on this page 실행 #N
 * is drawn only by the Step 5 card and the 실행 이력 modal, both mounted only under Step 5,
 * so on the other six steps the number is now unreachable. The guide rail's 진행 내역 tab
 * is hardcoded mock data holding no connection-test runs, so it is not an alternative
 * path. (The admin ops console draws 회차 too, but that is a different surface and not
 * something this page's user can reach.) If the number turns out to be needed across
 * steps, here is where it goes back.
 */
export const TcHeaderTag = ({ targetSourceId }: TcHeaderTagProps) => {
  const [job, setJob] = useState<TestConnectionVersionResult | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLatestTest(targetSourceId)
      .then((latest) => {
        if (active) setJob(latest);
      })
      .catch(() => {
        if (active) setJob(null);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

  if (!job) return null;

  const status = job.connection_status;
  const tagClass =
    status === 'SUCCESS'
      ? idcStyles.tag.green
      : status === 'FAIL'
        ? idcStyles.tag.red
        : idcStyles.tag.orange;

  let label: string;
  if (status === 'SUCCESS') {
    label = '최근 테스트 성공';
  } else if (status === 'FAIL') {
    const folded = foldAgentStatuses(job.test_connection_agent_results ?? []);
    const failCount = [...folded.values()].filter((s) => s === 'FAIL').length;
    label = failCount > 0 ? `최근 테스트 실패 ${failCount}건` : '최근 테스트 실패';
  } else {
    // No 최근 on a run that is still going — it is happening now, not recently.
    label = '테스트 진행 중';
  }

  const timestamp = job.completed_at ?? job.requested_at;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn(idcStyles.tag.base, tagClass)}>{label}</span>
      {timestamp && (
        <span className={cn('text-[12px] font-medium', textColors.tertiary)}>
          {fmtRelativeTime(timestamp)}
        </span>
      )}
    </span>
  );
};
