'use client';

/**
 * 관리자 승인 tab — the process branch this target's Step 6 exists for.
 *
 * 구조는 시안 C(근거 리포트 행, GitLab MR 위젯 문법 — docs/ux/benchmark/
 * approval-tab-report-rows.md): 카드 한 장 안에 결정(헤드+CTA) ▸ 승인 조건 ▸ 근거
 * 두 행이 선다. 근거 행은 기본 접힘이고 펼치면 그 자리에서 표가 열린다 — 펼침은
 * 세션에 저장하지 않아 매번 접힌 채 시작한다(접힌 줄이 판정을 이미 나른다).
 *
 * Flow: 서비스가 5단계(연결 테스트)에서 완료 승인 요청(PUT
 * …/test-connection-acknowledgment)을 보내면 Step 5 → 6 으로 넘어오고, 관리자는
 * 결과를 보고 둘 중 하나를 고른다 —
 *   재실행 요청        POST …/test-connection/reject          (서비스 단계로 되돌림)
 *   PII Agent 설치 완료 POST …/pii-agent-installation/confirm  (연동 확정)
 *
 * TWO conditions gate the approve CTA (the 승인 조건 checklist states both):
 *   ① 서비스 완료 승인 요청 (status = TEST_CONNECTION_COMPLETED)
 *   ② 모니터링 헬스 HEALTHY (assumed §10 dag-status, allowlist — approvalGate.ts)
 *
 * 아이콘 문법 (C-1): 판정 아이콘(✓·✗·○)은 승인 조건 행만 갖는다. 근거 행의 알약은
 * 사실만 나른다 — TC 실패는 게이트가 아니므로 근거 행의 ✗ 는 "승인 불가"라는
 * 거짓말이 된다. "완료·승인"은 사람의 행위(인수인계)에만, "성공·실패"는 테스트
 * 결과에만 쓴다.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { normalizeCloudProvider } from '@/lib/types';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import { rejectTestConnection, confirmInstallation, type TcResultRow } from '@/app/lib/api/task-queue-tc';
import {
  getConfirmedIntegration,
  type ConfirmedIntegrationResourceItem,
  type TestConnectionVersionResult,
} from '@/app/lib/api';
import { getApprovalRequestLatest } from '@/app/lib/api/task-queue-requests';
import { getDagStatus } from '@/app/lib/api/ops';
import {
  indexConfirmedResources,
  type ConfirmedIndex,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';
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
import {
  orderByRequest,
  runStatus,
  tcResultStats,
  verdictByResource,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';
import {
  TC_COMPLETED,
  TC_REJECTED,
  aggregateDagStatus,
  foldApprovalHead,
  healthVerdict,
  monitoringEvidenceHead,
  showsHandoffCaption,
  tcEvidencePill,
  type DagFetch,
  type EvidencePill,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { MonitoringEvidenceBody } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/MonitoringEvidenceBody';
import { TcReviewTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/TcReviewTable';
import { AgentDagTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AgentDagTable';
import { DbWeeklyBoard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';
import { DagDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DagDetailModal';
import type {
  BoardFilter,
  DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const n = (value: number): string => value.toLocaleString('ko-KR');

type GateRowState = 'ok' | 'err' | 'warn' | 'pending';

/**
 * One 승인 조건 row — 판정문 한 줄, 그 아래 근거 한 줄, 오른쪽에 보조 CTA.
 *
 * 근거와 조회 시각이 판정문과 한 줄에 있으면 셋이 이어진 한 문장으로 읽힌다. 크기만
 * 줄여서는 갈라지지 않아서 — 줄을 나누고 크기·굵기·색 세 채널을 함께 내린다. 아래 줄에는
 * 성격이 같은 것끼리(무엇을 보고 판정했나 · 언제 봤나) 모인다.
 */
function GateRow({
  state,
  text,
  suffix,
  titleHint,
  meta,
}: {
  state: GateRowState;
  text: string;
  suffix?: ReactNode;
  /** Debug-tier raw value (wire vocabulary) — tooltip only, never in the copy. */
  titleHint?: string;
  meta?: string;
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
    <div className="flex items-start gap-2.5 px-4 py-3">
      {/* 아이콘은 판정문 줄에 붙는다 — 두 줄 블록의 가운데로 내려오면 어느 줄을
          판정하는 것인지 흐려진다. */}
      <span className="mt-0.5 flex-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--pl-text-strong)]" title={titleHint}>
          {text}
        </p>
        {(suffix || meta) && (
          <p className="mt-1 text-[12px] text-[var(--pl-text-weak)]">
            {suffix}
            {suffix && meta && ' · '}
            {meta && <span className="tabular-nums">{meta}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 근거 리포트 행 — 접힌 줄(제목·보조·알약·셰브런)이 판정을 나르고, 펼치면 그 자리에
 * 본문이 열린다. 닫힌 본문은 언마운트라 aria-controls 는 달지 않는다(참조가 절반의
 * 시간 동안 허공에 뜬다 — APG disclosure: aria-expanded 만으로 적합).
 */
function ReportRow({
  title,
  subtitle,
  subtitleHint,
  pill,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string | null;
  /** Debug-tier raw value — tooltip only. */
  subtitleHint?: string;
  pill: EvidencePill;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}): ReactElement {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--pl-gray-50)]"
      >
        {/* button 은 phrasing content 만 담는다 — p 대신 block span. */}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-[var(--pl-text-strong)]">{title}</span>
          {subtitle && (
            <span
              className="mt-1 block text-[12px] text-[var(--pl-text-weak)]"
              title={subtitleHint}
            >
              {subtitle}
            </span>
          )}
        </span>
        <span className="flex-none">
          <TcPill tone={pill.tone} label={pill.label} />
        </span>
        <Icon
          name="chev-r"
          size={16}
          className={cn(
            'flex-none text-[var(--pl-text-weak)] transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && children != null && (
        // 펼침 본문의 상하 여백은 비대칭(28/42) — 아래가 커야 본문 끝과 다음 행이
        // 붙어 읽히지 않는다. 공지 아코디언(postStyles.panelBody, 16/64)과 같은
        // 방향의 완화판이다 (오너 08-21, 20/32에서 한 번 더 +8/+10).
        <div className="border-t border-[var(--pl-border)] px-4 pb-[42px] pt-7">{children}</div>
      )}
    </div>
  );
}

/**
 * 확정 스냅샷 한 번으로 두 소비자를 먹인다 — DAG 표의 조인 index 와 검토 표의 rows.
 * phase 를 남기는 이유(리뷰 08-21): 실패를 빈 배열로 접으면 검토 표가 "확정 정보가
 * 없다"는 사실을 단정하게 된다 — 실패는 빈 결과가 아니다. DAG 표의 조인 칸은
 * 실패해도 대시로 서는 것이 설계지만, "없음"을 문장으로 말하는 쪽은 가른다.
 */
type ConfirmedFetch =
  | { phase: 'loading' }
  | { phase: 'failed' }
  | { phase: 'loaded'; index: ConfirmedIndex; rows: ConfirmedIntegrationResourceItem[] };

export interface ApprovalTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Service acknowledgment row — gate ① (fetched by the page). */
  status: TestConnectionStatusRow | null;
  /** 최신 실행 — 회차·상태·시각 + 리소스별 판정 (fetched by the page; 404 → null). */
  latest: TestConnectionVersionResult | null;
  /** latest fetch 실패 (404 는 실패가 아니다) — null 이 '이력 없음'인지 '모름'인지 가른다. */
  latestFailed: boolean;
  /** 리소스별 논리 DB 건수 (latest-results; fetched by the page). */
  results: readonly TcResultRow[];
  /** Both outcomes change the target's step, so the whole page reloads. */
  onDecided: () => void;
  /** "연결 테스트 탭에서 관리" — 쓰기(제외 정책·Credential·재실행)는 그 탭의 것. */
  onOpenTcTab: () => void;
}

export function ApprovalTab({
  targetSourceId,
  detail,
  status,
  latest,
  latestFailed,
  results,
  onDecided,
  onOpenTcTab,
}: ApprovalTabProps): ReactElement {
  const toast = usePlToast();
  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  // 근거 행 펼침 — 세션에 저장하지 않고 매번 접힌 채 시작한다. 두 행은 독립이다:
  // 둘 다 펼치면 같은 정체성 열로 리소스를 행 단위 대조할 수 있어야 한다.
  const [tcOpen, setTcOpen] = useState(false);
  const [monOpen, setMonOpen] = useState(false);

  const tcCompleted = status?.status === TC_COMPLETED;
  const isRejected = status?.status === TC_REJECTED;

  // 근거 행이 나르는 판정 — 페이지가 내려준 두 응답을 여기서 접는다 (연결 테스트
  // 탭과 같은 fold 라 합계가 두 탭에서 갈라지지 않는다).
  const stats = useMemo(() => tcResultStats(results, latest), [results, latest]);
  const verdicts = useMemo(() => verdictByResource(latest), [latest]);
  const run = runStatus(latest);

  // Gate ② — dag-status is fetched only once TC 완료 승인 (fetch gate, §10);
  // before that there is nothing to check, and every consumer below gates on
  // tcCompleted before reading `dag`. Abort-on-deps-change is the stale-response
  // guard (PagedCard pattern). 다시 확인(수동 재조회) 버튼은 오너가 뺐다 (08-21) —
  // 최신 값이 필요하면 화면을 새로 연다.
  const [dag, setDag] = useState<DagFetch>({ phase: 'loading' });
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
    [tcCompleted, targetSourceId],
  );

  // 확정 정보 조인 — DAG 표가 §10 밖에서 빌려 오는 사실(리전·DatabaseType·IDC 접속
  // 주소)의 출처이자, 검토 표(C-2)의 행 목록. TC 완료 승인 전에도 받는다: 검토 표는
  // 게이트 ① 이전(혼동 상태)에도 서야 한다. 게이트에는 아무 영향이 없다 — 실패하면
  // 조인 칸은 대시로, 검토 표는 빈 상태 문장으로 서고 화면은 그대로 뜬다.
  // 요청 순서 조인은 연결 테스트 탭과 같은 이유(두 표를 행 단위로 대조)·같은 best-effort.
  const [confirmed, setConfirmed] = useState<ConfirmedFetch>({ phase: 'loading' });
  useAbortableEffect(
    (signal) => {
      setConfirmed({ phase: 'loading' });
      return Promise.allSettled([
        getConfirmedIntegration(targetSourceId, { signal }),
        getApprovalRequestLatest(targetSourceId, { signal }),
      ]).then(([snapshot, request]) => {
        if (signal.aborted) return;
        if (snapshot.status !== 'fulfilled') {
          // 404 = 확정 전 대상(원래 없음) — 실패가 아니라 빈 스냅샷이다 (TcTab 과
          // 같은 판별). 그 밖의 거절만 '모름'으로 남긴다.
          setConfirmed(
            isMissingConfirmedIntegrationError(snapshot.reason)
              ? { phase: 'loaded', index: indexConfirmedResources([]), rows: [] }
              : { phase: 'failed' },
          );
          return;
        }
        const infos = snapshot.value.resource_infos ?? [];
        const order =
          request.status === 'fulfilled'
            ? request.value.resources.map((resource) => resource.resourceId ?? '').filter(Boolean)
            : [];
        setConfirmed({
          phase: 'loaded',
          index: indexConfirmedResources(infos),
          rows: orderByRequest(infos, order),
        });
      });
    },
    [targetSourceId],
  );

  const isIdc = normalizeCloudProvider(detail.cloud_provider) === 'IDC';

  // 논리 DB 보드 — 우측 오버레이 패널(벤치마크 시안 A). 진입(펼친 모니터링 본문의
  // 실패 숫자 · 전체 현황 · 에이전트 표의 "DAG 상태 조회")이 프리셋과 함께 연다. ModalShell
  // 은 닫히면 자식을 언마운트하므로 매 오픈이 새 마운트 — 프리셋은 마운트 1회 소비로
  // 충분하다.
  const [board, setBoard] = useState<{ filter: BoardFilter; agentId?: string } | null>(null);
  // DAG 상세는 보드가 아니라 여기서 연다 — 패널 위에 겹치는 레이어라 Esc 를 누가
  // 먹을지 결정할 수 있어야 한다. 패널이 닫히면 그 위의 모달도 함께 접는다.
  const [dagRow, setDagRow] = useState<DagDbRow | null>(null);
  const closeBoard = (): void => {
    setDagRow(null);
    setBoard(null);
  };

  // 모니터링 근거의 집계 — 접힌 줄(head)과 펼친 본문이 같은 파생을 응답당 1회로 나눈다.
  const agg = useMemo(
    () => (dag.phase === 'loaded' ? aggregateDagStatus(dag.data) : null),
    [dag],
  );
  const monHead = monitoringEvidenceHead(dag, agg);

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

  // 승인 조건 row ② — the checklist carries the "why", the CTA stays unmounted.
  const healthRow = ((): {
    state: GateRowState;
    suffix: string;
    titleHint?: string;
    meta?: string;
  } => {
    if (!tcCompleted) return { state: 'pending', suffix: '완료 승인 후 점검합니다' };
    switch (dag.phase) {
      case 'loading':
        return { state: 'pending', suffix: '확인 중…' };
      case 'failed':
        return { state: 'err', suffix: '확인하지 못했습니다' };
      case 'loaded': {
        const verdict = healthVerdict(dag.data.healthStatus);
        const meta = `조회 ${fmtDateTimeSec(dag.fetchedAt)}`;
        switch (verdict.kind) {
          case 'healthy':
            return { state: 'ok', suffix: '최근 7일 DAG 실행 기준', meta };
          case 'unhealthy':
            return {
              state: 'err',
              suffix: '현재 UNHEALTHY · 최근 7일 DAG 실행 기준',
              meta,
            };
          case 'unknown':
            // Raw enum value stays in the tooltip channel — not in the copy.
            return {
              state: 'warn',
              suffix: '판정할 수 없는 값',
              titleHint: `healthStatus: ${verdict.raw}`,
              meta,
            };
        }
      }
    }
  })();

  // 연결 테스트 근거의 접힌 줄 — 회차·시각과, 성공분이 있을 때만 논리 DB 합계.
  // 합계는 검토 표의 셀과 같은 fold(ldbCount 게이트)라 두 층이 갈라지지 않는다.
  const tcSubtitle = ((): string | null => {
    if (!latest) return null;
    const parts: string[] = [];
    const round = latest.test_connection_version != null ? `${latest.test_connection_version}회차` : '';
    const at = latest.completed_at ?? latest.requested_at;
    const identity = [round, at ? fmtDateTimeSec(at) : ''].filter(Boolean).join(' ');
    if (identity) parts.push(identity);
    if (stats.successCount > 0) {
      parts.push(`연동 대상 논리 DB ${n(stats.includedTotal)}`);
      parts.push(`제외 ${n(stats.excludedTotal)}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
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
                // 경고성 outline (오너 08-21) — 이 버튼은 되돌림이다: 누르면(모달 확인
                // 후) 서비스 단계가 뒤로 간다. 회색 secondary 로 서 있으면 "조용한
                // 보조 동작"처럼 읽힌다.
                <PlButton variant="danger" onClick={() => setRerunOpen(true)}>
                  연결 테스트 재실행 요청
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
                text="서비스가 연결 테스트 완료 승인을 요청했습니다"
                meta={fmtDateTimeSec(status?.completedAt)}
              />
            ) : (
              <GateRow
                state="pending"
                text="서비스가 연결 테스트 완료 승인을 요청하면 충족됩니다"
                // C-1 조건부 캡션 — "테스트 성공 + 미요청" 상태에서만. 강조는 굵기와
                // 색으로 지고, 문장은 짧게 둘로 나눈다 (오너 08-20).
                suffix={
                  showsHandoffCaption(status?.status, run) ? (
                    <>
                      연결 테스트가 성공해도 이 조건은 자동으로 충족되지 않습니다. 서비스
                      담당자가{' '}
                      <b className="font-semibold text-[var(--pl-text-strong)]">
                        5단계 연결 테스트에서 완료 승인 요청
                      </b>
                      을 눌러야 합니다.
                    </>
                  ) : undefined
                }
              />
            )}
            <GateRow
              state={healthRow.state}
              text="모니터링 헬스가 HEALTHY 상태입니다"
              suffix={healthRow.suffix}
              titleHint={healthRow.titleHint}
              meta={healthRow.meta}
            />
          </div>
        </div>

        {/* 근거 — 결정의 재료 두 행, 말한 우선순위 그대로 같은 컨테이너의 형제.
            무엇을 승인하는가(연결 테스트)와 지금 살아 있는가(모니터링)를 여기서
            대조한다 — Test Connection 탭으로 돌아가지 않아도 되도록. */}
        {(latest !== null || latestFailed || tcCompleted) && (
          <div className="mt-5">
            <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">근거</p>
            <div className="mt-2.5 divide-y divide-[var(--pl-border)] rounded-lg border border-[var(--pl-border)]">
              {/* fetch 실패는 '이력 없음'과 다르다 (리뷰 08-21) — 행을 접는 대신 실패를
                  말한다. 접으면 근거 하나가 사라진 채로 승인 CTA 가 서 있게 된다. */}
              {latest === null && latestFailed && (
                <div className="px-4 py-3">
                  <p className="text-[14px] font-medium text-[var(--pl-text-strong)]">
                    연결 테스트 결과
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--pl-err-text)]">
                    실행 정보를 불러오지 못했습니다.
                  </p>
                </div>
              )}
              {latest !== null && (
                <ReportRow
                  title="연결 테스트 결과"
                  subtitle={tcSubtitle}
                  pill={tcEvidencePill(stats, run)}
                  open={tcOpen}
                  onToggle={() => setTcOpen((value) => !value)}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
                    <span>
                      리소스 <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.resourceCount)}</b>
                    </span>
                    <span>
                      연결 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.successCount)}</b>
                    </span>
                    <span className={stats.failedCount > 0 ? 'text-[var(--pl-err-text)]' : undefined}>
                      연결 실패 <b className="font-semibold">{n(stats.failedCount)}</b>
                    </span>
                    {stats.runningCount > 0 && (
                      <span>
                        진행 중 <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.runningCount)}</b>
                      </span>
                    )}
                    {stats.unknownCount > 0 && (
                      <span>
                        알 수 없음 <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.unknownCount)}</b>
                      </span>
                    )}
                    <span>
                      연동 대상 논리 DB <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.includedTotal)}</b>
                    </span>
                    <span>
                      연동 제외 <b className="font-semibold text-[var(--pl-text-strong)]">{n(stats.excludedTotal)}</b>
                    </span>
                    {/* 읽기는 여기서, 쓰기는 저 탭에서 — 경계가 문장이 아니라 동선에 있다. */}
                    <button
                      type="button"
                      onClick={onOpenTcTab}
                      className="ml-auto cursor-pointer whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] hover:underline"
                    >
                      연결 테스트 탭에서 관리
                    </button>
                  </div>
                  <div className="mt-2.5">
                    <TcReviewTable
                      targetSourceId={targetSourceId}
                      isIdc={isIdc}
                      snapshotPhase={confirmed.phase}
                      rows={confirmed.phase === 'loaded' ? confirmed.rows : []}
                      tcResults={results}
                      verdicts={verdicts}
                    />
                  </div>
                  <p className="mt-2.5 text-[12px] text-[var(--pl-text-weak)]">
                    개수를 클릭하면 읽기 전용 논리 DB 목록이 열립니다. 제외 정책·Credential
                    배정·재실행은 연결 테스트 탭에서 관리합니다.
                  </p>
                </ReportRow>
              )}
              {tcCompleted && (
                <ReportRow
                  title="모니터링 결과"
                  subtitle={monHead.subtitle}
                  subtitleHint={monHead.titleHint}
                  pill={monHead.pill}
                  open={monOpen}
                  onToggle={() => setMonOpen((value) => !value)}
                >
                  {dag.phase === 'loaded' && agg ? (
                    <>
                      <MonitoringEvidenceBody
                        data={dag.data}
                        agg={agg}
                        fetchedAt={dag.fetchedAt}
                        onShowFailed={() => setBoard({ filter: 'failed' })}
                        onOpenBoard={() => setBoard({ filter: 'ALL' })}
                      />
                      {/* 에이전트가 1개뿐이어도 그린다 — 요약은 리소스가 무엇인지 말하지
                          않는다 (2026-08-20 정정, AgentDagTable 주석). */}
                      {dag.data.agents.length > 0 && (
                        <div className="mt-4">
                          <AgentDagTable
                            data={dag.data}
                            // "DAG 상태 조회"가 약속하는 것은 그 에이전트의 DB 전부다 —
                            // 실패 선적용은 실패 숫자 진입의 것.
                            onViewDbs={(agentId) => setBoard({ agentId, filter: 'ALL' })}
                            confirmed={confirmed.phase === 'loaded' ? confirmed.index : null}
                            isIdc={isIdc}
                          />
                        </div>
                      )}
                    </>
                  ) : dag.phase === 'failed' ? (
                    <p className="text-[14px] text-[var(--pl-text-weak)]">
                      모니터링 상태를 불러오지 못했습니다.
                    </p>
                  ) : (
                    <p className="text-[14px] text-[var(--pl-text-weak)]" aria-busy>
                      모니터링 상태를 확인하고 있어요…
                    </p>
                  )}
                </ReportRow>
              )}
            </div>
          </div>
        )}

        {isRejected && (
          <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">
                재실행 요청
              </span>
              <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                {fmtDateTimeSec(status?.rejectedAt)}
              </span>
            </div>
            {status?.rejectReason && (
              <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
            )}
          </div>
        )}
      </section>

      {/* 패널 + 그 위의 DAG 상세 = 2단 레이어. ModalShell 의 Esc 는 document 에
          붙으므로, 모달이 떠 있는 동안 패널의 Esc 를 꺼야 한 번에 둘 다 닫히지
          않는다. */}
      {tcCompleted && dag.phase === 'loaded' && (
        <>
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
