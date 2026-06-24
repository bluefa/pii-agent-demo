'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import {
  getTestConnectionCompletionStatus,
  updateResourceCredential,
  type TestConnectionStatus,
} from '@/app/lib/api';
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
import { getIdcConfirmedResources, type IdcResourceView } from '@/app/lib/api/idc';

type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

/**
 * IDC Step 5 — 연결 테스트.
 * Chrome + read-only IdcResourceTable (cols `src`, `cred`, `conn`, `logical`) + a
 * "Run Test" action, preserving the v15 IDC design.
 *
 * Live wiring (ADR-019) — reuses the SHARED connection-test flow exactly like the
 * cloud ConnectionTestCard (no reimplementation): Run Test persists any changed
 * credential via `updateResourceCredential`, then `trigger()`s the async test;
 * per-resource Connection Status is read from the latest poll's agent results
 * (`useTestConnectionPolling`). Once the run settles SUCCESS the completion-status
 * is fetched and the 완료 승인 요청 CTA opens only on LATEST_TEST_CONNECTION_SUCCESS.
 *
 * The resource list is the confirmed integration, fetched per `targetSourceId`
 * (DR3/DR4/DR5/DR7) with an AbortController + stale-id guard.
 */
export const IdcStep5ConnectionTest = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const slotKey = resolveStepSlot('IDC', ProcessStatus.WAITING_CONNECTION_TEST);
  const { targetSourceId } = project;

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });
  const [creds, setCreds] = useState<Record<string, string>>({});
  // Credentials persisted/test triggered — gates per-row status on the poll
  // instead of the pre-test PENDING seed.
  const [tested, setTested] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { latestJob, uiState, trigger, triggerError } = useTestConnectionPolling(targetSourceId);
  const toast = useToast();
  const logicalModal = useModal<LogicalModalTarget>();

  // Target-switch safety via DR2 remount + DR3 AbortController.
  useEffect(() => {
    const controller = new AbortController();

    void getIdcConfirmedResources(targetSourceId, { signal: controller.signal })
      .then((resources) => {
        if (controller.signal.aborted) return;
        // The confirmed list is the integration targets; seed the per-resource
        // credential map from any pre-selected credential (kept), and reset test
        // state — Step 5 is pre-test until Run Test runs.
        setState({ status: 'ready', resources });
        setCreds(
          Object.fromEntries(resources.map((r) => [r.resourceId, r.credentialId ?? ''])),
        );
        setTested(false);
        setApprovalEnabled(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof AppError && error.code === 'ABORTED')) return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [targetSourceId]);

  const ready = state.status === 'ready';
  const liveResources = ready ? state.resources.filter((r) => !r.excluded) : [];
  const testing = uiState === 'PENDING';
  // B3: useTestConnectionPolling fetches latest_version on mount, so a settled
  // prior run must render immediately on a cold load/refresh — not stay PENDING
  // until a Run Test click this session.
  const hasResult = tested || uiState === 'SUCCESS' || uiState === 'FAIL';

  // Per-resource connection status from the latest poll, keyed by resourceId.
  const statusByResource = useMemo(() => {
    const map: Record<string, TestConnectionStatus> = {};
    for (const agent of latestJob?.testConnectionAgentResults ?? []) {
      map[agent.resourceId] = agent.connectionStatus;
    }
    return map;
  }, [latestJob]);

  // A row counts as connected only with a credential AND a SUCCESS result from the run.
  const rowConnected = useCallback(
    (resourceId: string): boolean =>
      hasResult && !!creds[resourceId] && statusByResource[resourceId] === 'SUCCESS',
    [hasResult, creds, statusByResource],
  );

  // Project the live status onto the rows the table renders (cred + conn columns).
  const viewResources: IdcResourceView[] = ready
    ? state.resources.map((r) => ({
        ...r,
        credentialId: creds[r.resourceId] || undefined,
        connection: rowConnected(r.resourceId) ? 'SUCCESS' : 'PENDING',
      }))
    : [];

  // Run Test gate: every live target must have a credential selected first.
  const allCredsSet = liveResources.length > 0 && liveResources.every((r) => !!creds[r.resourceId]);

  const okCount = liveResources.filter((r) => rowConnected(r.resourceId)).length;
  const failCount = liveResources.filter(
    (r) => hasResult && !!creds[r.resourceId] && statusByResource[r.resourceId] === 'FAIL',
  ).length;
  const pendingCount = liveResources.length - okCount;
  const progressPct = liveResources.length > 0 ? Math.round((okCount / liveResources.length) * 100) : 0;

  // After the run settles SUCCESS, read completion-status; the CTA only opens on
  // LATEST_TEST_CONNECTION_SUCCESS (every target connected + logical-DB up to date).
  // While not-SUCCESS (pre-test / running / fail) the gate stays closed: the async
  // resolution sets it, and credential changes / a new Run Test reset it to false.
  useEffect(() => {
    if (uiState !== 'SUCCESS') return;
    let active = true;
    void getTestConnectionCompletionStatus(targetSourceId)
      .then((status) => {
        if (active) setApprovalEnabled(status.testConnectionStatus === 'LATEST_TEST_CONNECTION_SUCCESS');
      })
      .catch(() => {
        if (active) setApprovalEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [uiState, targetSourceId, latestJob]);

  const runTest = useCallback(async () => {
    if (!ready || testing || savingCreds || !allCredsSet) return;
    setSavingCreds(true);
    try {
      // Persist every credential that diverged from the seed before triggering.
      for (const r of state.resources) {
        if (r.excluded) continue;
        const next = creds[r.resourceId] ?? '';
        if (next !== (r.credentialId ?? '')) {
          await updateResourceCredential(targetSourceId, r.resourceId, next);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 설정에 실패했습니다.');
      setSavingCreds(false);
      return;
    }
    setSavingCreds(false);
    setApprovalEnabled(false);
    setTested(true);
    await trigger();
  }, [ready, testing, savingCreds, allCredsSet, state, creds, targetSourceId, trigger, toast]);

  // Changing a credential invalidates the prior test result for that row.
  const handleCredChange = useCallback((resourceId: string, cred: string) => {
    setCreds((prev) => ({ ...prev, [resourceId]: cred }));
    setTested(false);
    setApprovalEnabled(false);
  }, []);

  const progressState: ConnProgressState = testing
    ? 'running'
    : failCount > 0
      ? 'fail'
      : liveResources.length > 0 && pendingCount === 0
        ? 'success'
        : 'idle';
  const progressLabel = testing
    ? '연결 테스트 진행 중 — 각 대상의 Connection Status를 확인하고 있어요'
    : progressState === 'success'
      ? '연결 테스트 완료 — 모든 대상이 연결되었어요'
      : progressState === 'fail'
        ? '연결 테스트 실패 — 실패한 대상의 Credential 또는 네트워크를 점검해 주세요'
        : '연결 테스트 대기 중 — Run Test를 실행해 주세요';

  // Open the per-resource logical-DB modal. IdcLogicalButtonCell gates this to
  // credentialed + SUCCESS rows.
  const handleLogicalOpen = useCallback(
    (resource: IdcResourceView) => {
      logicalModal.open({
        resourceId: resource.resourceId,
        resourceName: resource.hosts[0] ?? resource.resourceId,
      });
    },
    [logicalModal],
  );
  const handleLogicalSaved = useCallback(async () => {
    toast.success('논리 DB 제외 정책을 저장했습니다.');
    logicalModal.close();
    const updated = await getProject(targetSourceId);
    onProjectUpdate(updated);
  }, [logicalModal, toast, onProjectUpdate, targetSourceId]);

  const handleLogicalError = useCallback(() => {
    toast.error('논리 DB 제외 정책 저장에 실패했습니다.');
  }, [toast]);

  const canRequestApproval = liveResources.length > 0 && okCount === liveResources.length && !testing && approvalEnabled;
  // Completion-approval submit -> refetch advances to step 6 when the process status flips.
  const handleSubmitApproval = useCallback(async () => {
    setApprovalOpen(false);
    const updated = await getProject(targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, targetSourceId]);

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
            disabled={!ready || testing || savingCreds || !allCredsSet}
            className={idcStyles.triggerBtn.primary}
          >
            {testing || savingCreds ? (
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
                fail={failCount}
                pending={pendingCount}
                pct={progressPct}
              />
              {triggerError && (
                <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>{triggerError}</p>
              )}
              {/* Keep the table frame flush with its attached footer pagination
                  (Pagination is a border-t-0 / rounded-b table footer). Without this
                  wrapper the section's space-y-4 inserts a 16px gap between them and
                  the footer bar visibly detaches from the table. */}
              <div>
                <IdcResourceTable
                  resources={viewResources}
                  cols={['src', 'cred', 'conn', 'logical']}
                  onCredChange={handleCredChange}
                  onLogicalOpen={handleLogicalOpen}
                />
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className={cn('text-[12px]', textColors.tertiary)}>
                  ※ 모든 DB의 Connection Status가 Success여야 다음 단계로 진행할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setApprovalOpen(true)}
                  disabled={!canRequestApproval}
                  className={idcStyles.triggerBtn.primary}
                >
                  완료 승인 요청
                </button>
              </div>
              <IdcReqApprovalModal
                isOpen={approvalOpen}
                onClose={() => setApprovalOpen(false)}
                resources={viewResources}
                onSubmit={handleSubmitApproval}
              />
              {logicalModal.data && (
                <LogicalDbModalLoader
                  open={logicalModal.isOpen}
                  targetSourceId={targetSourceId}
                  resourceId={logicalModal.data.resourceId}
                  resourceName={logicalModal.data.resourceName}
                  onSaved={handleLogicalSaved}
                  onError={handleLogicalError}
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
