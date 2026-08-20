'use client';

/**
 * 관리자 승인 tab — the process branch this target's Step 6 exists for.
 *
 * Its own tab rather than a card inside Test Connection because it is a STATE
 * TRANSITION, not test content: 재실행 요청 sends the target back to Step 5,
 * PII Agent 설치 완료 moves it to Step 7. The tab is always present, so the
 * operator can see what the decision is waiting on at any step — it is not
 * conditionally hidden.
 *
 * Flow: 서비스가 Target Source 상세에서 Test Connection 완료 확인(PUT
 * …/test-connection-acknowledgment)을 누르면 Step 5 → Step 6 으로 넘어오고, 관리자는
 * 결과를 보고 둘 중 하나를 고른다 —
 *   재실행 요청        POST …/test-connection/reject          (서비스 단계로 되돌림)
 *   PII Agent 설치 완료 POST …/pii-agent-installation/confirm  (연동 확정)
 *
 * TWO conditions gate the approve CTA (the 승인 조건 checklist states both):
 *   ① 서비스 완료 확인 (status = TEST_CONNECTION_COMPLETED)
 *   ② 모니터링 헬스 HEALTHY (assumed §10 dag-status, allowlist — approvalGate.ts)
 * Before ① there is nothing to decide, so the tab states what it is waiting for
 * instead of showing dead buttons; after ①, 재실행 요청 stays mounted even when
 * ② fails — it is the operator's only exit on UNHEALTHY.
 *
 * The result summary is carried here (counts + 완료 확인 시각) so the decision does
 * not require hopping back to Test Connection to recall what is being approved.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { rejectTestConnection, confirmInstallation } from '@/app/lib/api/task-queue-tc';
import { getDagStatus } from '@/app/lib/api/ops';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  TcRerunModal,
  TcApproveModal,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcActionModals';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TcStatTile } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import type { TcResultStats } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import {
  TC_COMPLETED,
  TC_REJECTED,
  aggregateDagStatus,
  foldApprovalHead,
  healthVerdict,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { HealthSummaryBand } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/HealthSummaryBand';
import { AgentDagTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AgentDagTable';
import { DbWeeklyBoard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';
import { DagDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DagDetailModal';
import type {
  BoardFilter,
  DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const n = (value: number): string => value.toLocaleString('ko-KR');

type GateRowState = 'ok' | 'err' | 'warn' | 'pending';

/** One 승인 조건 row — icon + 완료형 서술문 + (있으면) 근거 시각 + 보조 CTA. */
function GateRow({
  state,
  text,
  suffix,
  titleHint,
  meta,
  action,
}: {
  state: GateRowState;
  text: string;
  suffix?: string;
  /** Debug-tier raw value (wire vocabulary) — tooltip only, never in the copy. */
  titleHint?: string;
  meta?: string;
  action?: ReactNode;
}): ReactElement {
  const icon =
    state === 'ok' ? (
      <Icon name="check-circle" size={16} className="text-[var(--pl-ok-text)]" />
    ) : state === 'err' ? (
      <Icon name="x-circle" size={16} className="text-[var(--pl-err-text)]" />
    ) : state === 'warn' ? (
      <Icon name="warn-tri" size={16} className="text-[var(--pl-warn-text)]" />
    ) : (
      <span aria-hidden className="block h-4 w-4 rounded-full border-2 border-[var(--pl-border-strong)]" />
    );
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span className="flex-none">{icon}</span>
      <span className="min-w-0 flex-1 text-[14px] text-[var(--pl-text-strong)]" title={titleHint}>
        {text}
        {suffix && <span className="text-[12px] text-[var(--pl-text-weak)]"> {suffix}</span>}
      </span>
      {meta && (
        <span className="flex-none text-[12px] tabular-nums text-[var(--pl-text-weak)]">{meta}</span>
      )}
      {action}
    </div>
  );
}

export interface ApprovalTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Service acknowledgment row — gate ① (fetched by the page). */
  status: TestConnectionStatusRow | null;
  /** Latest Test Connection counts, shown as the basis of the decision. */
  stats: TcResultStats;
  /** Both outcomes change the target's step, so the whole page reloads. */
  onDecided: () => void;
}

export function ApprovalTab({
  targetSourceId,
  detail,
  status,
  stats,
  onDecided,
}: ApprovalTabProps): ReactElement {
  const toast = usePlToast();
  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const tcCompleted = status?.status === TC_COMPLETED;
  const isRejected = status?.status === TC_REJECTED;

  // Gate ② — dag-status is fetched only once TC 완료 확인 (fetch gate, §10);
  // before that there is nothing to check, and every consumer below gates on
  // tcCompleted before reading `dag`. Abort-on-deps-change is the stale-response
  // guard (PagedCard pattern); a rapid 다시 확인 bumps dagReload and cancels the
  // in-flight read.
  const [dag, setDag] = useState<DagFetch>({ phase: 'loading' });
  const [dagReload, setDagReload] = useState(0);
  useAbortableEffect(
    (signal) => {
      if (!tcCompleted) return;
      setDag({ phase: 'loading' });
      return getDagStatus(targetSourceId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          setDag({ phase: 'loaded', data, fetchedAt: new Date().toISOString() });
        })
        .catch(() => {
          if (signal.aborted) return;
          setDag({ phase: 'failed' });
        });
    },
    [tcCompleted, targetSourceId, dagReload],
  );
  const retryDag = (): void => setDagReload((k) => k + 1);

  // 논리 DB 주간 보드 — 우측 오버레이 패널(벤치마크 시안 A). 진입 3곳(밴드의 실패
  // 숫자 · 에이전트 표의 "DB 보기" · 요약 라인 버튼)이 프리셋과 함께 연다. ModalShell
  // 은 닫히면 자식을 언마운트하므로 매 오픈이 새 마운트 — 프리셋은 마운트 1회 소비로
  // 충분하고, 옛 착지(스크롤 이동) 코드는 패널이 대체한다.
  const [board, setBoard] = useState<{ filter: BoardFilter; agentId?: string } | null>(null);
  // DAG 상세는 보드가 아니라 여기서 연다 — 패널 위에 겹치는 레이어라 Esc 를 누가
  // 먹을지 결정할 수 있어야 한다. 패널이 닫히면 그 위의 모달도 함께 접는다.
  const [dagRow, setDagRow] = useState<DagDbRow | null>(null);
  const closeBoard = (): void => {
    setDagRow(null);
    setBoard(null);
  };

  // 요약 라인(보드의 본문 잔류물)이 나르는 버킷 집계 — 밴드와 같은 파생을 응답당 1회.
  const agg = useMemo(
    () => (dag.phase === 'loaded' ? aggregateDagStatus(dag.data) : null),
    [dag],
  );

  // On failure the modal stays open and the error surfaces via the section toast.
  const rerun = useApiMutation((reason: string) => rejectTestConnection(targetSourceId, reason), {
    onSuccess: () => {
      setRerunOpen(false);
      toast.show('재실행을 요청했습니다.');
      onDecided();
    },
    onError: () => toast.show('재실행 요청에 실패했습니다.'),
  });

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('PII Agent 설치를 완료 처리했습니다.');
      onDecided();
    },
    onError: () => toast.show('설치 완료 처리에 실패했습니다.'),
  });

  const head = foldApprovalHead(status?.status, dag);

  const retryAction = (
    <PlButton size="sm" onClick={retryDag}>
      다시 확인
    </PlButton>
  );

  // 승인 조건 row ② — the checklist carries the "why", the CTA stays unmounted.
  const healthRow = ((): {
    state: GateRowState;
    suffix: string;
    titleHint?: string;
    meta?: string;
    action?: ReactNode;
  } => {
    if (!tcCompleted) return { state: 'pending', suffix: '— 완료 확인 후 점검합니다' };
    switch (dag.phase) {
      case 'loading':
        return { state: 'pending', suffix: '— 확인 중…' };
      case 'failed':
        return { state: 'err', suffix: '— 확인하지 못했습니다', action: retryAction };
      case 'loaded': {
        const verdict = healthVerdict(dag.data.healthStatus);
        const meta = `조회 ${fmtDateTimeSec(dag.fetchedAt)}`;
        switch (verdict.kind) {
          case 'healthy':
            return { state: 'ok', suffix: '— 최근 7일 DAG 실행 기준', meta };
          case 'unhealthy':
            return {
              state: 'err',
              suffix: '— 현재 UNHEALTHY · 최근 7일 DAG 실행 기준',
              meta,
              action: retryAction,
            };
          case 'unknown':
            // Raw enum value stays in the tooltip channel — not in the copy.
            return {
              state: 'warn',
              suffix: '— 판정할 수 없는 값',
              titleHint: `healthStatus: ${verdict.raw}`,
              meta,
              action: retryAction,
            };
        }
      }
    }
  })();

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="관리자 승인">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
              <Icon name="check" size={18} className="text-[var(--pl-primary)]" />
              관리자 승인
              <TcPill tone={head.pill.tone} label={head.pill.label} />
            </h2>
            <p className={opsStyles.cardDesc}>{head.desc}</p>
          </div>
          {(head.canRerun || head.canApprove) && (
            <div className="flex flex-none gap-2">
              {head.canRerun && (
                <PlButton variant="secondary" onClick={() => setRerunOpen(true)}>
                  재실행 요청
                </PlButton>
              )}
              {head.canApprove && (
                <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
                  PII Agent 설치 완료
                </PlButton>
              )}
            </div>
          )}
        </div>

        {/* 왜 CTA 가 없는지는 이 체크리스트가 말한다 — 버튼은 전 조건 충족 시에만
            마운트하는 현행 문법 유지 ("죽은 버튼 금지"). */}
        <div className="mt-5">
          <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">승인 조건</p>
          <div className="mt-2.5 divide-y divide-[var(--pl-border)] rounded-lg border border-[var(--pl-border)]">
            {tcCompleted ? (
              <GateRow
                state="ok"
                text="서비스가 Test Connection 완료를 확인했습니다"
                meta={fmtDateTimeSec(status?.completedAt)}
              />
            ) : (
              <GateRow state="pending" text="서비스가 Test Connection 완료를 확인하면 충족됩니다" />
            )}
            <GateRow
              state={healthRow.state}
              text="모니터링 헬스가 HEALTHY 상태입니다"
              suffix={healthRow.suffix}
              titleHint={healthRow.titleHint}
              meta={healthRow.meta}
              action={healthRow.action}
            />
          </div>
        </div>

        {/* 무엇을 승인하는가 — Test Connection 탭으로 돌아가지 않아도 근거가 읽히도록
            같은 집계를 여기 둔다. */}
        <div className="mt-5">
          <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">승인 대상</p>
          <div className="mt-2.5 grid grid-cols-5 gap-2">
            <TcStatTile label="리소스" count={stats.resourceCount} />
            <TcStatTile label="연결 성공" count={stats.successCount} tone="ok" />
            <TcStatTile label="연결 실패" count={stats.failedCount} tone="err" />
            <TcStatTile label="연동 대상 논리 DB" count={stats.includedTotal} />
            <TcStatTile label="연동 제외 논리 DB" count={stats.excludedTotal} />
          </div>
        </div>

        {(tcCompleted || isRejected) && (
          <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">
                {tcCompleted ? '서비스 완료 확인' : '재실행 요청'}
              </span>
              <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                {fmtDateTimeSec(tcCompleted ? status?.completedAt : status?.rejectedAt)}
              </span>
            </div>
            {isRejected && status?.rejectReason && (
              <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
            )}
          </div>
        )}
      </section>

      {/* 관측층 — 응답이 있어야만 층이 생긴다. L1 요약 밴드 → L2 에이전트 표
          (에이전트가 여럿일 때만 — 층은 데이터가 만들 때만) → L3 요약 라인. 1,500행
          보드 자체는 우측 오버레이 패널의 것(시안 A): 실패 숫자·"DB 보기"·현황 보기
          가 프리셋과 함께 연다. */}
      {tcCompleted && dag.phase === 'loaded' && (
        <>
          <HealthSummaryBand
            data={dag.data}
            fetchedAt={dag.fetchedAt}
            onShowFailed={() => setBoard({ filter: 'failed' })}
          />
          {dag.data.agents.length > 1 && (
            <AgentDagTable
              data={dag.data}
              // "DB 보기"가 약속하는 것은 그 에이전트의 DB 전부다 — 실패 선적용은
              // 실패 숫자 진입의 것.
              onViewDbs={(agentId) => setBoard({ agentId, filter: 'ALL' })}
            />
          )}
          {agg && (
            // 보드의 본문 잔류물 — 문패 한 줄: 버킷 요약 + 진입 버튼. 표는 패널에.
            <section className={pipelineStyles.card.base} aria-label="논리 DB 주간 현황 요약">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className={opsStyles.cardTitle}>논리 DB 주간 현황</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
                    <span>
                      논리 DB <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.dbTotal)}</b>
                    </span>
                    <span className={agg.failed > 0 ? 'text-[var(--pl-err-text)]' : undefined}>
                      실패 <b className="font-semibold">{n(agg.failed)}</b>
                    </span>
                    <span>
                      미스케줄 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.unscheduled)}</b>
                    </span>
                    {agg.running > 0 && (
                      <span>
                        실행 시작 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.running)}</b>
                      </span>
                    )}
                    <span>
                      이번 주 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.succeeded)}</b>
                    </span>
                  </p>
                </div>
                <PlButton
                  variant="secondary"
                  className="flex-none"
                  onClick={() => setBoard({ filter: 'ALL' })}
                >
                  현황 보기
                </PlButton>
              </div>
            </section>
          )}

          {/* 패널 + 그 위의 DAG 상세 = 2단 레이어. ModalShell 의 Esc 는 document 에
              붙으므로, 모달이 떠 있는 동안 패널의 Esc 를 꺼야 한 번에 둘 다 닫히지
              않는다. */}
          <ModalShell
            open={board !== null}
            onClose={closeBoard}
            variant="panel"
            labelledBy="db-board-title"
            closeOnEsc={dagRow === null}
          >
            {board !== null && (
              <DbWeeklyBoard
                data={dag.data}
                initialFilter={board.filter}
                initialAgentId={board.agentId ?? null}
                onClose={closeBoard}
                onOpenDag={setDagRow}
              />
            )}
          </ModalShell>

          <DagDetailModal row={dagRow} timezone={dag.data.timezone} onClose={() => setDagRow(null)} />
        </>
      )}

      <TcRerunModal
        key={rerunOpen ? 'rerun-open' : 'rerun-closed'}
        open={rerunOpen}
        onClose={() => setRerunOpen(false)}
        targetSourceId={targetSourceId}
        onSubmit={(reason) => void rerun.mutate(reason)}
        submitting={rerun.loading}
      />

      <TcApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        targetSourceId={targetSourceId}
        serviceName={detail.service_name ?? '이 서비스'}
        stats={stats}
        onSubmit={() => void approve.execute()}
        submitting={approve.loading}
      />
    </>
  );
}
