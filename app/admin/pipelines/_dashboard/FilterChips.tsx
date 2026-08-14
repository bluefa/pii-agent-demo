/**
 * FilterChips (R18 §4, Komiser reference) — the chip row under the FilterBar.
 *
 * Active-filter chips (only when the filter is off its default, × removes just
 * that filter): 상태 · 실패, Cloud · AWS, 유형 · 설치, 검색 · "q". Every chip says
 * what the ROW says — the enum never reaches this row. When any
 * active chip is present a [필터 초기화] button resets 검색·상태·Cloud·유형.
 * The period scope chip moved next to the section title (page.tsx); the row
 * count was dropped (오너 피드백). Row order always follows the API response.
 */
import type { ReactElement } from 'react';

import { cn, pipelineStyles } from '@/lib/theme';
import { providerLabel, statusKo, typeKo } from '@/lib/pipeline/format';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import type { PipelineStatus, PipelineType } from '@/lib/pipeline/types';

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
  /** Wire PipelineStatus or '' (no filter). Narrower than its siblings because the
   *  chip renders the Korean label for it, and `statusKo` only accepts the enum. */
  status: '' | PipelineStatus;
  /** Wire CloudProvider (UPPERCASE) or '' (no filter). */
  provider: string;
  /** Wire PipelineType or '' (no filter). Narrowed for the same reason `status`
   *  is: the chip renders the Korean label, and `typeKo` only accepts the enum. */
  type: '' | PipelineType;
  q: string;
  onClearStatus: () => void;
  onClearProvider: () => void;
  onClearType: () => void;
  onClearSearch: () => void;
  /** Reset 검색·상태·Cloud·유형 (period kept). */
  onResetFilters: () => void;
}

export function FilterChips({
  status,
  provider,
  type,
  q,
  onClearStatus,
  onClearProvider,
  onClearType,
  onClearSearch,
  onResetFilters,
}: FilterChipsProps): ReactElement {
  const { filterChip } = pipelineStyles;
  const query = q.trim();
  const hasActiveFilter = Boolean(status) || Boolean(provider) || Boolean(type) || Boolean(query);

  return (
    <div className={filterChip.row}>
      {status && (
        <Chip
          keyLabel="상태"
          value={statusKo(status)}
          onRemove={onClearStatus}
          removeAria="상태 필터 제거"
        />
      )}
      {provider && (
        <Chip
          keyLabel="Cloud"
          value={providerLabel(provider)}
          onRemove={onClearProvider}
          removeAria="Cloud 필터 제거"
        />
      )}
      {type && (
        <Chip
          keyLabel="유형"
          value={typeKo(type)}
          onRemove={onClearType}
          removeAria="유형 필터 제거"
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
    </div>
  );
}
