'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ChevronRightIcon, InfoCircleIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Ec2InstanceTag, RdsClusterTag } from '@/app/components/ui/RdsInstanceChips';
import { isRdsCluster } from '@/lib/rds-instances';
import { Pagination } from '@/app/components/ui/Pagination';
import { useModal } from '@/app/hooks/useModal';
import { usePagination } from '@/app/hooks/usePagination';
import { useRailHover } from '@/app/hooks/useRailHover';
import { useToast } from '@/app/components/ui/toast';
import { TcSummaryCard, TcSummaryCardSkeleton } from '@/app/components/features/process-status/TcSummaryCard';
import { TcStatusTag } from '@/app/components/features/process-status/TcStatusTag';
import { TcRejectionNotice } from '@/app/components/features/process-status/TcRejectionNotice';
import { TcRunHistoryModal } from '@/app/components/features/process-status/TcRunHistoryModal';
import { isInFlightUi } from '@/app/hooks/useTestConnectionPolling';
import type { UseTestConnectionPollingReturn } from '@/app/hooks/useTestConnectionPolling';
import { useTcCompletionStatus } from '@/app/hooks/useTcCompletionStatus';
import { useTcSettleHold } from '@/app/hooks/useTcSettleHold';
import {
  computeTcBuckets,
  foldAgentStatuses,
  foldTcCardState,
  type TcRunPhase,
} from '@/lib/test-connection-summary';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import {
  getSecrets,
  updateResourceCredential,
} from '@/app/lib/api';
import { CredentialPickModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CredentialPickModal';
import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { CloudReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';
// This table shows the SAME resources steps 1·2·3 just showed, so it reads in their grammar
// rather than the db-list one: identity first, one line per cell, and the row-hover lifts that
// make a wide row scannable. Admin's request tables already borrow these for the same reason.
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  NAME_LIFT,
  NO_LOGICAL_DB_TEXT,
  ROW_BASE,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { ConfirmedResource } from '@/lib/types/resources';
import { hasLogicalDatabases, isEc2Instance, needsCredential, type SecretKey } from '@/lib/types';
import { GROUPED_CHILD_KIND_LABEL, resultUnitId } from '@/lib/resource-grouping';

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

/**
 * 표의 Credential 조회 필터. 경고 줄이 유일한 진입점이라 'assigned' 로는 갈 수 없다 —
 * 분류값('assigned')은 `credState` 가 계속 쓰지만, 필터가 가질 수 있는 값은 이 둘뿐이다.
 */
type CredFilter = 'all' | 'missing';

/** Credential 수정 모달이 여는 행 — 쓰는 대상(resourceId)과 읽는 값(현재 배정). */
interface CredModalTarget {
  resourceId: string;
  current: string;
}

// Local credential edits — the confirmed list from the BFF seeds these, and Run Test
// persists any change via updateResourceCredential before triggering the async test.
type CredMap = Record<string, string>;

// Both copied from the steps 1·2·3 table so the two read as one surface.
const MONO_CELL = 'whitespace-nowrap font-mono text-[12px]';
const PLACEHOLDER = '—';

const seedCreds = (confirmed: readonly ConfirmedResource[]): CredMap =>
  Object.fromEntries(confirmed.map((r) => [r.resourceId, r.credentialId ?? '']));

// "불필요" 로 떨어지는 것은 `needsCredential` 이 세는 IAM 기반 엔진뿐이다(lib/types.ts).
// 엔진을 모를 때(null·빈 문자열)는 여기서 false 다 — 없는 값을 "필요" 로 읽으면 이 화면에만
// 미설정 경고가 서고 Run Test 가 영영 막힌다. 계약상 database_type 은 optional 이다.
const requiresCredential = (databaseType: string | null): boolean =>
  !!databaseType && needsCredential(databaseType);

/**
 * One row of this table = one thing the connection test actually reports on.
 *
 * For Athena that is the REGION, not the database: the result comes back keyed on
 * `athena_region_resource_id` (`athena:<acct>:<region>/<catalog>`), so every database of one
 * region shares a single verdict. Listing them separately printed that one verdict four times,
 * implied four tests had run, and counted four units in the progress strip — and each of those
 * rows looked its status up by its own database id, which no result is ever keyed on.
 */
interface TestUnit {
  /** The id the result is keyed on — see `resultUnitId`. */
  unitId: string;
  region: string | null;
  databaseType: string | null;
  /** Top-level resource type of the unit's first row — drives the RDS-cluster tag only. */
  resourceType: string | null;
  /** The confirmed rows this unit covers: one, or every database of an Athena region. */
  members: ConfirmedResource[];
  /** True when this row stands for a region rather than for a single resource. */
  folded: boolean;
}

const toTestUnits = (confirmed: readonly ConfirmedResource[]): TestUnit[] => {
  const units: TestUnit[] = [];
  const byUnitId = new Map<string, TestUnit>();
  for (const resource of confirmed) {
    const unitId = resultUnitId(resource);
    const existing = byUnitId.get(unitId);
    if (existing) {
      existing.members.push(resource);
      continue;
    }
    const unit: TestUnit = {
      unitId,
      region: resource.region ?? null,
      databaseType: resource.databaseType ?? null,
      resourceType: resource.type ?? null,
      members: [resource],
      folded: !!resource.athenaRegionResourceId,
    };
    byUnitId.set(unitId, unit);
    units.push(unit);
  }
  return units;
};

interface ConnectionTestCardProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  providerLabel: string;
  /** Refetch the project — advances to step 6 when the process status flips. */
  refreshProject: () => void;
  /** Step 이 소유한 폴링 — 헤더 태그(ProjectPageMeta)와 같은 관찰을 나눠 받는다. */
  polling: UseTestConnectionPollingReturn;
}

/**
 * Cloud Step 5 — connection test (v16 `data-prov-view="azure gcp aws"` card). Collapses
 * the former confirmed-resources + connection-test panel + logical-DB-check slots into one
 * card that mirrors the IDC step5 layout: conn-progress strip + a single table (cred select +
 * connection status + logical-DB-check) + a gated completion-approval request → CloudReqApprovalModal.
 *
 * Live wiring (ADR-019): Run Test persists changed credentials then triggers the async
 * connection test (`useTestConnectionPolling`); per-unit status is the FAIL-first fold of
 * the latest poll's agent results (lib/test-connection-summary). Once the run settles
 * SUCCESS the completion-status is fetched (useTcCompletionStatus) and the 완료 승인 요청
 * CTA opens only when it reads LATEST_TEST_CONNECTION_SUCCESS; the summary card holds the
 * state-driven CTA slot (시안 A — 실행 / 다시 실행 / 승인 요청 swap with the folded
 * card state), the run's timestamps and the 실행 이력 modal, and the rejection
 * notice surfaces the admin's re-run reason.
 */
export const ConnectionTestCard = ({
  targetSourceId,
  confirmed,
  providerLabel,
  refreshProject,
  polling,
}: ConnectionTestCardProps) => {
  const { latestJob, uiState, loading, canRunTest, retry, trigger, triggerError, fetchError } = polling;
  const [creds, setCreds] = useState<CredMap>(() => seedCreds(confirmed));
  const [approvalOpen, setApprovalOpen] = useState(false);
  // The table, the progress strip and the Run Test gate all run on units — one row per thing
  // the test reports on. Only the completion-approval summary still lists databases.
  const units = useMemo(() => toTestUnits(confirmed), [confirmed]);
  // Which folded regions are open. Collapsed by default: the databases are reference here —
  // nothing on those rows is acted on, and the row the user works with is the region.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Tree rails: hovering a folded region or any of its databases lights the whole rail.
  const railRow = useRailHover();
  const toggleUnit = useCallback((unitId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(unitId)) next.add(unitId);
      return next;
    });
  }, []);
  const [credFilter, setCredFilter] = useState<CredFilter>('all');
  const logicalModal = useModal<LogicalModalTarget>();
  const credModal = useModal<CredModalTarget>();
  const [savingCred, setSavingCred] = useState(false);
  const toast = useToast();

  // DB Credential options from GET .../secrets (not a hardcoded list). 이름만 뽑지 않고
  // 레코드를 그대로 들고 있는다 — 이름이 비슷한 후보를 가르는 것은 생성 시각이라, 고르는
  // 모달이 그 값을 같이 보여준다.
  const [credOptions, setCredOptions] = useState<SecretKey[]>([]);
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

  // Re-seed credentials when the confirmed list changes (provider retry / target switch).
  // Adjusting state during render (the React "previous props" pattern) instead of an
  // effect — avoids the cascading-render an effect-body setState would cause.
  const [seededFrom, setSeededFrom] = useState(confirmed);
  if (seededFrom !== confirmed) {
    setSeededFrom(confirmed);
    setCreds(seedCreds(confirmed));
  }

  const testing = isInFlightUi(uiState);

  // Per-unit verdict from the latest poll (hydrates on mount, B3). FAIL-first fold —
  // several agents may report on one unit, and the previous last-write-wins map could
  // overwrite a FAIL with a later SUCCESS (P4).
  const unitIds = useMemo(() => units.map((u) => u.unitId), [units]);
  const statusByResource = useMemo(
    () =>
      foldAgentStatuses(
        latestJob?.test_connection_agent_results ?? [],
        new Set(unitIds),
      ),
    [latestJob, unitIds],
  );

  // A row is connected when the latest poll returned SUCCESS for this unit. The credential
  // is NOT part of this: the test result is what the agent actually reported, and folding a
  // local "is a credential picked" check into it made a healthy target read 대기 — the strip
  // said "성공 2 · 대기 3 · 40%" for a run every unit had passed. A missing credential is
  // shown where it is fixed (the DB Credential column) and gates Run Test, nothing else.
  const unitCred = useCallback((unit: TestUnit) => creds[unit.members[0].resourceId] ?? '', [creds]);
  const rowConnected = useCallback(
    (unit: TestUnit): boolean => statusByResource.get(unit.unitId) === 'SUCCESS',
    [statusByResource],
  );

  // Credential 상태 분류 — 경고 줄과 표 필터가 같은 판정을 쓴다. `none` 은 Athena / DynamoDB /
  // CosmosDB 처럼 Credential 없이 연결하는 행("불필요")이고, 지정에도 미등록에도 잡히지 않는다.
  const credState = useCallback(
    (unit: TestUnit): 'all' | 'assigned' | 'missing' | 'none' =>
      !requiresCredential(unit.databaseType) ? 'none' : unitCred(unit) ? 'assigned' : 'missing',
    [unitCred],
  );
  const missingCount = useMemo(
    () => units.filter((u) => credState(u) === 'missing').length,
    [units, credState],
  );
  const filteredUnits = useMemo(
    () => (credFilter === 'all' ? units : units.filter((u) => credState(u) === credFilter)),
    [units, credFilter, credState],
  );

  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(filteredUnits, {
    initialPageSize: 10,
  });
  const handleCredFilter = useCallback(
    (next: CredFilter) => {
      setCredFilter(next);
      setPage(0);
    },
    [setPage],
  );
  // 미등록만 보는 중에 마지막 하나를 지정하면 경고 줄이 사라진다 — 필터를 그대로 두면 표가
  // 빈 화면이 되고, 그것을 되돌릴 컨트롤도 같이 사라진 뒤다. 사라질 때 같이 푼다.
  if (credFilter === 'missing' && missingCount === 0) {
    setCredFilter('all');
    setPage(0);
  }

  // Gate the 완료 승인 요청 CTA on completion-status (the contract's verdict), not on
  // the poll alone: LOGICAL_DATABASE_RECENTLY_UPDATED keeps it closed until a re-run,
  // exactly as the IDC step already does. The verdict also refines the settled card
  // state (성공/정책 변경/확인 완료 — foldTcCardState below).
  const {
    completion,
    approvalEnabled,
    policyChangedAt,
    failed: completionFailed,
    refresh: refreshCompletion,
  } = useTcCompletionStatus(targetSourceId, uiState, latestJob?.test_connection_version ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Run Test gate (v16 updateConnRunBtn): every row that needs a credential has one.
  const total = units.length;
  const allCredsSet =
    total > 0 && units.every((u) => !requiresCredential(u.databaseType) || !!unitCred(u));

  // 누를 수 있는지는 훅이 한 사실로 답한다(canRunTest). 여기서 조건을 다시 조립하지 않는다 —
  // 항을 하나 빠뜨리면 그 자리가 곧 "아직 모르는데 누를 수 있는" 창이 된다.
  const runDisabled = !canRunTest || !allCredsSet;
  const runTest = useCallback(async () => {
    if (runDisabled) return;
    await trigger();
  }, [runDisabled, trigger]);

  // 모달의 저장이 PUT 을 쏘고, 성공했을 때만 로컬 값이 바뀐다.
  const handleCredSubmit = useCallback(async (next: string) => {
    const target = credModal.data;
    if (!target) return;
    setSavingCred(true);
    try {
      await updateResourceCredential(targetSourceId, target.resourceId, next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
      return;
    } finally {
      setSavingCred(false);
    }
    setCreds((prev) => ({ ...prev, [target.resourceId]: next }));
    credModal.close();
  }, [targetSourceId, toast, credModal]);

  // On save the skip policy persists, which flips completion-status
  // (LATEST_TEST_CONNECTION_SUCCESS → LOGICAL_DATABASE_RECENTLY_UPDATED, spec §7);
  // re-reading it closes the CTA and flips the card into the policy-changed
  // state — the toast is no longer the only trace of "you must re-run".
  const handleSaved = useCallback(() => {
    toast.success('논리 DB 제외 정책을 저장했습니다. 연결 테스트를 다시 실행해야 반영됩니다.');
    logicalModal.close();
    refreshCompletion();
    refreshProject();
  }, [logicalModal, toast, refreshCompletion, refreshProject]);

  const handleSaveError = useCallback(() => {
    toast.error('논리 DB 제외 정책 저장에 실패했습니다.');
  }, [toast]);

  const handleSubmitApproval = useCallback(() => {
    setApprovalOpen(false);
    refreshProject();
  }, [refreshProject]);

  // Phase-aware buckets (shared rule): 미보고 is its own fact, never folded into 대기,
  // and % counts reported units only — an unfinished run can no longer read "100%".
  const buckets = useMemo(() => computeTcBuckets(unitIds, statusByResource), [unitIds, statusByResource]);
  // Phase from the RUN's own status, not re-derived from counts — the summary must say
  // what latest_version says, and the counts sit beside it as the evidence.
  // `holding` 은 표시 국면만 붙잡는다: 정착 직후 400ms 동안 최종 버킷을 든 running
  // 프레임이 서서 바가 끝까지 차는 걸 보여준 뒤 판정 프레임으로 넘어간다. Run Test
  // 버튼·승인 게이트는 실 상태(testing/uiState)를 그대로 쓴다.
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
  // 시안 A: run phase × completion verdict → one card state, one slot CTA. The header
  // Run Test and the bottom action bar both folded into the strip's slot — at any
  // moment the card shows one primary.
  const cardState = foldTcCardState(phase, completion);
  // Completion-approval gate: every target connected, no test in flight, and
  // completion-status reads LATEST_TEST_CONNECTION_SUCCESS.
  const canRequestApproval = total > 0 && buckets.ok === total && !testing && approvalEnabled;

  return (
    <section className={cardStyles.base}>
      <header className={cardStyles.header}>
        <div>
          <span className={cardStyles.stepTag}>5단계</span>
          <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            지정한 Credential로 각 대상에 실제 접속해 자격 증명, 네트워크(방화벽·보안 그룹), Agent 연결을 한 번에
            확인합니다.
          </p>
        </div>
      </header>
      {/* Two groups, not one even stack: distance carries ownership (proposal A). Inside a
          group rows sit 8px apart; the verdict group and the table group are 24px apart. */}
      <div className={cn(cardStyles.body, 'space-y-6')}>
        <div className="space-y-2">
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
          {/* 실패한 완료 상태 조회는 닫힌 게이트와 같은 픽셀이면 안 된다 — 이유 없이 비활성인
              승인 버튼만 남는다. fetchError 와 같은 문법: 한 줄 + 재시도. */}
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
          {/* 조회가 실패하면 실행 CTA 는 잠긴 채로 남는다(무엇이 도는지 모르므로). 그 잠금을 푸는
              길은 조회 성공뿐이라, 폴링이 포기한 뒤에는 이 버튼이 유일한 출구다. */}
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
          </div>
        <div className="space-y-2">
          {/* Table + pagination are ONE stack, exactly as steps 2·3 and 6·7 compose them: the
              table itself carries no border or shadow, and the pagination bar below supplies the
              only stroke and the bottom radius. The framed `table.frame` this used to sit in drew
              a second box inside the card — a card inside a card, at a heavier weight than any
              border on those steps.
              Those steps cap the stack with the filter toolbar (top-rounded, the approvalHeader
              fill); here the header row — same fill — is the cap and takes the radius. */}
          {/* 미등록이 0 인 것이 정상 상태다. 그 사실을 말하려고 상시 카드 세 장을 두었더니, 아무 할
              일이 없다는 말이 화면의 90px 을 차지했고 (전체 = 지정 + 미등록) 도 성립하지 않았다 —
              Athena·DynamoDB 처럼 Credential 이 "불필요" 한 행은 어느 카드에도 안 잡히기 때문이다.
              조치가 필요할 때만 한 줄이 생긴다. 그 줄의 링크가 곧 필터이므로 요약과 도달 수단이 한
              물건이고, 분류를 세지 않으니 합계가 어긋날 수도 없다. */}
          {/* Bare row in the table group — this is the table's own missing-value notice, so
              it sits 8px above the stack it filters instead of boxing itself (proposal A). */}
          {missingCount > 0 && (
            <div className={cn('flex items-center gap-2 text-[14px]', statusColors.warning.textDark)}>
              {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 마크가 색 없이도 같은 뜻을 진다. */}
              <StatusWarningIcon className="h-4 w-4 shrink-0" />
              {/* IDC step 5 와 같은 어휘(미설정) — 같은 스텝이 CSP 마다 다른 말을 쓰지 않는다. */}
              <span className="break-keep">
                Credential 미설정 <strong className="font-bold">{missingCount}건</strong> — 지정해야 연결
                테스트를 실행할 수 있어요
              </span>
              <button
                type="button"
                onClick={() => handleCredFilter(credFilter === 'missing' ? 'all' : 'missing')}
                aria-pressed={credFilter === 'missing'}
                className={cn(
                  'ml-auto shrink-0 whitespace-nowrap font-semibold underline underline-offset-2',
                  primaryColors.focusRing,
                )}
              >
                {credFilter === 'missing' ? '전체 보기' : '미설정만 보기'}
              </button>
            </div>
          )}
          <div>
            {/* CONNECTED_FRAME's own `overflow-hidden` and an `overflow-x-auto` would be two
                values of one property on one element, and `cn` is a plain join — which of them
                wins would be decided by Tailwind's emit order. Separate elements: the frame clips
                to the radius, the inner box scrolls. */}
            <div className={cn(CONNECTED_FRAME, 'rounded-t-[12px]')}>
              <div className="overflow-x-auto">
              {/* 연결 상태 칸이 스켈레톤인 동안은 표가 아직 채워지는 중이다 — 보조기술에도 그렇게 말한다. */}
              <table className="w-full" aria-busy={loading}>
                <thead className={idcStyles.table.approvalHeader}>
                  {/* Steps 1·2·3 order, verbatim: identity (name → id) → attributes (type ·
                      region) → what this step asks of the row. A user arrives here having read
                      the same rows three times already; leading with Database Type made them
                      re-find the anchor they had been scanning by. */}
                  {/* Resource ID is the one column steps 1·2·3 carry that this step drops. Seven
                      columns at the approval table's 18px gutters want 1160px in a 948px card, so
                      one had to go, and this is the only one nothing here is decided by: the row is
                      already named, typed and located by the three columns around it, while every
                      other column is either that anchor or an action. Step 4 drops the same class of
                      column for the same reason. */}
                  <tr className="whitespace-nowrap">
                    <th className={cn(idcStyles.table.approvalHeaderCell, idcStyles.table.nameCell)}>Resource Name</th>
                    <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                    <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                    <th className={idcStyles.table.approvalHeaderCell}>
                      {/* "DB" 는 표 전체가 이미 DB 얘기라 붙일 필요가 없었다. 대신 이 열이 무엇을
                          고르는 것인지는 이름만으로 안 읽히므로 (i) 로 한 번 설명한다. 밝은 variant:
                          흰 표 위의 검은 상자는 다른 시스템의 UI 처럼 보인다. */}
                      <span className="inline-flex items-center gap-1">
                        Credential
                        {/* 엔진을 열거하지 않는다 — 목록(lib/types.ts NO_CREDENTIAL_ENGINES)은 엔진이
                            늘 때마다 바뀌고, 여기 적은 예시는 같이 안 바뀐다. 표가 이미 찍은 값을
                            가리키는 편이 언제나 참이다. */}
                        <Tooltip
                          variant="value"
                          size="lg"
                          content={
                            <span className={idcStyles.table.headerTipBody}>
                              해당 DB에 접속할 때 사용할 계정 정보예요. Credentials 메뉴에서 등록한 것 중에서 고르고,
                              불필요로 표시된 대상은 이 단계에서 지정하지 않아요.
                            </span>
                          }
                        >
                          <InfoCircleIcon className={cn('h-3.5 w-3.5', textColors.tertiary)} aria-label="Credential 설명" />
                        </Tooltip>
                      </span>
                    </th>
                    <th className={idcStyles.table.approvalHeaderCell}>연결 상태</th>
                    <th className={idcStyles.table.approvalHeaderCell}>논리 DB 확인</th>
                  </tr>
                </thead>
                <tbody className={idcStyles.table.body}>
                  {pageRows.map((unit) => {
                    const cred = unitCred(unit);
                    const status = statusByResource.get(unit.unitId);
                    const connected = rowConnected(unit);
                    const credRequired = requiresCredential(unit.databaseType);
                    const [first] = unit.members;
                    const open = expanded.has(unit.unitId);
                    // Only a folded region draws a rail; a flat unit gets no handlers so a
                    // pointer move down the list does not re-render the table for nothing.
                    const rail = unit.folded ? railRow(unit.unitId) : undefined;
                    // Only a tagged row is two lines — an untagged one is already on the middle.
                    const stackedIdentity =
                      isRdsCluster(unit.resourceType ?? '') || isEc2Instance(unit.resourceType);
                    return (
                      <Fragment key={unit.unitId}>
                      <tr
                        className={cn(ROW_BASE, ROW_TARGET, unit.folded && 'cursor-pointer', rail?.className)}
                        onClick={unit.folded ? () => toggleUnit(unit.unitId) : undefined}
                        onMouseEnter={rail?.onMouseEnter}
                        onMouseLeave={rail?.onMouseLeave}
                      >
                        {/* A folded row stands for a REGION, which has no resource name, so this
                            cell carries the disclosure and the engine's label instead. Opening it
                            lists the databases below, in the column their names belong to.
                            The label reads in the SAME type as every other name in this column,
                            not in the steps 1·2·3 group-parent weight: there a heavier parent
                            separates itself from the children right under it, here the row's
                            neighbours are ordinary resources and a bolder one would just shout. */}
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            idcStyles.table.nameCell,
                            'font-mono text-[14px]',
                            textColors.primary,
                            NAME_LIFT,
                            unit.folded && open && idcStyles.table.group.parentCell,
                          )}
                        >
                          {unit.folded ? (
                            <span className={idcStyles.table.group.lead}>
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={`${unit.region ?? ''} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleUnit(unit.unitId);
                                }}
                                className={cn(
                                  idcStyles.table.group.toggle,
                                  open
                                    ? idcStyles.table.group.toggleOpen
                                    : idcStyles.table.group.toggleClosed,
                                  primaryColors.focusRing,
                                )}
                              >
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              </button>
                              <span className="whitespace-nowrap">
                                {getDatabaseShortLabel(unit.databaseType ?? '')}
                              </span>
                            </span>
                          ) : (
                            // One line, always — the widest names here ran to four lines and left
                            // row heights ragged. Full value in the tip, as on steps 1·2·3.
                            // A cluster stacks the RDS Cluster tag above the name, the same
                            // two-line identity steps 1·2·3·4·6·7 use.
                            <span className={cn(
                              'flex min-w-0 flex-col items-start gap-1',
                              stackedIdentity && idcStyles.table.stackedIdentityLift,
                            )}>
                              {isRdsCluster(unit.resourceType ?? '') && <RdsClusterTag />}
                              {isEc2Instance(unit.resourceType) && <Ec2InstanceTag />}
                              <Tooltip
                                content={
                                  <IdentifierTip label="Resource Name" value={first.resourceName ?? ''} />
                                }
                                variant="value"
                                size="md"
                                triggerClassName="min-w-0 max-w-[200px] block"
                                truncatedOnly
                              >
                                <span className="block truncate">
                                  {first.resourceName || PLACEHOLDER}
                                </span>
                              </Tooltip>
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            'text-[12px]',
                            textColors.secondary,
                            CELL_LIFT,
                          )}
                        >
                          {unit.databaseType ? getDatabaseShortLabel(unit.databaseType) : PLACEHOLDER}
                        </td>
                        <td
                          className={cn(
                            idcStyles.table.approvalCell,
                            MONO_CELL,
                            textColors.secondary,
                            CELL_LIFT,
                          )}
                        >
                          {unit.region || PLACEHOLDER}
                        </td>
                        {/* 값은 밑줄 텍스트로 읽고 수정은 모달에서 — 관리자 화면의 Credential
                            배정과 같은 문법이다. 행마다 select 를 놓으면 표가 컨트롤 판이 되고,
                            고르는 순간 저장돼 두 후보를 비교할 수도 없었다.
                            Athena·DynamoDB 처럼 Credential 없이 연결하는 엔진은 고칠 것이 없으므로
                            버튼이 아니라 평문이다. */}
                        <td className={idcStyles.table.approvalCell}>
                          {credRequired ? (
                            <button
                              type="button"
                              onClick={() =>
                                credModal.open({
                                  resourceId: first.resourceId,
                                  current: cred,
                                })
                              }
                              aria-label={`${first.resourceName ?? first.resourceId} Credential 수정 — 현재 ${cred || '미설정'}`}
                              title={cred || undefined}
                              className={cn(idcStyles.triggerBtn.linkNeutral, 'max-w-[160px]')}
                            >
                              {cred ? (
                                <span className="min-w-0 truncate font-mono">{cred}</span>
                              ) : (
                                <span className="font-sans">미설정</span>
                              )}
                            </button>
                          ) : (
                            <span
                              className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                            >
                              불필요
                            </span>
                          )}
                        </td>
                        {/* 어휘·스켈레톤 규칙은 `TcStatusTag` 가 진다 — IDC step 5 의 표가 같은
                            칸을 그리므로, 두 CSP 가 같은 판정을 다른 말로 하지 않도록 한 곳에 둔다. */}
                        <td className={idcStyles.table.approvalCell}>
                          <TcStatusTag
                            status={status}
                            // 조회를 못 했으면 회차가 없다고 단정하지 않는다 — 실패는 빈 결과가 아니다.
                            hasRun={fetchError ? null : !!latestJob}
                            loading={loading}
                          />
                        </td>
                        {/* Athena·DynamoDB are IAM-based and have no logical-DB management at all,
                            so there is nothing here to configure — the button used to open anyway
                            (it was gated on `connected` alone) onto a screen for a concept that
                            does not exist. Keyed on the engine, not on the Athena fold: DynamoDB
                            has no region fold to read off. */}
                        <td className={idcStyles.table.approvalCell}>
                          {!hasLogicalDatabases(unit.databaseType) ? (
                            <span
                              className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}
                            >
                              {NO_LOGICAL_DB_TEXT}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={!connected}
                              onClick={() =>
                                logicalModal.open({
                                  resourceId: first.resourceId,
                                  resourceName: first.resourceName ?? first.resourceId,
                                })
                              }
                              className={cn(idcStyles.triggerBtn.ghostSm, 'whitespace-nowrap')}
                            >
                              설정
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Database list. The name, and what the name IS — read down the tree the
                          Database Type column says Athena → Database, exactly as on steps 1·2·3.
                          Without it `default` is just a string. Every other cell stays empty: the
                          region row above already answers them and none of it varies per database. */}
                      {unit.folded &&
                        open &&
                        unit.members.map((db, index) => (
                          <tr
                            key={db.resourceId}
                            className={cn(ROW_BASE, rail?.className)}
                            onMouseEnter={rail?.onMouseEnter}
                            onMouseLeave={rail?.onMouseLeave}
                          >
                            <td
                              className={cn(
                                idcStyles.table.approvalCell,
                                'font-mono text-[14px]',
                                textColors.primary,
                                idcStyles.table.group.childCell,
                                index === unit.members.length - 1 &&
                                  idcStyles.table.group.childCellLast,
                              )}
                            >
                              {db.resourceName ?? db.resourceId}
                            </td>
                            <td
                              className={cn(
                                idcStyles.table.approvalCell,
                                'text-[12px]',
                                textColors.secondary,
                              )}
                            >
                              {GROUPED_CHILD_KIND_LABEL}
                            </td>
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                            <td className={idcStyles.table.approvalCell} />
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className={cn(
                          idcStyles.table.approvalCell,
                          'py-8 text-center text-[12px]',
                          textColors.tertiary,
                        )}
                      >
                        조건에 맞는 결과가 없어요.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
            {filteredUnits.length > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={filteredUnits.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </div>
          </div>
        <CloudReqApprovalModal
          isOpen={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          resources={confirmed}
          providerLabel={providerLabel}
          targetSourceId={targetSourceId}
          onSubmit={handleSubmitApproval}
        />
        {credModal.data && (
          <CredentialPickModal
            isOpen={credModal.isOpen}
            onClose={credModal.close}
            target={{ label: 'Resource ID', value: credModal.data.resourceId }}
            value={credModal.data.current}
            options={credOptions}
            saving={savingCred}
            onSubmit={handleCredSubmit}
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
            onSaved={handleSaved}
            onError={handleSaveError}
            onClose={logicalModal.close}
          />
        )}
      </div>
    </section>
  );
};
