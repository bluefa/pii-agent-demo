import type { ScanCopy } from '@/app/components/features/scan/copy';
import {
  scanErrorLabels,
  scanStatusLabels,
} from '@/app/components/features/scan/scan-labels';
import { idcStyles } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

/**
 * Display vocabulary for one scan job, shared by the history list and the
 * per-scan detail so both surfaces say a number the same way.
 *
 * The formatters that produce words take the dictionary as a parameter: this is
 * a plain module and cannot call `useLocale`, so the render site passes
 * `SCAN_COPY[locale]` in. `t` is required rather than defaulted to Korean —
 * every caller is a component that already holds it, and a required parameter
 * is what makes the compiler catch a call site that forgot the reader.
 */
export type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

export const scanStatusTagClass = (scanStatus: ScanJob['scan_status']): string => {
  switch (scanStatus) {
    case 'SUCCESS':
      return idcStyles.tag.green;
    case 'FAIL':
    case 'TIMEOUT':
      return idcStyles.tag.red;
    default: // SCANNING · CANCELED
      return idcStyles.tag.gray;
  }
};

export const scanStatusLabel = (job: ScanJob, t: ScanCopy): string =>
  job.scan_status ? (scanStatusLabels(t)[job.scan_status] ?? job.scan_status) : '';

/** Count map → [type, count] pairs, count desc, ties by name asc. */
export const sortedCounts = (job: ScanJob): Array<[string, number]> =>
  Object.entries(job.resource_count_by_resource_type ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** Total discovered resources — the list summary needs the sum, not the order. */
export const discoveredTotal = (job: ScanJob): number =>
  Object.values(job.resource_count_by_resource_type ?? {}).reduce<number>(
    (sum, count) => sum + (count ?? 0),
    0,
  );

/**
 * The provider is constant within one target source, so an `AZURE_` prefix
 * carries no information. Trimmed for display only; callers keep the full key
 * in `title`.
 */
export const trimProviderPrefix = (type: string, provider: CloudProvider): string => {
  const prefix = `${provider.toUpperCase()}_`;
  return type.startsWith(prefix) ? type.slice(prefix.length) : type;
};

/**
 * 214.6s → '3분 34초' / '3m 34s', 44s → '44초' / '44s'. Same truncation and
 * zero-padding as the admin scan tab's `fmtDuration`, so one scan never reads as
 * two different durations across the two surfaces. Absent duration renders as an
 * empty cell.
 */
export const scanDurationText = (job: ScanJob, t: ScanCopy): string => {
  if (typeof job.duration_seconds !== 'number' || !Number.isFinite(job.duration_seconds)) return '';
  const total = Math.max(0, Math.floor(job.duration_seconds));
  const minutes = Math.floor(total / 60);
  return minutes > 0
    ? t.durationMinSec(minutes, String(total % 60).padStart(2, '0'))
    : t.durationSec(total);
};

/** Thousands separators, locale pinned — an unpinned format can differ across SSR/CSR. */
export const fmtScanCount = (n: number): string => n.toLocaleString('ko-KR');

/** History-row outcome column: what a finished scan produced, or why it did not. */
export const scanResultText = (job: ScanJob, t: ScanCopy): string => {
  if (job.scan_status === 'SUCCESS') return t.foundCount(fmtScanCount(discoveredTotal(job)));
  if (job.scan_error) return scanErrorLabels(t)[job.scan_error] ?? job.scan_error;
  return '';
};
