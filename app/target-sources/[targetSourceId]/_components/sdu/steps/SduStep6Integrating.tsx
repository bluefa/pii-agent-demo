'use client';

import { useCallback } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { cardStyles, cn, primaryColors } from '@/lib/theme';
import { getProject } from '@/app/lib/api';
import {
  INSTALL_POLL_INTERVAL_MS,
  useInstallationStatus,
} from '@/app/hooks/useInstallationStatus';
import { useLocale } from '@/app/components/LocaleProvider';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import { sduStepOf } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';
import { SduUploadSummary } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduUploadSummary';
import type { SduStepProps } from '@/app/target-sources/[targetSourceId]/_components/sdu/types';

/**
 * SDU Step 6 — SDU 연동중.
 *
 * The screen whose message is that there is nothing to do, so it carries a recap of what
 * is already settled — 「SDU 연동중입니다」 on its own is a sentence the reader cannot check.
 *
 * The poll is SILENT (오너 2026-08-27): it still runs and still moves the owner off this
 * step, but the card says nothing about its cadence and stamps no last-check time. ⛔ No
 * refresh button either — nothing the owner does makes BDC finish sooner.
 *
 * Behind this one sentence the admin runs four things — 스캔 → 인프라 작업(Terraform) →
 * 연결 테스트 → Airflow 확인. The owner is told none of them by name: not one is theirs to
 * start, retry or interpret, and naming them would invite all three.
 */
export const SduStep6Integrating = ({ project, onProjectUpdate }: SduStepProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].integrating;

  /**
   * `useCallback` with no deps is load-bearing, not decoration: `useInstallationStatus`
   * keys its mount effect AND its poll interval on `getFn`'s identity, so a function
   * rebuilt each render would re-fetch on every render and reset the timer before it could
   * ever fire.
   */
  const readProject = useCallback(
    (id: number): Promise<CloudTargetSource> => getProject(id),
    [],
  );

  // Nothing is read off the return value: this card draws the project it was handed, and
  // the only thing the poll is for is the moment the target LEAVES this step.
  useInstallationStatus<CloudTargetSource>({
    targetSourceId: project.targetSourceId,
    getFn: readProject,
    // ⛔ Not `=== INSTALLATION_COMPLETE`. Leaving step 6 is what this screen waits for,
    // and completion is only the usual way out — an admin who resets the target sends it
    // back to 1단계, and a predicate that named only the happy exit would leave the owner
    // watching a step their target is no longer on.
    isComplete: (next) => sduStepOf(next.processStatus) !== 3,
    onComplete: onProjectUpdate,
    pollIntervalMs: INSTALL_POLL_INTERVAL_MS,
  });

  return (
    <section className={cardStyles.base}>
      <header className={cardStyles.header}>
        <div className="flex items-center gap-2">
          <span className={cardStyles.stepTag}>{t.stepTag}</span>
          <h2 className={cardStyles.cardTitle}>{t.title}</h2>
        </div>
        <p className={cn('mt-3', cardStyles.guidance)}>
          <strong className={cn('font-semibold', primaryColors.text)}>{t.guidanceStrong}</strong>{' '}
          {t.guidanceRest}
        </p>
      </header>
      <div className={cardStyles.body}>
        <SduUploadSummary targetSourceId={project.targetSourceId} />
      </div>
    </section>
  );
};
