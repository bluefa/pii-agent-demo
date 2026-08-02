'use client';

/**
 * 최근 연결 테스트 card — the recent-scan card's grammar applied to Test
 * Connection: verdict pill beside the title, the result the star of the card,
 * time fields pinned to the floor.
 *
 * Hierarchy: 회차 + 결과 (title row) > 리소스별 성패 집계 (tiles) > 실행 시각 (floor).
 * The per-resource detail lives in 확정 정보 below; this card answers "did the
 * latest run pass, and when".
 *
 * Pure view — polling, paging and the run trigger live in TcTab.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { TcExecutionRow } from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TimeField, fmtDuration } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  TcRunPill,
  TcStatTile,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import {
  runDurationSeconds,
  type TcResultStats,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

export interface TcLatestRunCardProps {
  /** Newest run — null when the target was never tested. */
  latestRun: TcExecutionRow | null;
  /** Service-side acknowledgment row — null when the target has no TC status yet. */
  status: TestConnectionStatusRow | null;
  /** Per-resource result counts from the latest results. */
  stats: TcResultStats;
  /** Execution-history page 0 still in flight. */
  loading: boolean;
  /** Execution-history fetch failed. */
  failed: boolean;
  running: boolean;
  triggering: boolean;
  triggerFailed: boolean;
  onRunTest: () => void;
}

export function TcLatestRunCard({
  latestRun,
  status,
  stats,
  loading,
  failed,
  running,
  triggering,
  triggerFailed,
  onRunTest,
}: TcLatestRunCardProps): ReactElement {
  const isCompleted = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;
  const settled = latestRun != null && !running;
  /** Rows the wire actually scored — 0 means every row came back UNKNOWN. */
  const scored = stats.successCount + stats.failedCount;

  return (
    // flex-col — mt-auto pins the time row to the card floor (no dead air when the sibling card is taller).
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="최근 연결 테스트">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="flow" size={18} className="text-[var(--pl-primary)]" />
            최근 연결 테스트
            {/* Identifier (#N) first, verdict pill after — the scan card's order. */}
            {latestRun?.version != null && (
              <span className="text-[12px] font-medium text-[var(--pl-text-weak)]">
                #{latestRun.version}
              </span>
            )}
            {latestRun && <TcRunPill status={latestRun.status} />}
          </h2>
          <p className={opsStyles.cardDesc}>
            확정된 리소스에 실제로 접속해 연동 가능 여부를 검증합니다.
          </p>
        </div>
        {/* outline (brand stroke) — the scan card's 실행 button weight. */}
        <PlButton
          variant="outline"
          className="flex-none"
          disabled={running || triggering}
          onClick={onRunTest}
        >
          {running ? '실행 중…' : triggering ? '시작 중…' : '연결 테스트 실행'}
        </PlButton>
      </div>

      {triggerFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          연결 테스트를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {loading && !latestRun ? (
        // Skeleton drawing the final layout (heading + sentence + tiles) — no jump on load.
        <div className="mt-5" aria-busy>
          <div className={cn(opsStyles.skeleton, 'h-5 w-24')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-2.5 h-5 w-72')} aria-hidden="true" />
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className={cn(opsStyles.skeleton, 'h-[52px]')} aria-hidden="true" />
            ))}
          </div>
        </div>
      ) : !latestRun ? (
        failed ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')}>실행 정보를 불러오지 못했습니다.</p>
        ) : (
          <PlEmptyState icon="flow" message="연결 테스트 실행 기록이 없습니다." className="mt-2" />
        )
      ) : (
        <>
          <div className="mt-5">
            <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">연결 테스트 결과</p>
            {running ? (
              <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>실행이 끝나면 집계돼요.</p>
            ) : stats.resourceCount === 0 ? (
              <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>
                집계된 리소스 결과가 없습니다.
              </p>
            ) : (
              <>
                {/* One sentence, the scan card's shape: only the headline number takes
                    display size. When NO row carried a connection_status, "0개 성공"
                    would read as a failed run — the truth is that the wire never
                    said, so the silence is reported instead of scored. */}
                {scored === 0 ? (
                  <p className="mt-1 text-[14px] text-[var(--pl-text-weak)]">
                    리소스{' '}
                    <b className="text-[20px] font-bold tabular-nums text-[var(--pl-text-strong)]">
                      {stats.resourceCount}
                    </b>
                    개의 개별 연결 상태가 응답에 없어요.
                  </p>
                ) : (
                  <p className="mt-1 text-[14px] text-[var(--pl-text-weak)]">
                    리소스 {stats.resourceCount}개 중{' '}
                    <b
                      className={cn(
                        'text-[20px] font-bold tabular-nums',
                        stats.successCount > 0
                          ? 'text-[var(--pl-primary)]'
                          : 'text-[var(--pl-err-text)]',
                      )}
                    >
                      {stats.successCount}
                    </b>
                    개가 연결에 성공했어요.
                  </p>
                )}
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <TcStatTile label="성공" count={stats.successCount} tone="ok" />
                  <TcStatTile label="실패" count={stats.failedCount} tone="err" />
                  <TcStatTile label="미확인" count={stats.unknownCount} />
                  <TcStatTile label="연동 대상 논리 DB" count={stats.includedTotal} />
                  <TcStatTile label="연동 제외 논리 DB" count={stats.excludedTotal} />
                </div>
              </>
            )}
          </div>

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

          {!isCompleted && !isRejected && (
            <p className={cn(pipelineStyles.text.meta, 'mt-4')}>
              서비스의 Test Connection 완료 확인을 기다리는 중입니다.
            </p>
          )}

          {/* Time row — label-over-value, pinned to the floor by mt-auto. */}
          <div className="mt-auto">
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
              <TimeField label="실행시간">
                {latestRun.requestedAt ? fmtDateTimeSec(latestRun.requestedAt) : '—'}
              </TimeField>
              {settled && (
                <>
                  <TimeField label="완료시간">
                    {latestRun.completedAt ? fmtDateTimeSec(latestRun.completedAt) : '—'}
                  </TimeField>
                  <TimeField label="소요 시간">
                    {fmtDuration(runDurationSeconds(latestRun.requestedAt, latestRun.completedAt))}
                  </TimeField>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
