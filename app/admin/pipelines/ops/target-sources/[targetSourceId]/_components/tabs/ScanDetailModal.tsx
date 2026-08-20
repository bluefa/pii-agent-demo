'use client';

/**
 * History-row detail modal — mirrors the recent-scan card hierarchy: verdict
 * (pill in the title line) → scan results (total + per-type table) → error →
 * time row. No close button: Esc / overlay click suffice (ops feedback).
 */
import type { ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import { formatDateTimeLocalDashed } from '@/lib/utils/date';
import type { CloudProvider } from '@/lib/types';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import {
  ScanStatusPill,
  TimeField,
  errorLabel,
  fmtCount,
  fmtDuration,
  sortResourceCounts,
  totalOf,
  trimProviderPrefix,
  type ScanJob,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';

export interface ScanDetailModalProps {
  open: boolean;
  /** Row the modal describes — undefined while closed (useModal contract). */
  job: ScanJob | undefined;
  provider: CloudProvider;
  onClose: () => void;
}

export function ScanDetailModal({ open, job, provider, onClose }: ScanDetailModalProps): ReactElement {
  const counts = sortResourceCounts(job?.resource_count_by_resource_type);
  return (
    <ModalShell open={open} onClose={onClose} labelledBy="scan-detail-title">
      {job && (
        <>
          {/* Two tiers ('Scan #N' title + 'Scan results' header) blurred the
              hierarchy — merged into one title line: results + #N + verdict. */}
          <h3
            id="scan-detail-title"
            className="flex items-center gap-2 text-[16px] font-bold text-[var(--pl-text-strong)]"
          >
            스캔 결과 <span className="[font-family:var(--pl-font-mono)]">#{job.scan_version ?? '-'}</span>
            <ScanStatusPill status={job.scan_status} />
          </h3>

          {job.scan_status === 'SUCCESS' && (
            <div className="mt-4">
              {counts.length === 0 ? (
                <p className={pipelineStyles.text.meta}>발견된 리소스가 없습니다.</p>
              ) : (
                <>
                  <p className="text-[14px] text-[var(--pl-text-weak)]">
                    총{' '}
                    <b className="text-[20px] font-bold tabular-nums text-[var(--pl-primary)]">
                      {fmtCount(totalOf(counts))}
                    </b>
                    개를 발견했어요.
                  </p>
                  {/* Per-type counts — the only rule is the one under the header.
                      Rows are built by spacing+alignment (mono left / tabular numbers
                      right); hover aids tracking. Values 400 / header 500 — nothing
                      but data ink. (Sticky header: border-collapse drops borders
                      while scrolling, hence border-separate.) */}
                  <div className="mt-3 max-h-[320px] overflow-y-auto">
                    <table className="w-full border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="sticky top-0 border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-2 pr-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)]">
                            리소스 타입
                          </th>
                          <th className="sticky top-0 border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-2 pl-3 text-right text-[12px] font-medium text-[var(--pl-text-weak)]">
                            개수
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {counts.map(([type, count]) => (
                          <tr key={type} title={type} className="hover:bg-[var(--pl-gray-50)]">
                            <td className="rounded-l-md py-2 pl-1 pr-3 text-[12px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]">
                              {trimProviderPrefix(type, provider)}
                            </td>
                            <td className="rounded-r-md py-2 pl-3 pr-1 text-right text-[14px] tabular-nums text-[var(--pl-text-strong)]">
                              {fmtCount(count)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {job.scan_error && (
            <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
              <span className="[font-family:var(--pl-font-mono)] font-semibold">{job.scan_error}</span>
              <span className="ml-2">{errorLabel(job.scan_error)}</span>
            </p>
          )}

          {/* Time row is the floor — same field grammar as the recent-scan card. */}
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
            <TimeField label="실행시간">{formatDateTimeLocalDashed(job.created_at, true)}</TimeField>
            <TimeField label="완료시간">{formatDateTimeLocalDashed(job.updated_at, true)}</TimeField>
            <TimeField label="소요 시간">{fmtDuration(job.duration_seconds)}</TimeField>
          </div>
        </>
      )}
    </ModalShell>
  );
}
