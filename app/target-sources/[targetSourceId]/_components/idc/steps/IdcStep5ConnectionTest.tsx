'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppError } from '@/lib/errors';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { TcSummaryCard, TcSummaryCardSkeleton } from '@/app/components/features/process-status/TcSummaryCard';
import { TcRejectionNotice } from '@/app/components/features/process-status/TcRejectionNotice';
import { TcRunHistoryModal } from '@/app/components/features/process-status/TcRunHistoryModal';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { useModal } from '@/app/hooks/useModal';
import { isInFlightUi, useTestConnectionPolling } from '@/app/hooks/useTestConnectionPolling';
import { useTcCompletionStatus } from '@/app/hooks/useTcCompletionStatus';
import { useTcSettleHold } from '@/app/hooks/useTcSettleHold';
import {
  computeTcBuckets,
  foldAgentStatuses,
  foldTcCardState,
  type TcRunPhase,
} from '@/lib/test-connection-summary';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import { IDC_SOURCE_LABEL } from '@/lib/constants/idc';
import {
  getSecrets,
  updateResourceCredential,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { RejectionAlert } from '@/app/target-sources/[targetSourceId]/_components/common';
import { IdcConfirmedResourcesPanel } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel';
import { CredentialPickModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CredentialPickModal';
import { IdcReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcReqApprovalModal';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { getProject } from '@/app/lib/api';
import { getIdcConfirmedResources, type IdcConnState, type IdcResourceView } from '@/app/lib/api/idc';
import type { ResourcesState } from '@/app/hooks/useIdcResources';
import type { SecretKey } from '@/lib/types';

const EMPTY_RESOURCES: readonly IdcResourceView[] = [];

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

/** Credential 수정 모달이 여는 행 — 쓰는 대상(resourceId), 표가 부르는 이름, 현재 배정. */
interface CredModalTarget {
  resourceId: string;
  label: string;
  current: string;
}

// The wire connection_status is a loose nullable string; keep only the
// IdcConnState members so the table's `connection` stays typed (else PENDING).
const IDC_CONN_STATES: readonly IdcConnState[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'];

/**
 * IDC Step 5 — 연결 테스트.
 * Chrome + the shared IdcConfirmedResourcesPanel (cols `src`, `logicalro`) + a
 * "Run Test" action, so steps 5·6·7 render one table instead of three.
 *
 * The DB Credential is edited in the row, exactly as the cloud step 5 edits it: the value
 * reads as underlined text and the pick commits in CredentialPickModal. A missing one is
 * announced by the conditional warning line above the table and gates Run Test — it is not
 * a separate bulk dialog the run detours through. Connection Status is not a column;
 * per-row status is carried by the progress strip's 성공/실패/대기 counts.
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
  onProjectUpdate,
}: IdcStepProps) => {
  const { targetSourceId } = project;

  const [state, setState] = useState<ResourcesState>({ status: 'loading' });
  const [creds, setCreds] = useState<Record<string, string>>({});
  // DB Credential options from GET .../secrets (not a hardcoded list). 레코드를 그대로
  // 들고 있는다 — 고르는 모달이 이름 말고 User ID·등록일도 같이 보여준다.
  const [credOptions, setCredOptions] = useState<SecretKey[]>([]);
  // Credential 이 바뀌면 다음 Run Test 전까지 완료 승인을 닫는다 — completion-status 는
  // 서버의 판정이라 로컬 변경을 모르므로, 이 로컬 사실만 따로 든다.
  const [credsDirty, setCredsDirty] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const credModal = useModal<CredModalTarget>();
  const [savingCred, setSavingCred] = useState(false);
  // 미설정만 보는 필터. 경고 줄의 링크가 곧 이 값이고, 0건이 되면 함께 풀린다.
  const [credFilterOn, setCredFilterOn] = useState(false);

  const { latestJob, uiState, loading, canRunTest, retry, trigger, triggerError, fetchError } =
    useTestConnectionPolling(targetSourceId);
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
        setCredsDirty(false);
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
        if (active) setCredOptions(secrets);
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
  const testing = isInFlightUi(uiState);

  // Per-resource connection status from the latest poll, keyed by resource_id.
  // The poll streams results as each pipeline settles, so this map is the live
  // source of truth for the table — no extra "tested" gate (B3: a settled prior
  // run hydrates on mount, so it renders immediately on cold load too).
  // FAIL-first fold shared with the cloud card — several agents may report on one
  // resource, and last-write-wins could overwrite a FAIL with a later SUCCESS (P4).
  const statusByResource = useMemo(
    () => foldAgentStatuses(latestJob?.test_connection_agent_results ?? []),
    [latestJob],
  );

  // Project the live poll status onto the rows the table renders. The status flows
  // straight through (SUCCESS / FAIL / RUNNING / PENDING) so the table updates
  // automatically as each pipeline settles.
  const viewResources: IdcResourceView[] = ready
    ? state.resources.map((r) => ({
        ...r,
        credentialId: creds[r.resourceId] || undefined,
        connection: IDC_CONN_STATES.find((s) => s === statusByResource.get(r.resourceId)) ?? 'PENDING',
      }))
    : [];

  // Run Test gate: every live target must have a credential selected first. IDC 는
  // 클라우드와 달리 Credential 없이 연결하는 엔진이 없으므로 "불필요" 분류가 없다.
  const missingCount = liveResources.filter((r) => !creds[r.resourceId]).length;
  // 대상이 0건이면 테스트할 것이 없어 Run Test 는 여전히 닫혀 있지만, 그 이유는 자격 증명이
  // 아니다 — 경고 줄(미설정 ≥ 1 일 때만 뜬다)로는 설명되지 않으므로 따로 말한다.
  const noTargets = liveResources.length === 0;
  const allCredsSet = !noTargets && missingCount === 0;
  // 누를 수 있는지는 훅이 한 사실로 답한다(canRunTest) — 클라우드 step 5 와 같은 처리.
  const runDisabled = !ready || !canRunTest || !allCredsSet;
  // 마지막 하나를 지정하면 경고 줄이 사라진다 — 필터를 그대로 두면 표가 비고, 그것을 되돌릴
  // 컨트롤도 같이 사라진 뒤다.
  if (credFilterOn && missingCount === 0) setCredFilterOn(false);
  // 필터는 패널에 넘기는 목록에서 건다 — 패널의 툴바(검색·DB타입)는 그대로 두고, 이 화면이
  // 소유한 판정만 앞에서 거른다.
  const panelState: ResourcesState =
    credFilterOn && state.status === 'ready'
      ? { ...state, resources: state.resources.filter((r) => !creds[r.resourceId]) }
      : state;

  // Phase-aware buckets (shared rule with the cloud card): 미보고 is its own fact,
  // never folded into 대기, and % counts reported resources only.
  const buckets = useMemo(
    () => computeTcBuckets(liveResources.map((r) => r.resourceId), statusByResource),
    [liveResources, statusByResource],
  );

  // Completion-status gate + settled verdict states — shared hook with the cloud card.
  // The CTA only opens on LATEST_TEST_CONNECTION_SUCCESS; a logical-DB save re-reads it.
  const {
    completion,
    approvalEnabled,
    policyChangedAt,
    failed: completionFailed,
    refresh: refreshCompletion,
  } = useTcCompletionStatus(targetSourceId, uiState, latestJob?.test_connection_version ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const runTest = useCallback(async () => {
    if (runDisabled) return;
    // 의도가 아니라 증거로 푼다: trigger 가 실패하면(409 포함) 실행은 시작되지 않았고,
    // 수정된 Credential 은 여전히 검증 전이다 — 게이트를 미리 풀면 옛 실행의
    // completion-status 로 완료 승인이 열린다.
    const started = await trigger();
    if (started) setCredsDirty(false);
  }, [runDisabled, trigger]);

  // 모달의 저장이 PUT 을 쏘고, 성공했을 때만 로컬 값이 바뀐다 — 클라우드 step 5 와 같다.
  const handleCredSubmit = useCallback(
    async (next: string) => {
      const target = credModal.data;
      if (!target) return;
      setSavingCred(true);
      try {
        await updateResourceCredential(targetSourceId, target.resourceId, next);
        setCreds((prev) => ({ ...prev, [target.resourceId]: next }));
        setCredsDirty(true);
        credModal.close();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
      } finally {
        setSavingCred(false);
      }
    },
    [targetSourceId, toast, credModal],
  );

  const handleCredOpen = useCallback(
    (resource: IdcResourceView) => {
      credModal.open({
        resourceId: resource.resourceId,
        // IDC 행은 ARN 이 아니라 접속 주소로 읽힌다 — 표가 부르는 이름 그대로 모달에 넘긴다.
        label: resource.hosts[0]
          ? `${resource.hosts[0]}${resource.port ? `:${resource.port}` : ''}`
          : resource.resourceId,
        current: creds[resource.resourceId] ?? '',
      });
    },
    [credModal, creds],
  );

  // Phase from the RUN's own status (latest_version), not re-derived from counts.
  // `holding` 은 표시 국면만 붙잡는다(정착 400ms 박자, 클라우드 카드와 동일) —
  // Run Test 버튼·승인 게이트는 실 상태(testing/uiState)를 그대로 쓴다.
  const { holding, settledLive } = useTcSettleHold(latestJob);
  // holding 이 QUEUED 보다 앞: 정착 박자 동안은 최종 버킷을 든 running 프레임이 선다.
  const phase: TcRunPhase = holding
    ? 'running'
    : uiState === 'QUEUED'
      ? 'queued'
      : uiState === 'RUNNING'
        ? 'running'
        : uiState === 'SUCCESS'
          ? 'success'
          : uiState === 'FAIL'
            ? 'fail'
            : 'idle';
  // 시안 A: run phase × completion verdict → one card state, one slot CTA — the header
  // Run Test and the bottom action bar both folded into the strip's slot (cloud step 5
  // and this card share the fold).
  const cardState = foldTcCardState(phase, completion);

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
    toast.success('논리 DB 제외 정책을 저장했습니다. 연결 테스트를 다시 실행해야 반영됩니다.');
    logicalModal.close();
    // completion-status 가 LOGICAL_DATABASE_RECENTLY_UPDATED 로 넘어갔는지 다시 읽는다 —
    // 토스트가 사라져도 카드가 정책 변경 상태로 남는다.
    refreshCompletion();
    const updated = await getProject(targetSourceId);
    onProjectUpdate(updated);
  }, [logicalModal, toast, onProjectUpdate, targetSourceId, refreshCompletion]);

  const handleLogicalError = useCallback(() => {
    toast.error('논리 DB 제외 정책 저장에 실패했습니다.');
  }, [toast]);

  const canRequestApproval =
    liveResources.length > 0 &&
    buckets.ok === liveResources.length &&
    !testing &&
    approvalEnabled &&
    !credsDirty;
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
      <section className={cardStyles.base}>
        <header className={cardStyles.header}>
          <div>
            <span className={cardStyles.stepTag}>5단계</span>
            <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              지정한 Credential로 각 대상에 실제 접속해 자격 증명, 접근 허용({IDC_SOURCE_LABEL} → 대상 IP:Port),
              Agent 연결을 한 번에 확인합니다.
            </p>
          </div>
        </header>
        <div className={cn(cardStyles.body, 'space-y-4')}>
          {ready && (
            <>
              <TcRejectionNotice
                targetSourceId={targetSourceId}
                runVersion={latestJob?.test_connection_version ?? null}
              />
              {loading ? (
                <TcSummaryCardSkeleton />
              ) : (
              <TcSummaryCard
                state={cardState}
                buckets={buckets}
                run={
                  latestJob
                    ? {
                        requestedAt: latestJob.requested_at ?? null,
                        completedAt: latestJob.completed_at ?? null,
                      }
                    : null
                }
                policyChangedAt={policyChangedAt}
                drawCheck={settledLive}
                onRunTest={() => void runTest()}
                runDisabled={runDisabled}
                onRequestApproval={() => setApprovalOpen(true)}
                approvalDisabled={!canRequestApproval}
                historyAction={
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className={cn(idcStyles.triggerBtn.linkNeutral, 'whitespace-nowrap text-[12px]')}
                  >
                    실행 이력
                  </button>
                }
              />
              )}
              {/* 실패한 완료 상태 조회는 닫힌 게이트와 같은 픽셀이면 안 된다 — 클라우드
                  카드와 같은 문법: 한 줄 + 재시도. */}
              {completionFailed && (
                <p className={cn('flex items-center gap-2 text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
                  {ERROR_MESSAGES.TEST_CONNECTION_COMPLETION_FETCH_FAILED}
                  <button
                    type="button"
                    onClick={refreshCompletion}
                    className={cn(idcStyles.triggerBtn.linkNeutral, 'text-[12px]')}
                  >
                    다시 시도
                  </button>
                </p>
              )}
              {triggerError && (
                <p className={cn('text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>{triggerError}</p>
              )}
              {/* 클라우드 step 5 와 같은 출구 — 조회 실패로 잠긴 Run Test 를 되살리는 유일한 길. */}
              {fetchError && (
                <p className={cn('flex items-center gap-2 text-[12px]', idcStyles.tag.red, 'bg-transparent px-0')}>
                  {ERROR_MESSAGES.TEST_CONNECTION_FETCH_FAILED}
                  <button
                    type="button"
                    onClick={() => void retry()}
                    className={cn(idcStyles.triggerBtn.linkNeutral, 'text-[12px]')}
                  >
                    다시 시도
                  </button>
                </p>
              )}
            </>
          )}
          {/* 미설정 0 이 정상 상태다 — 그때는 아무것도 그리지 않는다. 조치가 필요할 때만 한 줄이
              생기고, 그 줄의 링크가 곧 필터라 요약과 도달 수단이 한 물건이다. */}
          {ready && noTargets && (
            <p className={cn('text-[14px]', textColors.tertiary)}>
              연동 대상이 없어 연결 테스트를 실행할 수 없어요. 2단계에서 대상을 확정해 주세요.
            </p>
          )}
          {ready && missingCount > 0 && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[14px]',
                statusColors.warning.bgSoft,
                statusColors.warning.border,
                statusColors.warning.textDark,
              )}
            >
              <StatusWarningIcon className="h-4 w-4 shrink-0" />
              <span className="break-keep">
                Credential 미설정 <strong className="font-bold">{missingCount}건</strong> — 지정해야 연결 테스트를
                실행할 수 있어요
              </span>
              <button
                type="button"
                onClick={() => setCredFilterOn((on) => !on)}
              aria-pressed={credFilterOn}
                className={cn(
                  'ml-auto shrink-0 whitespace-nowrap font-semibold underline underline-offset-2',
                  primaryColors.focusRing,
                )}
              >
                {credFilterOn ? '전체 보기' : '미설정만 보기'}
              </button>
            </div>
          )}
          {/* Toolbar, table and pagination are one card, so the section's space-y-4 must not
              get between them — the wrapper absorbs it. */}
          <div>
            <IdcConfirmedResourcesPanel
              targetSourceId={targetSourceId}
              state={panelState}
              onLogicalOpen={handleLogicalOpen}
              credentials={creds}
              onCredentialOpen={handleCredOpen}
            />
          </div>
          {credModal.data && (
            <CredentialPickModal
              isOpen={credModal.isOpen}
              onClose={credModal.close}
              target={{ label: '접속 주소', value: credModal.data.label }}
              value={credModal.data.current}
              options={credOptions}
              saving={savingCred}
              onSubmit={handleCredSubmit}
            />
          )}
          {ready && (
            <IdcReqApprovalModal
              isOpen={approvalOpen}
              onClose={() => setApprovalOpen(false)}
              resources={viewResources}
              onSubmit={handleSubmitApproval}
            />
          )}
          <TcRunHistoryModal
            open={historyOpen}
            targetSourceId={targetSourceId}
            onClose={() => setHistoryOpen(false)}
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
        </div>
      </section>
      <RejectionAlert project={project} />
    </>
  );
};
