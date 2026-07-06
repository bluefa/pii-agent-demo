/**
 * FilterChips (R18 §4, Komiser reference) — the chip row under the FilterBar.
 *
 * Scope chip (always, no ×): 기간 · {label} — RIGHTMOST in the row, next to the
 * count (R21.5, owner: 목록 가장 우측). (R20 — the 정렬 chip is gone;
 * failed-first ordering is behavior, not a filter the operator toggles.)
 * Active-filter chips (only when the filter is off its default, × removes just
 * that filter): 상태 · FAILED, CSP · AWS, 검색 · "q". When any active chip is
 * present a [필터 초기화] button resets 검색·상태·CSP (period is preserved).
 * The right-aligned count shows the client-filtered total (truncation → title).
 */
import type { ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { providerLabel } from '@/lib/pipeline/format';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { DASH_FETCH_SIZE } from '@/app/integration/admin/pipelines/_dashboard/logic';

/** One chip. `onRemove` present → removable (× button); absent → scope chip. */
function Chip({
  keyLabel,
  value,
  title,
  onRemove,
  removeAria,
}: {
  keyLabel: string;
  value: string;
  title?: string;
  onRemove?: () => void;
  removeAria?: string;
}): ReactElement {
  const { filterChip } = pipelineStyles;
  const removable = onRemove != null;
  return (
    <span className={cn(filterChip.base, removable && filterChip.removable)} title={title}>
      <span className={filterChip.key}>{keyLabel}</span>
      <span className={filterChip.value}>{value}</span>
      {onRemove && (
        <button type="button" className={filterChip.remove} onClick={onRemove} aria-label={removeAria}>
          <Icon name="x" size="sm" />
        </button>
      )}
    </span>
  );
}

export interface FilterChipsProps {
  /** Human window label for the active period seg (e.g. '최근 24시간'). */
  periodLabel: string;
  /** Wire PipelineStatus or '' (no filter). */
  status: string;
  /** Wire CloudProvider (UPPERCASE) or '' (no filter). */
  provider: string;
  q: string;
  /** Client-filtered row count (paginate `total`). */
  total: number;
  /** Upstream window was capped (totalElements > DASH_FETCH_SIZE). */
  truncated: boolean;
  onClearStatus: () => void;
  onClearProvider: () => void;
  onClearSearch: () => void;
  /** Reset 검색·상태·CSP (period kept). */
  onResetFilters: () => void;
}

export function FilterChips({
  periodLabel,
  status,
  provider,
  q,
  total,
  truncated,
  onClearStatus,
  onClearProvider,
  onClearSearch,
  onResetFilters,
}: FilterChipsProps): ReactElement {
  const { filterChip } = pipelineStyles;
  const query = q.trim();
  const hasActiveFilter = Boolean(status) || Boolean(provider) || Boolean(query);

  return (
    <div className={filterChip.row}>
      {status && (
        <Chip keyLabel="상태" value={status} onRemove={onClearStatus} removeAria="상태 필터 제거" />
      )}
      {provider && (
        <Chip
          keyLabel="CSP"
          value={providerLabel(provider)}
          onRemove={onClearProvider}
          removeAria="CSP 필터 제거"
        />
      )}
      {query && (
        <Chip
          keyLabel="검색"
          value={`"${query}"`}
          onRemove={onClearSearch}
          removeAria="검색 필터 제거"
        />
      )}
      {hasActiveFilter && (
        <button type="button" className={filterChip.reset} onClick={onResetFilters}>
          필터 초기화
        </button>
      )}
      <span
        className={filterChip.count}
        title={truncated ? `최신 ${DASH_FETCH_SIZE}건 기준 근사` : undefined}
      >
        {total}건
      </span>
      <Chip keyLabel="기간" value={periodLabel} />
    </div>
  );
}
