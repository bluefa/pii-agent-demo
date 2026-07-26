'use client';

/**
 * 승인 요청 내역 card (Figma 30:3 left) — per-target approval history
 * (swagger GET …/approval-history, Spring Page). 상세 보기 reuses the shared
 * ApprovalRequestDetailModal; rows adapt the snake wire to its item shape.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getApprovalHistory } from '@/app/lib/api';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { ApprovalRequestDetailModal } from '@/app/components/features/process-status/ApprovalRequestDetailModal';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 5;

/** Snake wire of one approval-history Page content item (swagger Page is untyped). */
interface ApprovalHistoryRowWire {
  request?: {
    id?: number;
    requested_by?: { user_id?: string };
    requested_at?: string;
    resource_total_count?: number;
    resource_selected_count?: number;
    status?: string;
  };
  result?: {
    status?: string;
    processed_by?: { user_id?: string };
    processed_at?: string;
    reason?: string | null;
  };
}

/** ApprovalRequestDetailModal item shape (its interface is module-local; structural match). */
const toModalItem = (row: ApprovalHistoryRowWire) => ({
  request: {
    id: row.request?.id ?? '-',
    requested_by: row.request?.requested_by?.user_id ?? '-',
    requested_at: row.request?.requested_at ?? '',
    resource_total_count: row.request?.resource_total_count,
    resource_selected_count: row.request?.resource_selected_count,
  },
  result: row.result
    ? {
        result: row.result.status,
        processed_at: row.result.processed_at,
        process_info: {
          user_id: row.result.processed_by?.user_id,
          reason: row.result.reason ?? undefined,
        },
      }
    : undefined,
});

export interface ApprovalHistoryCardProps {
  targetSourceId: number;
}

export function ApprovalHistoryCard({ targetSourceId }: ApprovalHistoryCardProps): ReactElement {
  const [rows, setRows] = useState<ApprovalHistoryRowWire[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<ApprovalHistoryRowWire | null>(null);

  const load = useCallback(async (nextPage: number): Promise<void> => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await getApprovalHistory(targetSourceId, nextPage, PAGE_SIZE);
      setRows((data.content ?? []) as ApprovalHistoryRowWire[]);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const { table } = pipelineStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="승인 요청 내역">
      <h2 className={opsStyles.cardTitle}>승인 요청 내역</h2>
      <p className={opsStyles.cardDesc}>연동 요청 process 진행 현황</p>

      {failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>승인 요청 내역을 불러오지 못했습니다.</p>
      ) : !loading && rows.length === 0 ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>승인 요청 내역이 없습니다.</p>
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          <table className={table.root}>
            <thead>
              <tr>
                <th className={table.th}>요청 일시</th>
                <th className={table.th}>상태</th>
                <th className={table.th}>요청자</th>
                <th className={cn(table.th, 'w-24')} aria-label="상세" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {rows.map((row, index) => (
                <tr key={`${row.request?.id ?? 'row'}-${index}`}>
                  <td className={cn(table.td, table.tdColor, 'whitespace-nowrap')}>
                    {fmtDateTime(row.request?.requested_at)}
                  </td>
                  <td className={table.td}>
                    <HistoryStatusPill status={row.result?.status ?? row.request?.status ?? null} />
                  </td>
                  <td className={cn(table.td, table.tdColor)}>
                    {row.request?.requested_by?.user_id ?? '-'}
                  </td>
                  <td className={cn(table.td, 'text-right')}>
                    <button type="button" className={opsStyles.detailLink} onClick={() => setDetail(row)}>
                      상세 보기 <span aria-hidden>→</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <PlPagination
          center
          page={page + 1}
          pages={totalPages}
          onPrev={() => void load(page - 1)}
          onNext={() => void load(page + 1)}
        />
      )}

      <ApprovalRequestDetailModal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        item={detail ? toModalItem(detail) : null}
      />
    </section>
  );
}
