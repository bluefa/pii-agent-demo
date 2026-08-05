'use client';

/**
 * ServiceAssignmentModal — 서비스별 NLB 배정 for ONE 연동 대상: which NLB index each
 * consuming service is on (`getNlbIndexMappings`). Read-only; the resource's own
 * assignment is changed in NlbAssignModal.
 *
 * A modal rather than a column: the fan-out reaches 20–30 services on a shared target,
 * which no cell can hold, and it is a lookup the admin makes occasionally rather than
 * something to be read down the whole page. That same size is why the list pages
 * instead of growing the modal to its cap and handing the rest to a scrollbar.
 *
 * No footer: the modal is read-only, so its only action would have been 닫기, which the
 * header X already is.
 *
 * resource_id is NEVER rendered — the resource is named by its endpoint + DB type
 * (design-spec §8). `mappings === null` means the fetch failed, which the body says
 * outright instead of passing for 배정 없음.
 *
 * The contract gives exactly two things per row — `service_code` and `nlb_index` — so
 * that is what the table shows. An NLB IP column used to sit beside the index, joined
 * from the NLB table: with the index and its IPs 1:1, it restated the index on every row,
 * and a target on six NLBs printed the same six IP pairs thirty times. The sub line now
 * spends that space on the two counts the list could only be counted for by hand.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { findResourceMappings } from '@/app/admin/pipelines/queue/requests/_logic';
import type {
  RequestResourceRow,
  ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';

// 12px mono at 500, ScanDetailModal's value ink. One pair per cell, on a hairline.
const CELL =
  'flex items-baseline justify-between gap-3 border-b border-[var(--pl-border)] py-2 text-[12px] font-medium [font-family:var(--pl-font-mono)]';
const EMPTY = 'py-2 text-[12px] text-[var(--pl-text-weak)]';

export interface ServiceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  resource: RequestResourceRow;
  /** All resources' mappings, or null when the fetch failed. */
  mappings: ResourceNlbMappings[] | null;
}

export function ServiceAssignmentModal({
  open,
  onClose,
  resource,
  mappings,
}: ServiceAssignmentModalProps): ReactElement {
  const { appTable, tag } = tqStyles;
  const rows = findResourceMappings(mappings, resource.resourceId);
  const total = rows?.length ?? 0;
  // Distinct indexes, not rows: "NLB 6개" answers how many listeners this one target is
  // spread across, which the paged list can otherwise only be counted for by hand.
  const nlbCount = new Set(
    (rows ?? []).map((m) => m.nlbIndex).filter((i): i is number => i != null),
  ).size;
  const endpoints = resource.connectTargets
    .map((host) => (resource.port == null ? host : `${host}:${resource.port}`))
    .join(' · ');

  return (
    <TqModal
      open={open}
      onClose={onClose}
      // Not "서비스별 NLB 배정": 배정 is what the admin CHANGES in the row's own NLB 배정
      // column, and this modal changes nothing. The question it answers is who consumes
      // this target — the NLB each one lands on is the attribute, and it is the column.
      title="이 대상을 사용하는 서비스"
      meta={
        <>
          <span className={cn(tag.base, tag.blue)}>
            {resource.databaseType ? getDatabaseShortLabel(resource.databaseType) : '—'}
          </span>
          <span className={appTable.tdMono}>{endpoints || '—'}</span>
        </>
      }
      // The old sentence restated the title ("서비스별 NLB 배정" / "…서비스별 NLB 배정
      // 현황이에요") and so was invisible in the way that costs nothing to miss. The two
      // counts are what the reader actually came for. Omitted when there is nothing to
      // count — the body already says whether that is "없음" or "못 불러옴".
      sub={total > 0 ? `서비스 ${total}개 · NLB ${nlbCount}개` : undefined}
    >
      {/* Three across, not one column down. The contract gives two short fields per row,
          and a 24-row two-column table left most of a 720px modal empty while still making
          the reader scroll for the thing the modal exists to show. Three pairs to a line
          fits 24 in eight rows — the fan-out is the point, and now it is one look.

          No column header: "ORD" beside "NLB #3" says what it is, and a header could only
          be repeated three times or aligned to none of them. The cap stays as a guard for
          a target with far more consumers than the 20–30 seen so far; grid rather than CSS
          columns because multi-column inside a fixed height flows sideways instead. */}
      <div className="max-h-[44vh] overflow-y-auto">
        {rows === null ? (
          <p className={EMPTY}>NLB 정보를 불러오지 못했어요</p>
        ) : total === 0 ? (
          <p className={EMPTY}>배정된 NLB가 없어요</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-8">
            {rows.map((m, index) => (
              <div key={`${m.serviceCode ?? '—'}-${m.nlbIndex ?? '—'}-${index}`} className={CELL}>
                <span className="text-[var(--pl-text-strong)]">{m.serviceCode ?? '—'}</span>
                <span className="text-[var(--pl-text-medium)]">
                  {m.nlbIndex != null ? `NLB #${m.nlbIndex}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TqModal>
  );
}
