'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
import { ErrorState, LoadingState } from '@/app/components/ui/state';
import {
  ConnProgressStrip,
  type ConnProgressState,
} from '@/app/components/features/process-status/ConnProgressStrip';
import { useToast } from '@/app/components/ui/toast';
import { useModal } from '@/app/hooks/useModal';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcReqApprovalModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcReqApprovalModal';
import { LogicalDbModalLoader } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { getProject } from '@/app/lib/api';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';

type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

/** v15 runIdcConnTest: cells show "Testing…" then settle to Success after ~1.8s. */
const TEST_DURATION_MS = 1800;

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
        // Step 5 is definitionally pre-test: nothing is connected until Run Test
        // runs, so force every row to PENDING on load and ignore any seeded
        // `connection_status` (a placeholder shared with the post-test step 6/7
        // views). Mirrors the cloud sibling `ConnectionTestCard` `seedRows`, and
        // matches v16's idle conn-progress strip. The pre-selected credential is
        // kept (v16 seeds row1's `idc_svc_mysql`).
        setState({
          status: 'ready',
          resources: resources.map((r) => ({ ...r, connection: 'PENDING' as const })),
        });
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

  // v16 setIdcCred: changing a credential invalidates the prior test → reset to PENDING.
  const handleCredChange = useCallback((resourceId: string, cred: string) => {
    setState((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            resources: prev.resources.map((r) =>
              r.resourceId === resourceId
                ? { ...r, credentialId: cred || undefined, connection: 'PENDING' }
                : r,
            ),
          }
        : prev,
    );
  }, []);

  const ready = state.status === 'ready';
  const liveResources = ready ? state.resources.filter((r) => !r.excluded) : [];
  // Run Test gate: every live target must have a credential selected first (v16 runIdcConnTest guard).
  const allCredsSet = liveResources.length > 0 && liveResources.every((r) => !!r.credentialId);

  // Match IdcConnStatusCell: a target counts as connected only with a credential AND Success.
  const okCount = liveResources.filter((r) => !!r.credentialId && r.connection === 'SUCCESS').length;
  const pendingCount = liveResources.length - okCount;
  const progressPct = liveResources.length > 0 ? Math.round((okCount / liveResources.length) * 100) : 0;
  const progressState: ConnProgressState = testing
    ? 'running'
    : liveResources.length > 0 && pendingCount === 0
      ? 'success'
      : 'idle';
  const progressLabel = testing
    ? '연결 테스트 진행 중 — 각 대상의 Connection Status를 확인하고 있어요'
    : progressState === 'success'
      ? '연결 테스트 완료 — 모든 대상이 연결되었어요'
      : '연결 테스트 대기 중 — Run Test를 실행해 주세요';

  const toast = useToast();
  const logicalModal = useModal<LogicalModalTarget>();
  // Open the per-resource logical-DB modal (mirrors the cloud step5 ConnectionTestCard
  // wiring). Display name is the resource's 연동 대상 endpoint (hosts[0]), with the
  // resourceId as a fallback. IdcLogicalButtonCell gates this to credentialed + SUCCESS rows.
  const handleLogicalOpen = useCallback(
    (resource: IdcResourceView) => {
      logicalModal.open({
        resourceId: resource.resourceId,
        resourceName: resource.hosts[0] ?? resource.resourceId,
      });
    },
    [logicalModal],
  );
  // Save is a no-op until the BFF endpoint is wired (same as ConnectionTestCard).
  const handleLogicalSave = useCallback(() => {
    toast.info('논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.');
    logicalModal.close();
  }, [logicalModal, toast]);

  const [approvalOpen, setApprovalOpen] = useState(false);
  // Completion-approval submit -> refetch advances to step 6 when the process status flips (locked: transition = refetch).
  const handleSubmitApproval = useCallback(async () => {
    setApprovalOpen(false);
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

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
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={runTest}
            disabled={!ready || testing || !allCredsSet}
            className={idcStyles.triggerBtn.primary}
          >
            {testing ? (
              '연결 테스트 진행 중...'
            ) : (
              <>
                <svg
                  className="w-[13px] h-[13px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run Test
              </>
            )}
          </button>
        </header>
        <div className={cn(cardStyles.body, 'space-y-4')}>
          {state.status === 'loading' && <LoadingState label="연동 대상을 불러오는 중..." />}
          {state.status === 'error' && (
            <ErrorState message="연동 대상을 불러오지 못했습니다." />
          )}
          {ready && (
            <>
              <ConnProgressStrip
                state={progressState}
                label={progressLabel}
                ok={okCount}
                fail={0}
                pending={pendingCount}
                pct={progressPct}
              />
              <IdcResourceTable
                resources={state.resources}
                cols={['src', 'cred', 'conn', 'logical']}
                onCredChange={handleCredChange}
                onLogicalOpen={handleLogicalOpen}
              />
              <div className="flex items-center justify-between mt-4">
                <p className={cn('text-[12px]', textColors.tertiary)}>
                  ※ 모든 DB의 Connection Status가 Success여야 다음 단계로 진행할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setApprovalOpen(true)}
                  className={idcStyles.triggerBtn.primary}
                >
                  완료 승인 요청
                </button>
              </div>
              <IdcReqApprovalModal
                isOpen={approvalOpen}
                onClose={() => setApprovalOpen(false)}
                resources={state.resources}
                onSubmit={handleSubmitApproval}
              />
              {logicalModal.data && (
                <LogicalDbModalLoader
                  open={logicalModal.isOpen}
                  resourceId={logicalModal.data.resourceId}
                  resourceName={logicalModal.data.resourceName}
                  onSave={handleLogicalSave}
                  onClose={logicalModal.close}
                />
              )}
            </>
          )}
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
