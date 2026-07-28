'use client';

/**
 * 스캔 tab (mockup design/pipeline/ops-target-source-tabs.html `tabScan`) —
 * 최근 스캔 card (status/progress/discovered resources) + paged 스캔 이력 table.
 * Latest job comes from useScanPolling, so a running scan animates and a 404
 * (never scanned) surfaces as the empty state rather than an error.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getScanHistory, startScan } from '@/app/lib/api/scan';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

const PAGE_SIZE = 5;

type Tone = 'ok' | 'info' | 'err' | 'off';

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  ok: { pill: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]' },
  info: { pill: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]', dot: 'bg-[var(--pl-info)]' },
  err: { pill: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]' },
  off: { pill: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', dot: 'bg-[var(--pl-gray-300)]' },
};

/** ScanStatus (app/api/_lib/v1-types.ts) → tone + Korean label. */
const SCAN_STATUS: Record<string, { tone: Tone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  SCANNING: { tone: 'info', label: '스캔 중' },
  FAIL: { tone: 'err', label: '실패' },
  TIMEOUT: { tone: 'err', label: '타임아웃' },
  CANCELED: { tone: 'off', label: '취소' },
};

const SCAN_ERROR_LABEL: Record<string, string> = {
  AUTH_PERMISSION_ERROR: '권한 오류입니다. Scan Role 권한을 확인해 주세요.',
  RATE_LIMIT: '요청 한도 초과',
  NETWORK_ERROR: '네트워크 오류',
  SERVICE_ERROR: '클라우드 서비스 오류',
  UNKNOWN: '알 수 없는 오류',
};

const errorLabel = (code: string): string => SCAN_ERROR_LABEL[code] ?? SCAN_ERROR_LABEL.UNKNOWN;

const META_LABEL = 'text-[13px] text-[var(--pl-text-weak)] whitespace-nowrap';
const META_VALUE = 'font-semibold text-[var(--pl-text-strong)]';

/** 214.6s → '3분 34초', 44s → '44초'; unknown → '—'. */
const fmtDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}분 ${String(rest).padStart(2, '0')}초` : `${rest}초`;
};

const fmtPercent = (progress: number | null | undefined): number => {
  if (progress === null || progress === undefined || !Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

function ScanStatusPill({ status }: { status: string | null | undefined }): ReactElement {
  const spec = (status && SCAN_STATUS[status]) || { tone: 'off' as Tone, label: status ?? '-' };
  const tone = TONE_CLASS[spec.tone];
  return (
    <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, tone.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
      {spec.label}
    </span>
  );
}

export interface ScanTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function ScanTab({ targetSourceId }: ScanTabProps): ReactElement {
  const { latestJob: rawLatestJob, loading, error, refresh } = useScanPolling(targetSourceId);
  // The mock latest endpoint answers a NO_SCAN placeholder instead of 404 for a
  // never-scanned target — normalize it to "no scan yet" so the empty state wins.
  const latestJob = rawLatestJob?.scan_status === 'NO_SCAN' ? null : rawLatestJob;
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const [rows, setRows] = useState<ScanJob[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);

  // Latest-request-wins: rapid pagination can resolve out of order, and a stale
  // response must not commit page/rows over a newer one.
  const historySeq = useRef(0);
  const loadHistory = useCallback(async (nextPage: number): Promise<void> => {
    const seq = ++historySeq.current;
    setHistoryLoading(true);
    setHistoryFailed(false);
    try {
      const data = await getScanHistory(targetSourceId, nextPage, PAGE_SIZE);
      if (seq !== historySeq.current) return;
      setRows(data.content ?? []);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      if (seq !== historySeq.current) return;
      setHistoryFailed(true);
    } finally {
      if (seq === historySeq.current) setHistoryLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void loadHistory(0);
  }, [loadHistory]);

  const scanning = latestJob?.scan_status === 'SCANNING';

  // A finished scan adds a history row whatever its outcome, so reload on the
  // SCANNING→terminal edge (not only on success). The ref starts false, so
  // mounting on an already-terminal job does not double-fetch page 0.
  const wasScanningRef = useRef(false);
  useEffect(() => {
    if (wasScanningRef.current && !scanning) void loadHistory(0);
    wasScanningRef.current = scanning;
  }, [scanning, loadHistory]);

  const runScan = useCallback(async (): Promise<void> => {
    setStarting(true);
    setStartFailed(false);
    try {
      await startScan(targetSourceId);
      // Pull the new job in immediately — useScanPolling resumes polling by
      // itself once it observes SCANNING.
      await refresh();
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }, [targetSourceId, refresh]);

  const reload = useCallback((): void => {
    void refresh();
    void loadHistory(page);
  }, [refresh, loadHistory, page]);

  const { table } = opsStyles;
  const percent = fmtPercent(latestJob?.scan_progress);
  const resourceCounts = Object.entries(latestJob?.resource_count_by_resource_type ?? {});

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="최근 스캔">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className={opsStyles.cardTitle}>최근 스캔</h2>
            <p className={opsStyles.cardDesc}>
              클라우드 리소스를 스캔해 연동 가능한 대상 목록을 갱신합니다.
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <PlButton variant="secondary" onClick={reload}>
              새로고침
            </PlButton>
            <PlButton variant="primary" disabled={scanning || starting} onClick={() => void runScan()}>
              {scanning ? '스캔 중…' : starting ? '시작 중…' : '스캔 실행'}
            </PlButton>
          </div>
        </div>

        {startFailed && (
          <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[13px] text-[var(--pl-err-text)]">
            스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {loading && !latestJob ? (
          <p className={cn(pipelineStyles.text.meta, 'mt-4')} aria-busy>
            불러오는 중…
          </p>
        ) : !latestJob ? (
          error ? (
            <p className={cn(pipelineStyles.text.meta, 'mt-4')}>스캔 정보를 불러오지 못했습니다.</p>
          ) : (
            <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
          )
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <ScanStatusPill status={latestJob.scan_status} />
              {latestJob.id !== undefined && (
                <span className={META_LABEL}>
                  Scan{' '}
                  <span className={cn(META_VALUE, '[font-family:var(--pl-font-mono)]')}>#{latestJob.id}</span>
                </span>
              )}
              <span className={META_LABEL}>
                버전 <span className={META_VALUE}>v{latestJob.scan_version ?? '-'}</span>
              </span>
              <span className={META_LABEL}>
                소요 <span className={META_VALUE}>{fmtDuration(latestJob.duration_seconds)}</span>
              </span>
              <span className={META_LABEL}>
                실행 <span className={META_VALUE}>{fmtDateTime(latestJob.created_at)}</span>
              </span>
            </div>

            <div className="mt-3.5 flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--pl-gray-100)]"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-[var(--pl-primary)]" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]">
                {percent}%
              </span>
            </div>

            <div className="mt-4">
              <p className="text-[13px] font-semibold text-[var(--pl-text-medium)]">발견 리소스</p>
              {resourceCounts.length === 0 ? (
                <p className={cn(pipelineStyles.text.meta, 'mt-2')}>발견된 리소스가 없습니다.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {resourceCounts.map(([type, count]) => (
                    <span key={type} className={cn(opsStyles.tag, 'px-2.5 py-[5px]')}>
                      {type}
                      <b className="ml-1.5 text-[var(--pl-primary)]">{count}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {latestJob.scan_error && (
              <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[13px] text-[var(--pl-err-text)]">
                <span className="[font-family:var(--pl-font-mono)] font-semibold">{latestJob.scan_error}</span>
                <span className="ml-2">{errorLabel(latestJob.scan_error)}</span>
              </p>
            )}
          </>
        )}
      </section>

      <section className={pipelineStyles.card.base} aria-label="스캔 이력">
        <h2 className={opsStyles.cardTitle}>스캔 이력</h2>

        {historyLoading ? (
          <div className="min-h-[160px]" aria-busy />
        ) : historyFailed ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>스캔 이력을 불러오지 못했습니다.</p>
            <PlButton variant="secondary" className="mt-3" onClick={() => void loadHistory(page)}>
              다시 시도
            </PlButton>
          </div>
        ) : rows.length === 0 ? (
          <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
        ) : (
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={table.base}>
              <thead>
                <tr>
                  <th className={table.headCell}>실행 일시</th>
                  <th className={table.headCell}>상태</th>
                  <th className={table.headCell}>버전</th>
                  <th className={table.headCell}>진행률</th>
                  <th className={table.headCell}>소요</th>
                  <th className={table.headCell}>오류</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id ?? `${row.created_at ?? ''}-${index}`}>
                    <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDateTime(row.created_at)}</td>
                    <td className={table.cell}>
                      <ScanStatusPill status={row.scan_status} />
                    </td>
                    <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                      v{row.scan_version ?? '-'}
                    </td>
                    <td className={cn(table.cell, 'tabular-nums')}>{fmtPercent(row.scan_progress)}%</td>
                    <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDuration(row.duration_seconds)}</td>
                    <td className={table.cell}>
                      {row.scan_error ? (
                        <span
                          className={cn(
                            opsStyles.statusTag,
                            'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                          )}
                          title={errorLabel(row.scan_error)}
                        >
                          {row.scan_error}
                        </span>
                      ) : (
                        <span className="text-[var(--pl-text-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <OpsPagination page={page} totalPages={totalPages} onChange={(next) => void loadHistory(next)} />
      </section>
    </>
  );
}
