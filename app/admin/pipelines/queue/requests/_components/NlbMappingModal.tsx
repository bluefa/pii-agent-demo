/**
 * NlbMappingModal — 현재 배정된 NLB (P3 IDC "NLB 정보" per-row modal). A TqModal
 * that lists, for ONE 연동 대상 리소스, the NLB index each consuming service is
 * assigned to (`getNlbIndexMappings`). Read-only — the per-row NLB reassignment
 * lives in the detail table, not here.
 *
 * resource_id is NEVER rendered — the resource is identified in the meta row by
 * its 연동 대상 (connectTargets) + DB type tag (design-spec §8). `mappings === null`
 * means the fetch failed → the body shows an informative fallback rather than a
 * false "배정 없음".
 */
'use client';

import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import type {
  NlbIndexMapping,
  RequestResourceRow,
  ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';

/** The resource's current NLB mappings, or null when unavailable — the fetch
 *  failed (`mappings === null`) or the row has no resource_id key. A resource
 *  absent from a successful fetch has no assignment yet → [] (배정 없음), which is
 *  distinct from the null load-failure fallback. */
export function findResourceMappings(
  mappings: ResourceNlbMappings[] | null,
  resourceId: string | null,
): NlbIndexMapping[] | null {
  if (mappings === null || resourceId == null) return null;
  const entry = mappings.find((m) => m.resourceId === resourceId);
  return entry ? entry.mappings : [];
}

export interface NlbMappingModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  resource: RequestResourceRow;
  /** All resources' mappings, or null when the fetch failed. */
  mappings: ResourceNlbMappings[] | null;
}

export function NlbMappingModal({
  open,
  onClose,
  targetSourceId,
  resource,
  mappings,
}: NlbMappingModalProps): ReactElement {
  const { appTable, tag } = tqStyles;
  const rows = findResourceMappings(mappings, resource.resourceId);
  const connect = resource.connectTargets.join(' · ') || '—';
  // Long lists scroll inside the modal body instead of paginating (demo tops out
  // at 8, but a consuming-service fan-out can exceed the modal height).
  const scrollable = rows != null && rows.length > 10;

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="연동 요청"
      eyebrowId={`#${targetSourceId}`}
      title="현재 배정된 NLB"
      meta={
        <>
          <span className={cn(tag.base, tag.blue)}>{resource.databaseType ?? '—'}</span>
          <span className={appTable.tdMono}>{connect}</span>
        </>
      }
      sub="이 연동 대상을 사용하는 서비스별 NLB 배정 현황이에요."
      footer={
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      }
    >
      <div className={appTable.wrap}>
        <div className={scrollable ? 'max-h-[360px] overflow-y-auto' : undefined}>
          <table className={appTable.root}>
            <thead className={appTable.thead}>
              <tr>
                <th className={appTable.th}>Service Code</th>
                <th className={`${appTable.th} w-[140px]`}>NLB Index</th>
              </tr>
            </thead>
            <tbody className={appTable.body}>
              {rows === null ? (
                <tr className={appTable.row}>
                  <td className={appTable.td} colSpan={2}>
                    <span className="text-[var(--pl-text-weak)]">NLB 정보를 불러오지 못했어요</span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className={appTable.row}>
                  <td className={appTable.td} colSpan={2}>
                    <span className="text-[var(--pl-text-weak)]">배정된 NLB가 없어요</span>
                  </td>
                </tr>
              ) : (
                rows.map((m, index) => (
                  <tr key={`${m.serviceCode ?? '—'}-${m.nlbIndex ?? '—'}-${index}`} className={appTable.row}>
                    <td className={`${appTable.td} ${appTable.tdMono}`}>{m.serviceCode ?? '—'}</td>
                    <td className={`${appTable.td} ${appTable.tdMono}`}>
                      {m.nlbIndex != null ? `NLB #${m.nlbIndex}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TqModal>
  );
}
