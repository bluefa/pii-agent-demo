'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { useToast } from '@/app/components/ui/toast';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';

type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

/** v15 runIdcConnTest: cells show "Testing…" then settle to Success after ~1.8s. */
const TEST_DURATION_MS = 1800;

/** Approval-request CTA — intentionally a toast stub (mirrors cloud siblings). */
const ApproveRequestButton = () => {
  const toast = useToast();
  return (
    <div className="flex justify-end mt-4">
      <button
        type="button"
        className={idcStyles.triggerBtn.primary}
        onClick={() => toast.info('완료 승인 요청 기능 준비중입니다.')}
      >
        완료 승인 요청
      </button>
    </div>
  );
};

/**
 * IDC Step 5 — 연결 테스트.
 * Chrome + read-only IdcResourceTable (cols `src`, `conn`) + a "Run Test" action.
 *
 * Run Test is a demo simulation (mirrors v15 `runIdcConnTest`): it flips a
 * local `testing` flag for ~1.8s — surfaced via the button label and an info
 * banner since the frozen `IdcConnBadge` only renders Pending/Success — then
 * optimistically sets every row's `connection` to `SUCCESS` in component state.
 *
 * The resource list is fetched per `targetSourceId` (DR3/DR4/DR5/DR7) with an
 * AbortController + stale-id guard, and all state is component-local.
 */
export const IdcStep5ConnectionTest = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.WAITING_CONNECTION_TEST);

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });
  const [testing, setTesting] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTestTimer = () => {
    if (testTimerRef.current) {
      clearTimeout(testTimerRef.current);
      testTimerRef.current = null;
    }
  };

  // Target-switch safety via DR2 remount + DR3 AbortController (timer cleared on unmount).
  useEffect(() => {
    const controller = new AbortController();

    void getIdcResources(project.targetSourceId, { signal: controller.signal })
      .then((resources) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', resources });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof AppError && error.code === 'ABORTED')) return;
        setState({ status: 'error' });
      });

    return () => {
      controller.abort();
      clearTestTimer();
    };
  }, [project.targetSourceId]);

  const runTest = useCallback(() => {
    if (testing) return;
    setTesting(true);
    testTimerRef.current = setTimeout(() => {
      testTimerRef.current = null;
      setTesting(false);
      setState((prev) =>
        prev.status === 'ready'
          ? {
              status: 'ready',
              resources: prev.resources.map((r) =>
                r.excluded ? r : { ...r, connection: 'SUCCESS' },
              ),
            }
          : prev,
      );
    }, TEST_DURATION_MS);
  }, [testing]);

  const ready = state.status === 'ready';

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={runTest}
            disabled={!ready || testing}
            className={idcStyles.triggerBtn.primary}
          >
            {testing ? '연결 테스트 진행 중...' : 'Run Test'}
          </button>
        </header>
        <div className="p-6 space-y-4">
          {testing && (
            <StepBanner variant="info">
              <strong>연결 테스트 진행 중...</strong>
              &nbsp;각 연동 대상의 Connection Status를 확인하고 있어요.
            </StepBanner>
          )}
          {state.status === 'loading' && (
            <div className={cn('py-10 text-center text-sm', textColors.tertiary)}>
              연동 대상을 불러오는 중...
            </div>
          )}
          {state.status === 'error' && (
            <div className={cn('py-10 text-center text-sm', textColors.tertiary)}>
              연동 대상을 불러오지 못했습니다.
            </div>
          )}
          {ready && (
            <>
              <IdcResourceTable resources={state.resources} cols={['src', 'conn']} />
              <p className={cn('text-[12px]', textColors.tertiary)}>
                ※ 모든 DB의 Connection Status가 Success여야 다음 단계로 진행할 수 있어요.
              </p>
              <ApproveRequestButton />
            </>
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
