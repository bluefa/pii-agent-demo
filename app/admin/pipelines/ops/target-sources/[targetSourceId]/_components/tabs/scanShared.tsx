'use client';

/**
 * Shared grammar for the scan tab family (ScanTab / RecentScanCard /
 * ScanHistoryCard / ScanDetailModal): status pill, error labels, time field,
 * and count/duration formatters. Split out so every surface renders the same
 * vocabulary while each component stays a readable size.
 */
import type { ReactElement, ReactNode } from 'react';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { cn, pipelineStyles } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

export type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

type Tone = 'ok' | 'info' | 'err' | 'off';

// Dot-free tinted pill — label + color already say the state; a dot repeats it (ops feedback).
const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  info: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
};

/**
 * ScanStatus (app/api/_lib/v1-types.ts) → tone + Korean label. SAVING is the
 * contract's name for the window where discovery is over but the counts are not
 * written yet; FINALIZING is the UI's own name for that same window seen as a
 * SUCCESS whose count map has not landed. One label for both — a green 성공 pill
 * over an empty result would be a lie either way.
 */
const SCAN_STATUS: Record<string, { tone: Tone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  SCANNING: { tone: 'info', label: '스캔 중' },
  SAVING: { tone: 'info', label: '마무리 중' },
  FINALIZING: { tone: 'info', label: '마무리 중' },
  FAIL: { tone: 'err', label: '실패' },
  TIMEOUT: { tone: 'err', label: '타임아웃' },
  CANCELED: { tone: 'off', label: '취소' },
};

const SCAN_ERROR_LABEL: Record<string, string> = {
  AUTH_PERMISSION_ERROR: '권한 오류입니다. 스캔 권한 카드에서 자격을 검증해 주세요.',
  RATE_LIMIT: '요청 한도 초과',
  NETWORK_ERROR: '네트워크 오류',
  SERVICE_ERROR: '클라우드 서비스 오류',
  UNKNOWN: '알 수 없는 오류',
};

export const errorLabel = (code: string): string => SCAN_ERROR_LABEL[code] ?? SCAN_ERROR_LABEL.UNKNOWN;

export function ScanStatusPill({ status }: { status: string | null | undefined }): ReactElement {
  const spec = (status && SCAN_STATUS[status]) || { tone: 'off' as Tone, label: status ?? '-' };
  return (
    <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TONE_CLASS[spec.tone])}>
      {spec.label}
    </span>
  );
}

/** Bottom time-row field — metadata tone, not content (kv): faint label over a 14/medium value. */
export function TimeField({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-[var(--pl-text-faint)]">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums text-[var(--pl-text-medium)]">
        {children}
      </p>
    </div>
  );
}

/** 214.6s → '3분 34초', 44s → '44초'; unknown → '—'. */
export const fmtDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}분 ${String(rest).padStart(2, '0')}초` : `${rest}초`;
};

/** Count map → [type, count] array, count desc, ties by name asc; null counts dropped. */
export const sortResourceCounts = (
  counts: Record<string, number | null | undefined> | null | undefined,
): Array<[string, number]> =>
  Object.entries(counts ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * Within one target the provider is a constant, so AWS_/AZURE_/GCP_ prefixes
 * carry no information — trim them for display, keep the full key in `title`.
 * Unknown prefixes pass through untouched (open set).
 */
export const trimProviderPrefix = (type: string, provider: CloudProvider): string => {
  const prefix = `${provider.toUpperCase()}_`;
  return type.startsWith(prefix) ? type.slice(prefix.length) : type;
};

export const totalOf = (entries: Array<[string, number]>): number =>
  entries.reduce((sum, [, count]) => sum + count, 0);

/** Thousands separators for ops-scale counts — locale pinned (SSR/CSR mismatch guard). */
export const fmtCount = (n: number): string => n.toLocaleString('ko-KR');
