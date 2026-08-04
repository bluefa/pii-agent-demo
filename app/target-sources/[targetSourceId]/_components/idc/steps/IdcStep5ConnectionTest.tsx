'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles } from '@/lib/theme';
import {
  ConnProgressStrip,
  type ConnProgressState,
} from '@/app/components/features/process-status/ConnProgressStrip';
import { useToast } from '@/app/components/ui/toast';
import { useModal } from '@/app/hooks/useModal';
import { useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import {
  getSecrets,
  getTestConnectionCompletionStatus,
  updateTestConnectionConfirmation,
  type TestConnectionStatus,
} from '@/app/lib/api';
import {
  CardActionBar,
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { IdcConfirmedResourcesPanel } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel';
import { IdcCredentialModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcCredentialModal';
import { IdcReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcReqApprovalModal';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { getProject } from '@/app/lib/api';
import { getIdcConfirmedResources, type IdcConnState, type IdcResourceView } from '@/app/lib/api/idc';
import type { ResourcesState } from '@/app/hooks/useIdcResources';

const EMPTY_RESOURCES: readonly IdcResourceView[] = [];

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

// The wire connection_status is a loose nullable string; keep only the
// IdcConnState members so the table's `connection` stays typed (else PENDING).
const IDC_CONN_STATES: readonly IdcConnState[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'];

/**
 * IDC Step 5 — 연결 테스트.
 * Chrome + the shared IdcConfirmedResourcesPanel (cols `src`, `logicalro`) + a
 * "Run Test" action, so steps 5·6·7 render one table instead of three.
 *
 * DB Credential and Connection Status are no longer columns. The credential is a
 * decision, not an attribute of the row, so it moved into IdcCredentialModal (the
 * cloud connection test does the same); per-row status is carried by the progress
 * strip's 성공/실패/대기 counts, and the table shows the Step-5 logical-DB result.
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
  const { targetSourceId } = project;

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });
  const [creds, setCreds] = useState<Record<string, string>>({});
  // DB Credential options from GET .../secrets (not a hardcoded list).
  const [credOptions, setCredOptions] = useState<string[]>([]);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [credModalOpen, setCredModalOpen] = useState(false);

  const { latestJob, uiState, trigger, triggerError, fetchError } = useTestConnectionPolling(targetSourceId);
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
        setApprovalEnabled(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof AppError && error.code === 'ABORTED')) return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [targetSourceId]);

  // Load the selectable DB Credential options from the target-source secrets.
  useEffect(() => {
    let active = true;
    void getSecrets(targetSourceId)
      .then((secrets) => {
        if (active) setCredOptions(secrets.map((s) => s.name));
      })
      .catch(() => {
        if (active) setCredOptions([]);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

  const ready = state.status === 'ready';
  // Memoized: it is the credential modal's row list, and a new array identity on every
  // render would re-seed the modal's picks mid-edit.
  const liveResources = useMemo(
    () => (state.status === 'ready' ? state.resources.filter((r) => !r.excluded) : EMPTY_RESOURCES),
    [state],
  );
  const testing = uiState === 'PENDING';

  // Per-resource connection status from the latest poll, keyed by resource_id.
  // The poll streams results as each pipeline settles, so this map is the live
  // source of truth for the table — no extra "tested" gate (B3: a settled prior
  // run hydrates on mount, so it renders immediately on cold load too).
  const statusByResource = useMemo(() => {
    const map: Record<string, TestConnectionStatus> = {};
    for (const agent of latestJob?.test_connection_agent_results ?? []) {
      if (agent.resource_id && agent.connection_status) map[agent.resource_id] = agent.connection_status;
    }
    return map;
  }, [latestJob]);

  // A row counts as connected on the SUCCESS the agent reported, and on nothing else —
  // the same rule the cloud card runs on. Folding "is a credential picked locally" into
  // the verdict made a healthy target read 대기 in the progress strip.
  const rowConnected = useCallback(
    (resourceId: string): boolean => statusByResource[resourceId] === 'SUCCESS',
    [statusByResource],
  );

  // Project the live poll status onto the rows the table renders. The status flows
  // straight through (SUCCESS / FAIL / RUNNING / PENDING) so the table updates
  // automatically as each pipeline settles.
  const viewResources: IdcResourceView[] = ready
    ? state.resources.map((r) => ({
        ...r,
        credentialId: creds[r.resourceId] || undefined,
        connection: IDC_CONN_STATES.find((s) => s === statusByResource[r.resourceId]) ?? 'PENDING',
      }))
    : [];

  // Run Test gate: every live target must have a credential selected first.
  const allCredsSet = liveResources.length > 0 && liveResources.every((r) => !!creds[r.resourceId]);

  // Progress counts every settled pipeline (SUCCESS or FAIL) as done, not just the
  // running ones — done / total drives the percentage.
  const okCount = liveResources.filter((r) => rowConnected(r.resourceId)).length;
  const failCount = liveResources.filter(
    (r) => statusByResource[r.resourceId] === 'FAIL',
  ).length;
  const doneCount = liveResources.filter((r) => {
    const s = statusByResource[r.resourceId];
    return s === 'SUCCESS' || s === 'FAIL';
  }).length;
  const pendingCount = liveResources.length - doneCount;
  const progressPct = liveResources.length > 0 ? Math.round((doneCount / liveResources.length) * 100) : 0;

  // After the run settles SUCCESS, read completion-status; the CTA only opens on
  // LATEST_TEST_CONNECTION_SUCCESS (every target connected + logical-DB up to date).
  // While not-SUCCESS (pre-test / running / fail) the gate stays closed: the async
  // resolution sets it, and credential changes / a new Run Test reset it to false.
  useEffect(() => {
    if (uiState !== 'SUCCESS') return;
    let active = true;
    void getTestConnectionCompletionStatus(targetSourceId)
      .then((status) => {
        if (active) setApprovalEnabled(status.test_connection_status === 'LATEST_TEST_CONNECTION_SUCCESS');
      })
      .catch(() => {
        if (active) setApprovalEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [uiState, targetSourceId, latestJob]);

  // Run Test with a credential missing opens the picker instead of failing the run —
  // the same detour the cloud connection test takes.
  const runTest = useCallback(async () => {
    if (!ready || testing) return;
    if (!allCredsSet) {
      setCredModalOpen(true);
      return;
    }
    setApprovalEnabled(false);
    await trigger();
  }, [ready, testing, allCredsSet, trigger]);

  // The modal persisted every changed credential before calling back, so the local map
  // can take its picks wholesale and the run starts against a fully saved set.
  const handleCredentialsSaved = useCallback(async (credentials: Record<string, string>) => {
    setCreds(credentials);
    setCredModalOpen(false);
    setApprovalEnabled(false);
    await trigger();
  }, [trigger]);

  const progressState: ConnProgressState = testing
    ? 'running'
    : failCount > 0
      ? 'fail'
      : liveResources.length > 0 && pendingCount === 0
        ? 'success'
        : 'idle';
  const progressLabel = testing
    ? '연결 테스트 진행 중 — 각 대상의 연결 상태를 확인하고 있어요'
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
  // 완료 승인 요청: acknowledge (confirmed:true) → the mock sets passedAt → Step 6,
  // then the refetch advances the screen. (Without the PUT the project never changes.)
  const handleSubmitApproval = useCallback(async () => {
    setApprovalOpen(false);
    await updateTestConnectionConfirmation(targetSourceId, true);
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
      {/* No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar. */}
      <section className={cardStyles.base}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <span className={cardStyles.stepTag}>5번째 단계</span>
            <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The credential is a decision, not a row attribute, so it gets its own entry
                point here — Run Test also detours through it when one is missing. */}
            <button
              type="button"
              onClick={() => setCredModalOpen(true)}
              disabled={!ready || testing}
              className={cn(idcStyles.triggerBtn.linkNeutral, 'disabled:cursor-not-allowed disabled:opacity-45')}
            >
              DB Credential 설정
            </button>
            {/* C-1: repeatable action demoted to soft — 완료 승인 요청 keeps the only primary. */}
            <button
              type="button"
              onClick={runTest}
              disabled={!ready || testing}
              className={cn(idcStyles.triggerBtn.soft, 'disabled:cursor-not-allowed disabled:opacity-45')}
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
          </div>
        </header>
        <div className={cn(cardStyles.body, 'space-y-4')}>
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
              {fetchError && (
                <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
                  {ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED}
                </p>
              )}
            </>
          )}
          {/* Toolbar, table and pagination are one card, so the section's space-y-4 must not
              get between them — the wrapper absorbs it. */}
          <div>
            <IdcConfirmedResourcesPanel
              targetSourceId={targetSourceId}
              state={state}
              onLogicalOpen={handleLogicalOpen}
            />
          </div>
          <IdcCredentialModal
            isOpen={credModalOpen}
            onClose={() => setCredModalOpen(false)}
            resources={liveResources}
            credOptions={credOptions}
            targetSourceId={targetSourceId}
            onComplete={handleCredentialsSaved}
          />
          {ready && (
            <IdcReqApprovalModal
              isOpen={approvalOpen}
              onClose={() => setApprovalOpen(false)}
              resources={viewResources}
              onSubmit={handleSubmitApproval}
            />
          )}
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
        </div>
        {/* C-2 action zone: the step-transition CTA docks (sticky) at the card bottom. */}
        {ready && (
          <CardActionBar hint="※ 모든 DB의 연결 테스트가 Success여야 다음 단계로 진행할 수 있어요.">
            <button
              type="button"
              onClick={() => setApprovalOpen(true)}
              disabled={!canRequestApproval}
              className={idcStyles.triggerBtn.primary}
            >
              완료 승인 요청
            </button>
          </CardActionBar>
        )}
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
