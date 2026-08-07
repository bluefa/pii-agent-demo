'use client';

/**
 * Recent-scan card — verdict pill beside the title, discovered resources as
 * the main content, time fields pinned to the card floor. Pure view: polling,
 * run-scan and diff derivation live in ScanTab.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  ScanStatusPill,
  TimeField,
  errorLabel,
  fmtCount,
  fmtDuration,
  trimProviderPrefix,
  type ScanJob,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';

/** A resource-type row on the card: current count + diff vs the previous successful scan. */
export interface TypeEntry {
  type: string;
  count: number;
  diff: number | null;
}

const fmtPercent = (progress: number | null | undefined): number => {
  if (progress === null || progress === undefined || !Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

/**
 * Resource stat tile — label (12/500 weak, mono) over number (16/500 strong).
 * Inline tags never lined the numbers up, so scale comparison failed (ops
 * feedback) — the tile grid builds a vertical number column. The diff
 * (+N ok / −N err) sits beside the number at 12px; a type absent from this
 * scan (count 0) stays as a dashed, faint tile instead of vanishing.
 */
function ResourceTypeTile({
  type,
  count,
  provider,
  diff,
}: {
  type: string;
  count: number;
  provider: CloudProvider;
  diff?: number | null;
}): ReactElement {
  const removed = count === 0;
  return (
    <div
      title={type}
      className={cn(
        'min-w-0 rounded-[6px] border bg-[var(--pl-bg-card)] px-3 py-2 shadow-[var(--pl-shadow-sm)]',
        removed ? 'border-dashed border-[var(--pl-border)]' : 'border-[var(--pl-border)]',
      )}
    >
      <p
        className={cn(
          'truncate text-[12px] font-medium [font-family:var(--pl-font-mono)]',
          removed ? 'text-[var(--pl-text-faint)]' : 'text-[var(--pl-text-weak)]',
        )}
      >
        {trimProviderPrefix(type, provider)}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[16px] font-medium tabular-nums',
            removed ? 'text-[var(--pl-text-faint)]' : 'text-[var(--pl-text-strong)]',
          )}
        >
          {fmtCount(count)}
        </span>
        {diff != null && diff !== 0 && (
          <span
            className={cn(
              'text-[12px] font-medium tabular-nums',
              diff > 0 ? 'text-[var(--pl-ok-text)]' : 'text-[var(--pl-err-text)]',
            )}
          >
            {diff > 0 ? `+${fmtCount(diff)}` : fmtCount(diff)}
          </span>
        )}
      </p>
    </div>
  );
}

export interface RecentScanCardProps {
  provider: CloudProvider;
  /** Latest job — null when the target was never scanned. */
  latestJob: ScanJob | null;
  /** Initial latest-job fetch still in flight. */
  loading: boolean;
  /** Latest-job fetch failed. */
  failed: boolean;
  scanning: boolean;
  /** SUCCESS but the count map has not landed — scanned, still aggregating. */
  finalizing: boolean;
  starting: boolean;
  startFailed: boolean;
  /** Per-type counts (+diff vs previous success) for the tile grid. */
  typeEntries: TypeEntry[];
  /** Total delta vs the previous success — null when unknown. */
  countDiff: number | null;
  latestTotal: number;
  onRunScan: () => void;
}

export function RecentScanCard({
  provider,
  latestJob,
  loading,
  failed,
  scanning,
  finalizing,
  starting,
  startFailed,
  typeEntries,
  countDiff,
  latestTotal,
  onRunScan,
}: RecentScanCardProps): ReactElement {
  // Both phases are "the scan is not answerable yet" — one flag drives the
  // progress bar, the results placeholder and the withheld completion times.
  const running = scanning || finalizing;
  return (
    // flex-col — mt-auto pins the time row to the card floor (no dead air when the sibling card is taller).
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="최근 스캔">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="search" size={18} className="text-[var(--pl-primary)]" />
            최근 스캔
            {/* Identifier (#N) first, verdict pill after — same order as the modal title. */}
            {latestJob?.scan_version != null && (
              <span className="text-[12px] font-medium text-[var(--pl-text-weak)]">
                #{latestJob.scan_version}
              </span>
            )}
            {latestJob && <ScanStatusPill status={finalizing ? 'FINALIZING' : latestJob.scan_status} />}
          </h2>
          <p className={opsStyles.cardDesc}>
            클라우드 리소스를 스캔해 연동 가능한 대상 목록을 갱신합니다.
          </p>
        </div>
        {/* No refresh button — useScanPolling polls every 2s while SCANNING, and a
            scan started here lands via refresh(). One started elsewhere shows up on
            tab re-entry (polling runs only during SCANNING — accepted tradeoff).
            variant outline (brand stroke), no icon — the middle ground after ops
            feedback: a primary fill is too loud, gray looks dead. */}
        <PlButton
          variant="outline"
          className="flex-none"
          disabled={running || starting}
          onClick={onRunScan}
        >
          {finalizing ? '마무리 중…' : scanning ? '스캔 중…' : starting ? '시작 중…' : '스캔 실행'}
        </PlButton>
      </div>

      {startFailed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {loading && !latestJob ? (
        // Skeleton drawing the final layout (result header + sentence + tile grid) — no jump on load.
        <div className="mt-5" aria-busy>
          <div className={cn(opsStyles.skeleton, 'h-5 w-24')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-2.5 h-5 w-72')} aria-hidden="true" />
          <div className="mt-2.5 grid h-[196px] grid-cols-3 content-start gap-2 overflow-hidden">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className={cn(opsStyles.skeleton, 'h-[52px]')} aria-hidden="true" />
            ))}
          </div>
        </div>
      ) : !latestJob ? (
        failed ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')}>스캔 정보를 불러오지 못했습니다.</p>
        ) : (
          <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
        )
      ) : (
        <>
          {/* Hierarchy: verdict (pill by the title) > discovered resources (the star)
              > time fields (floor). A finished scan's answer is "what did it find" —
              time metadata retreats to the card bottom. */}
          {/* Progress bar only while running — a finished scan's progress is an
              illusion, not information. Finalizing carries no scan_progress
              (discovery is over), so the bar sits full while the counts land. */}
          {running && (() => {
            const percent = finalizing ? 100 : fmtPercent(latestJob.scan_progress);
            return (
              <div className="mt-4 flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--pl-gray-100)]"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[var(--pl-primary)]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]">
                  {percent}%
                </span>
              </div>
            );
          })()}

          {/* Scan results — success/in-progress only. Failure speaks through the
              error box (cause), not results. Header (16/600), one helper sentence
              (values slightly emphasized), then the tiles carry the content. */}
          {(running || latestJob.scan_status === 'SUCCESS') && (
            <div className="mt-5">
              <p className="text-[16px] font-semibold text-[var(--pl-text-strong)]">스캔 결과</p>
              {running ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>스캔 완료 후 집계돼요.</p>
              ) : typeEntries.length === 0 ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-1.5')}>발견된 리소스가 없습니다.</p>
              ) : (
                <>
                  {/* One sentence — listing 'total N · +N vs previous' as fragments
                      read awkward (ops feedback). Only the total gets brand color at
                      display size; diff numbers stay ok/err. */}
                  <p className="mt-1 text-[14px] text-[var(--pl-text-weak)]">
                    {countDiff !== null && countDiff !== 0 && (
                      <>
                        직전 스캔보다{' '}
                        <b
                          className={cn(
                            'font-bold tabular-nums',
                            countDiff > 0 ? 'text-[var(--pl-ok-text)]' : 'text-[var(--pl-err-text)]',
                          )}
                        >
                          {fmtCount(Math.abs(countDiff))}개
                        </b>
                        {countDiff > 0 ? ' 늘어난' : ' 줄어든'}{' '}
                      </>
                    )}
                    {countDiff === 0 && <>직전 스캔과 같은 </>}
                    총{' '}
                    <b className="text-[20px] font-bold tabular-nums text-[var(--pl-primary)]">
                      {fmtCount(latestTotal)}
                    </b>
                    개를 발견했어요.
                  </p>
                  {/* Fixed viewport (3 rows + a peek of the next) — the type count
                      (varies by provider/version) must not drive card height;
                      overflow scrolls inside the grid. */}
                  <div className="mt-2.5 grid h-[196px] grid-cols-3 content-start gap-2 overflow-y-auto">
                    {typeEntries.map(({ type, count, diff }) => (
                      <ResourceTypeTile key={type} type={type} count={count} provider={provider} diff={diff} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {latestJob.scan_error && (
            <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
              <span className="[font-family:var(--pl-font-mono)] font-semibold">{latestJob.scan_error}</span>
              <span className="ml-2">{errorLabel(latestJob.scan_error)}</span>
            </p>
          )}

          {/* Time row — label-over-value fields, mt-auto pins it to the card floor
              (the inner mt-4 keeps the minimum gap). */}
          <div className="mt-auto">
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
              <TimeField label="실행시간">{fmtDateTimeSec(latestJob.created_at)}</TimeField>
              {!running && (
                <>
                  {/* Same format as start time — the date is never omitted, even on the same day. */}
                  <TimeField label="완료시간">{fmtDateTimeSec(latestJob.updated_at)}</TimeField>
                  <TimeField label="소요 시간">{fmtDuration(latestJob.duration_seconds)}</TimeField>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
