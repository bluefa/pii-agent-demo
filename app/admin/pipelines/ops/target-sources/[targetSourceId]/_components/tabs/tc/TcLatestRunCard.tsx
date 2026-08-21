'use client';

/**
 * 최근 연결 테스트 — 종합 상태 밴드 (집계는 밴드로, 사실은 표로).
 *
 * 예전의 이 카드는 집계 문장과 Agent별 결과 목록(필터·페이저)을 함께 실었다 —
 * 확정 정보 표와 같은 리소스 명단을 두 번 그리고 agent_id 같은 내부 식별자까지
 * 노출하는 구조라, 리소스별 사실(연결 상태·실패 사유·Pod 로그)은 전부 확정 정보
 * 표의 열로 내리고 여기는 실행 한 건의 집계만 남긴다:
 *   제목행(pill) · 요약 한 줄(성패 건수 / 진행 n/m) · TargetSource 사유 줄.
 *
 * 회차 번호(#N)는 제목에서 뺐다(오너 2026-08-20) — 제목이 답할 질문은 "지금 붙는가"이지
 * "몇 번째 회차인가"가 아니고, 회차는 그것을 세는 표(실행 기록)에서 읽는다.
 *
 * 지난 회차·결정은 시각 옆 링크 두 개로 연다(실행 기록 · 승인·반려 이력) — 사용자 화면
 * Step 5 의 문법 그대로다(TcSummaryCard 의 `historyAction`): 지금 상태 옆에 "지난 것"의
 * 입구가 서고, 과거를 위한 카드를 지면 맨 아래에 따로 세우지 않는다.
 *
 * 사유 줄은 신규 TargetSource 단위 `fail_reason`(DRAFT CONTRACT) — FAIL 로 닫힌
 * 실행에서 값이 있을 때만 그려진다. 전면 실패(리소스별 결과 0건)에서는 표가 전행
 * 무보고(—)가 되므로 이 줄이 화면의 유일한 설명이다.
 *
 * Source is `GET …/test-connection/latest_version` (TestConnectionVersionResult).
 * 404 는 오류가 아니라 "최신 연결 테스트 없음" 이라 `latest === null` 로 들어온다.
 * Pure view — polling, paging and the run trigger live in TcTab.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PipelineProgressBar } from '@/app/admin/pipelines/_components/PipelineProgressBar';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { fmtDuration } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TcRunPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import { failReasonView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/failReason';
import {
  runDurationSeconds,
  runFailReason,
  runProgress,
  runStatus,
  type TcResultStats,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/**
 * 시각 아래 이력 링크 — countLink 규칙을 meta 크기로: 밑줄이 affordance 를 지고 색은
 * 중립이다. 이 줄에서 색을 쓸 수 있는 것은 판정(pill)과 실행 CTA 뿐이다.
 */
const META_LINK =
  'cursor-pointer border-b border-current pb-px text-[12px] font-medium text-[var(--pl-text-weak)] transition-colors hover:text-[var(--pl-text-strong)]';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

export interface TcLatestRunCardProps {
  /** 최신 실행 — 404(연결 테스트 이력 없음)면 null. */
  latest: TestConnectionVersionResult | null;
  /** Service-side acknowledgment row — null when the target has no TC status yet. */
  status: TestConnectionStatusRow | null;
  /** Per-resource verdict counts (리소스 단위 접기 결과). */
  stats: TcResultStats;
  /** 결과 단위 수 — 실행 중 진행률의 분모. Athena 는 리전 하나가 한 단위다 (아직 모르면 0). */
  confirmedResourceCount: number;
  /** latest_version fetch still in flight. */
  loading: boolean;
  /** latest_version fetch failed (404 는 실패가 아니다). */
  failed: boolean;
  running: boolean;
  triggering: boolean;
  triggerFailed: boolean;
  onRunTest: () => void;
  /** 실행 기록 modal — 회차 목록. */
  onOpenRunHistory: () => void;
  /** 승인·반려 이력 modal — 서비스 측 완료 확인·재실행 요청 trail. */
  onOpenDecisionHistory: () => void;
}

/**
 * TargetSource 사유 줄 — "사유 · 라벨 · 원문 enum" 한 줄. 목록 밖의 값은 라벨 없이
 * 원문만 중립으로(허용 목록 규칙). 판정의 적색은 pill 이 이미 말했으므로 끝까지 중립.
 */
function RunReasonLine({ raw }: { raw: string }): ReactElement | null {
  const view = failReasonView(raw);
  if (!view) return null;
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[12px] font-semibold text-[var(--pl-text-weak)]">사유</span>
      {view.label ? (
        <>
          <span className="text-[14px] font-medium text-[var(--pl-text-medium)]" title={view.desc ?? undefined}>
            {view.label}
          </span>
          <span className={cn(pipelineStyles.text.mono, 'text-[12px] text-[var(--pl-text-weak)]')}>
            {view.raw}
          </span>
        </>
      ) : (
        <span className={cn(pipelineStyles.text.mono, 'text-[14px] text-[var(--pl-text-medium)]')}>
          {view.raw}
        </span>
      )}
    </div>
  );
}

export function TcLatestRunCard({
  latest,
  status,
  stats,
  confirmedResourceCount,
  loading,
  failed,
  running,
  triggering,
  triggerFailed,
  onRunTest,
  onOpenRunHistory,
  onOpenDecisionHistory,
}: TcLatestRunCardProps): ReactElement {
  const isCompleted = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;
  const state = runStatus(latest);
  const settled = latest != null && !running;
  const progress = runProgress(latest, confirmedResourceCount);
  const reason = runFailReason(latest);
  const duration = settled
    ? runDurationSeconds(latest?.requested_at ?? null, latest?.completed_at ?? null)
    : null;

  // 우측 시각 — 정착한 실행은 완료·소요, 열린 실행은 시작(요청) 시각 하나.
  const timeText = !latest
    ? ''
    : settled
      ? [
          latest.completed_at ? `완료 ${fmtDateTimeSec(latest.completed_at)}` : null,
          duration != null ? fmtDuration(duration) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : latest.requested_at
        ? `${state === 'PENDING' ? '요청' : '시작'} ${fmtDateTimeSec(latest.requested_at)}`
        : '';

  return (
    <section className={pipelineStyles.card.base} aria-label="최근 연결 테스트">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="flow" size={18} className="text-[var(--pl-primary)]" />
            최근 연결 테스트
            {latest && <TcRunPill status={state} />}
          </h2>
          <p className={opsStyles.cardDesc}>
            확정된 리소스에 실제로 접속해 연동 가능 여부를 검증합니다. 리소스별 결과는 아래
            확정 정보 표의 연결 상태·Pod 로그 열에서 확인합니다.
          </p>
        </div>
        <div className="flex flex-none items-center gap-4">
          <div className="flex flex-col items-end gap-1.5">
            {timeText && (
              <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                {timeText}
              </span>
            )}
            {/* 실행이 한 번도 없으면 열어 볼 회차도 결정도 없다 — 빈 모달로 가는 입구는
                세우지 않는다(Step 5 의 `run ? historyAction : null` 과 같은 게이트). */}
            {latest && (
              <span className="flex items-center gap-3">
                <button type="button" onClick={onOpenRunHistory} className={META_LINK}>
                  실행 기록
                </button>
                <button type="button" onClick={onOpenDecisionHistory} className={META_LINK}>
                  승인·반려 이력
                </button>
              </span>
            )}
          </div>
          {/* primary — with 관리자 처리 moved to the rail, running the test is the
              loudest thing this tab still does. */}
          <PlButton variant="primary" disabled={running || triggering} onClick={onRunTest}>
            {running ? '실행 중…' : triggering ? '시작 중…' : '연결 테스트 실행'}
          </PlButton>
        </div>
      </div>

      {triggerFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          연결 테스트를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {loading && !latest ? (
        // Skeleton drawing the final layout (제목행 + 요약 한 줄) — no jump on load.
        <div className="mt-4" aria-busy>
          <div className={cn(opsStyles.skeleton, 'h-5 w-72')} aria-hidden="true" />
        </div>
      ) : !latest ? (
        failed ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')}>실행 정보를 불러오지 못했습니다.</p>
        ) : (
          // 404 = 아직 한 번도 실행하지 않은 대상. 오류가 아니라 빈 상태로 말한다.
          <PlEmptyState icon="flow" message="아직 실행한 연결 테스트가 없습니다." className="mt-2" />
        )
      ) : (
        <>
          {/* 요약 한 줄 — 실행 중엔 진행(n/m), 정착하면 성패 건수. 무보고 실행은 건수로
              세지 않는다: "0건 성공"은 거짓이고, 사실은 "리소스별 결과가 없다"이다. */}
          {running ? (
            progress.done === 0 && progress.total === 0 ? (
              <p className={cn(pipelineStyles.text.meta, 'mt-4')}>
                {state === 'PENDING'
                  ? '실행 시작을 기다리고 있어요.'
                  : '실행이 시작됐어요. 결과가 들어오는 대로 표시됩니다.'}
              </p>
            ) : (
              <div className="mt-4 flex items-center gap-2">
                <PipelineProgressBar n={progress.done} m={progress.total} wide />
                <span className={pipelineStyles.text.meta}>완료</span>
              </div>
            )
          ) : stats.resourceCount === 0 ? (
            <p className={cn(pipelineStyles.text.meta, 'mt-4')}>리소스별 결과 없음</p>
          ) : (
            <p className="mt-4 text-[14px] text-[var(--pl-text-weak)]">
              리소스{' '}
              <b className="font-semibold tabular-nums text-[var(--pl-text-strong)]">
                {stats.resourceCount}
              </b>
              건 중{' '}
              {stats.failedCount === 0 && stats.unknownCount === 0 && stats.runningCount === 0 ? (
                <b className="font-semibold tabular-nums text-[var(--pl-ok-text)]">모두 성공</b>
              ) : (
                <>
                  <b className="font-semibold tabular-nums text-[var(--pl-ok-text)]">
                    {stats.successCount}
                  </b>
                  건 성공 ·{' '}
                  <b className="font-semibold tabular-nums text-[var(--pl-err-text)]">
                    {stats.failedCount}
                  </b>
                  건 실패
                  {stats.unknownCount > 0 && ` · 미확인 ${stats.unknownCount}건`}
                </>
              )}
            </p>
          )}

          {/* TargetSource 사유 줄 — FAIL(또는 enum 밖 값)로 닫힌 실행에서 값이 있을 때만.
              null 이면 줄 자체가 없다 (사유는 실패의 속성이다). */}
          {(state === 'FAIL' || state === 'UNKNOWN') && reason && <RunReasonLine raw={reason} />}

          {/* 서비스 측 완료 확인 / 재실행 요청 — the run's own verdict is the pill above;
              this is what the SERVICE did with it, so it stays a separate line. */}
          {(isCompleted || isRejected) && (
            <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <TcPill tone="ok" label="완료 확인됨" />
                ) : (
                  <TcPill tone="warn" label="재실행 요청됨" />
                )}
                <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                  {fmtDateTimeSec(isCompleted ? status?.completedAt : status?.rejectedAt)}
                </span>
              </div>
              {isRejected && status?.rejectReason && (
                <p className={cn(pipelineStyles.text.body, 'mt-2')}>{status.rejectReason}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
