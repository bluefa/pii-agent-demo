'use client';

import { SCAN_ERROR_LABELS, isScanSettled } from '@/app/components/features/scan/scan-labels';
import {
  fmtScanCount,
  scanDurationText,
  scanStatusLabel,
  scanStatusTagClass,
  sortedCounts,
  trimProviderPrefix,
  type ScanJob,
} from '@/app/components/features/scan/scan-job-format';
import { borderColors, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import type { CloudProvider } from '@/lib/types';

// Card-less list grammar, shared with the history table: the modal body already
// insets the content, so only the outer columns drop their horizontal padding.
const HEAD_CELL = cn(
  idcStyles.table.approvalHeaderCell,
  'first:pl-0 last:pr-0 text-left text-[12px] font-semibold',
  textColors.secondary,
);
const BODY_CELL = cn(idcStyles.table.approvalCell, 'first:pl-0 last:pr-0');

/** Bottom time row — the label is metadata tone, the value is content tone. */
const TimeField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className={cn('text-[12px] font-medium', textColors.tertiary)}>{label}</p>
    <p className={cn('mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums', textColors.secondary)}>
      {value || '—'}
    </p>
  </div>
);

/**
 * One scan's detail: verdict → total + per-type counts → error → timestamps.
 * The counts ride along on the history response, so opening a row costs no
 * extra request.
 *
 * The list scrolls with the modal body (a nested scroll box would put two
 * scrollbars on one surface) and the table header is NOT sticky: pinned to the
 * modal's scrollport it floats mid-list and covers rows.
 */
export const ScanDetail = ({ job, provider }: { job: ScanJob; provider: CloudProvider }) => {
  const counts = sortedCounts(job);
  const total = counts.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div>
      <span className={cn(idcStyles.tag.base, scanStatusTagClass(job.scan_status))}>
        {scanStatusLabel(job)}
      </span>

      {/* 저장 중인 잡은 결과가 아직 없다 — 설명 없는 빈 자리는 "0건"으로 읽힌다. */}
      {job.scan_status === 'SAVING' && (
        <p className={cn('mt-4 text-[14px]', textColors.tertiary)}>
          결과를 집계하고 있어요. 잠시 후 다시 확인해 주세요.
        </p>
      )}

      {job.scan_status === 'SUCCESS' && (
        <div className="mt-4">
          {counts.length === 0 ? (
            <p className={cn('text-sm', textColors.tertiary)}>발견된 리소스가 없어요.</p>
          ) : (
            <>
              <p className={cn('text-[14px]', textColors.tertiary)}>
                총{' '}
                <b className={cn('text-[20px] font-bold tabular-nums', primaryColors.text)}>
                  {fmtScanCount(total)}
                </b>
                개를 발견했어요.
              </p>
              {/* border-separate: border-collapse drops cell borders inside a scrollport. */}
              <div className="mt-3">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="whitespace-nowrap">
                      <th className={cn(HEAD_CELL, 'border-b', borderColors.default)}>리소스 타입</th>
                      <th className={cn(HEAD_CELL, 'border-b text-right', borderColors.default)}>개수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map(([type, count]) => (
                      <tr key={type} title={type}>
                        <td
                          className={cn(
                            BODY_CELL,
                            'border-b py-2.5 font-mono text-[12px]',
                            borderColors.light,
                            textColors.secondary,
                          )}
                        >
                          {trimProviderPrefix(type, provider)}
                        </td>
                        <td
                          className={cn(
                            BODY_CELL,
                            'border-b py-2.5 text-right text-[14px] tabular-nums',
                            borderColors.light,
                            textColors.primary,
                          )}
                        >
                          {fmtScanCount(count)}
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
        <p
          className={cn(
            'mt-4 rounded-lg px-3 py-2.5 text-[14px]',
            statusColors.error.bg,
            statusColors.error.textDark,
          )}
        >
          <span className="font-mono font-semibold">{job.scan_error}</span>
          <span className="ml-2">{SCAN_ERROR_LABELS[job.scan_error] ?? SCAN_ERROR_LABELS.UNKNOWN}</span>
        </p>
      )}

      <div className={cn('mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t pt-3.5', borderColors.light)}>
        <TimeField label="실행 시각" value={job.created_at ? formatDate(job.created_at, 'datetime') : ''} />
        {/* 아직 안 끝난 잡에 완료 시각을 적지 않는다. */}
        {isScanSettled(job.scan_status) && (
          <>
            <TimeField label="완료 시각" value={job.updated_at ? formatDate(job.updated_at, 'datetime') : ''} />
            <TimeField label="소요 시간" value={scanDurationText(job)} />
          </>
        )}
      </div>
    </div>
  );
};
