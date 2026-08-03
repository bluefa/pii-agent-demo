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
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { findResourceMappings } from '@/app/admin/pipelines/queue/requests/_logic';
import type {
  NlbTableRow,
  RequestResourceRow,
  ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';

const PAGE_SIZE = 10;

// Copied from ScanDetailModal's per-type table — 12/500 weak header over one rule,
// 12px mono values at 400. Nothing but data ink.
const TH = 'border-b border-[var(--pl-border)] py-2 pr-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)]';
const TD =
  'py-2 pr-3 text-[12px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]';

export interface ServiceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  resource: RequestResourceRow;
  /** All resources' mappings, or null when the fetch failed. */
  mappings: ResourceNlbMappings[] | null;
  /** The NLB table, joined by index to name each mapping's IPs. */
  nlbRows: NlbTableRow[];
}

export function ServiceAssignmentModal({
  open,
  onClose,
  resource,
  mappings,
  nlbRows,
}: ServiceAssignmentModalProps): ReactElement {
  const { appTable, tag } = tqStyles;
  // Fresh mount per resource (the page keys this modal) — page seeds at 1.
  const [page, setPage] = useState(1);
  // nlb_index → its IPs. A declared join: the NLB table names the IPs of each index,
  // so this says "NLB #3's IPs are …", not "these are the target's source IPs".
  const ipsByIndex = new Map(nlbRows.map((r) => [r.nlbIndex, r.nlbIpList]));
  const rows = findResourceMappings(mappings, resource.resourceId);
  const total = rows?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = (rows ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const endpoints = resource.connectTargets
    .map((host) => (resource.port == null ? host : `${host}:${resource.port}`))
    .join(' · ');

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title="서비스별 NLB 배정"
      meta={
        <>
          <span className={cn(tag.base, tag.blue)}>
            {resource.databaseType ? getDatabaseShortLabel(resource.databaseType) : '—'}
          </span>
          <span className={appTable.tdMono}>{endpoints || '—'}</span>
        </>
      }
      sub="이 연동 대상을 사용하는 서비스별 NLB 배정 현황이에요."
    >
      {/* ScanDetailModal's grammar, not appTable's: no frame, no header band, one rule
          under the header and nothing else. A modal opened to answer one lookup should
          not put a bordered, banded table inside a bordered card — the chrome ends up
          louder than the three columns it holds. Rows are built by spacing and
          alignment; hover aids tracking. */}
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${TH} w-[140px]`}>Service Code</th>
            <th className={`${TH} w-[110px]`}>NLB Index</th>
            {/* Right of the index it belongs to, the same order NlbAssignModal
                heads its own picker with. */}
            <th className={TH}>NLB IP</th>
          </tr>
        </thead>
        <tbody>
          {rows === null ? (
            <tr>
              <td className={`${TD} text-[var(--pl-text-weak)]`} colSpan={3}>
                NLB 정보를 불러오지 못했어요
              </td>
            </tr>
          ) : total === 0 ? (
            <tr>
              <td className={`${TD} text-[var(--pl-text-weak)]`} colSpan={3}>
                배정된 NLB가 없어요
              </td>
            </tr>
          ) : (
            slice.map((m, index) => (
              <tr
                key={`${m.serviceCode ?? '—'}-${m.nlbIndex ?? '—'}-${index}`}
                className="hover:bg-[var(--pl-gray-50)]"
              >
                <td className={TD}>{m.serviceCode ?? '—'}</td>
                <td className={TD}>{m.nlbIndex != null ? `NLB #${m.nlbIndex}` : '—'}</td>
                {/* Em-dash on an index the NLB table does not carry: the mapping named
                    an NLB, so a blank would read as "no IPs" rather than "not found". */}
                <td className={TD}>
                  {(m.nlbIndex != null && ipsByIndex.get(m.nlbIndex)?.join(' · ')) || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {total > PAGE_SIZE && (
        <PlPagination
          className="mt-4"
          page={page}
          pages={pages}
          onPrev={() => setPage((n) => Math.max(1, n - 1))}
          onNext={() => setPage((n) => Math.min(pages, n + 1))}
        />
      )}
    </TqModal>
  );
}
