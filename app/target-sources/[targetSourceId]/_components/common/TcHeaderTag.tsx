'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TcScope } from '@/app/lib/api/tc-scope';
import { foldAgentStatuses } from '@/lib/test-connection-summary';

interface TcHeaderTagProps {
  targetSourceId: number;
  /** Which run this tag reads. Decided by the renderer (ProjectPageMeta), never guessed here. */
  scope: TcScope;
}

/**
 * The latest connection-test verdict, hung under the stepper's 연결 테스트 step (P5).
 * Draws nothing when the target has never run a test.
 *
 * The run it reads depends on the step the header sits on: Step 5 passes `latest`, so a
 * failed run stays visible while the user is the one being asked to fix it; Steps 6·7 pass
 * `latestSuccess`, so the tag keeps reporting the run their state was built on rather than a
 * later failure. The tag does not work that out — `scope` arrives as a prop.
 *
 * The copy splits on that same prop: only `latest` may say 최근, because only there is the
 * run being reported the newest one. Under `latestSuccess` a later run may have failed since,
 * so the tag says 마지막 성공 and lets the relative time say when (오너 지시).
 *
 * It reads the run once on mount and does not poll. Step 5's card owns its own
 * polling, but #661 severed that feed from this tag (see WaitingConnectionTestStep,
 * where the downgrade is recorded), so a verdict that flips while you sit on Step 5
 * reaches the card and not this tag until the next mount.
 *
 * The copy drops the word 연결 because the step name sits directly above it, and drops
 * the run number at the owner's request. That second cost is known: on this page 실행 #N
 * is drawn only by the Step 5 card and the 실행 이력 modal, both mounted only under Step 5,
 * so on the other six steps the number is now unreachable. The guide rail used to carry a
 * 진행 내역 tab, but it held hardcoded mock rows with no connection-test runs in them and
 * has since been removed outright (오너 지시 2026-08-23) — it was never an alternative path
 * and is not one now. (The admin ops console draws 회차 too, but that is a different surface and not
 * something this page's user can reach.) If the number turns out to be needed across
 * steps, here is where it goes back.
 */
export const TcHeaderTag = ({ targetSourceId, scope }: TcHeaderTagProps) => {
  const [job, setJob] = useState<TestConnectionVersionResult | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLatestTest(targetSourceId, scope)
      .then((latest) => {
        if (active) setJob(latest);
      })
      .catch(() => {
        if (active) setJob(null);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId, scope]);

  if (!job) return null;

  const status = job.connection_status;
  const tagClass =
    status === 'SUCCESS'
      ? idcStyles.tag.green
      : status === 'FAIL'
        ? idcStyles.tag.red
        : idcStyles.tag.orange;

  // 같은 분기, 계열만 다른 어휘. `latestSuccess` 는 "마지막으로 성공한 회차"라서,
  // 그 뒤에 실패한 회차가 있어도 이 태그가 그것을 모른다 — 그래서 최근이라고 말하지 않는다.
  const lastSuccessScope = scope === 'latestSuccess';

  let label: string;
  if (status === 'SUCCESS') {
    label = lastSuccessScope ? '마지막 성공' : '최근 테스트 성공';
  } else if (status === 'FAIL') {
    const folded = foldAgentStatuses(job.test_connection_agent_results ?? []);
    const failCount = [...folded.values()].filter((s) => s === 'FAIL').length;
    // 마지막 성공 회차가 FAIL 로 올 리는 없지만, connection_status 는 느슨한 `string` 이라
    // 계약이 그것을 막아주지 않는다. 분기를 늘리지 않고, 뒷받침 못 하는 최근만 뺀다.
    const lead = lastSuccessScope ? '테스트 실패' : '최근 테스트 실패';
    label = failCount > 0 ? `${lead} ${failCount}건` : lead;
  } else if (status === 'PENDING') {
    // 접수만 되고 아직 아무것도 돌지 않는다 — 카드의 시작 대기와 같은 어휘.
    label = '테스트 시작 대기';
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
