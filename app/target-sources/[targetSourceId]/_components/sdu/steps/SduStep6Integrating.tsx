'use client';

import { useCallback, useState } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { cardStyles, cn, primaryColors, textColors, textStyles } from '@/lib/theme';
import { ClockIcon } from '@/app/components/ui/icons';
import { getProject } from '@/app/lib/api';
import {
  INSTALL_POLL_INTERVAL_MS,
  useInstallationStatus,
} from '@/app/hooks/useInstallationStatus';
import { useRelativeStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { sduStepOf } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import { SduUploadSummary } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduUploadSummary';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

/** The cadence the live line promises, in the words it promises it. */
const POLL_LABEL = `${INSTALL_POLL_INTERVAL_MS / 1000}초마다 자동 확인`;

/**
 * 「30초마다 자동 확인 · 8초 전 확인함」 — the one line that says this screen is awake.
 *
 * ⛔ No refresh button beside it. There is nothing the owner can do to make BDC finish
 * sooner, so a control here would offer them an action whose only effect is to reset the
 * number next to it. The 5단계 카드 settled the same question the same way.
 *
 * Borrowed from the step-4/5 stamp grammar rather than the storyboard's pulsing dot: 12px
 * clock glyph, 12px quiet ink, tabular digits — the last one matters most here, because
 * this number redraws every second and proportional digits would make the line breathe.
 */
const LiveLine = ({ checkedAt }: { checkedAt: string | null }) => {
  const stamp = useRelativeStamp(checkedAt);

  return (
    <span
      className={cn(
        'mt-4 inline-flex items-center gap-1.5 whitespace-nowrap [font-variant-numeric:tabular-nums]',
        textStyles.caption,
        textColors.tertiary,
      )}
    >
      <ClockIcon className="h-3 w-3 flex-shrink-0" />
      {POLL_LABEL}
      {/* The elapsed half only appears once there has been a check to be elapsed from.
          Before the first answer the line still states the cadence, which is the promise
          the reader is being asked to trust. */}
      {stamp?.elapsed && <span>· {stamp.elapsed} 확인함</span>}
    </span>
  );
};

/**
 * SDU Step 6 — SDU 연동중.
 *
 * The screen whose message is that there is nothing to do. That is exactly why it carries
 * a live line and a recap: 「SDU 연동중입니다」 on its own is indistinguishable from a page
 * that has frozen, and the reader's next move would be to reload and then to ask someone.
 *
 * Behind this one sentence the admin runs four things — 스캔 → 인프라 작업(Terraform) →
 * 연결 테스트 → Airflow 확인. The owner is told none of them by name: not one is theirs to
 * start, retry or interpret, and naming them would invite all three.
 */
export const SduStep6Integrating = ({ project, onProjectUpdate }: SduStepProps) => {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  /**
   * The read, with the moment it answered stamped on it. Wrapping `getProject` rather than
   * watching the hook's `status` afterwards: the stamp is a fact about the fetch, and both
   * paths that fetch — the mount read and every poll tick — go through this one function,
   * so neither can arrive unstamped.
   *
   * `useCallback` with no deps is load-bearing, not decoration: `useInstallationStatus`
   * keys its mount effect AND its poll interval on `getFn`'s identity, so a function
   * rebuilt each render would re-fetch on every render and reset the timer before it could
   * ever fire.
   */
  const readProject = useCallback(async (id: number): Promise<CloudTargetSource> => {
    const next = await getProject(id);
    setCheckedAt(new Date().toISOString());
    return next;
  }, []);

  // Nothing is read off the return value: this card draws the project it was handed, and
  // the only thing the poll is for is the moment the target LEAVES this step. The stamp
  // comes from `readProject` above.
  useInstallationStatus<CloudTargetSource>({
    targetSourceId: project.targetSourceId,
    getFn: readProject,
    // ⛔ Not `=== INSTALLATION_COMPLETE`. Leaving step 6 is what this screen waits for,
    // and completion is only the usual way out — an admin who resets the target sends it
    // back to 1단계, and a predicate that named only the happy exit would leave the owner
    // watching a step their target is no longer on.
    isComplete: (next) => sduStepOf(next.processStatus) !== 6,
    onComplete: onProjectUpdate,
    pollIntervalMs: INSTALL_POLL_INTERVAL_MS,
  });

  return (
    <section className={cardStyles.base}>
      <header className={cardStyles.header}>
        <div className="flex items-center gap-2">
          <span className={cardStyles.stepTag}>6단계</span>
          <h2 className={cardStyles.cardTitle}>업로드하신 데이터를 연동하고 있어요</h2>
        </div>
        <p className={cn('mt-3', cardStyles.guidance)}>
          <strong className={cn('font-semibold', primaryColors.text)}>
            담당자가 하실 일은 없어요.
          </strong>{' '}
          연동이 끝나면 완료 단계로 넘어가요.
        </p>
        <LiveLine checkedAt={checkedAt} />
      </header>
      <div className={cardStyles.body}>
        <SduUploadSummary targetSourceId={project.targetSourceId} />
      </div>
    </section>
  );
};
