'use client';

/**
 * 승인 요청 내역 card (Figma 30:3 left) — per-target approval history
 * (swagger GET …/approval-history, Spring Page). 상세 보기 reuses the shared
 * ApprovalRequestDetailModal; rows adapt the snake wire to its item shape.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getApprovalHistory } from '@/app/lib/api';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { ApprovalRequestDetailModal } from '@/app/components/features/process-status/ApprovalRequestDetailModal';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { fmtDateTime } from '@/lib/pipeline/format';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';

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
  /** Picks the table the 상세 보기 modal renders (IDC vs cloud). */
  isIdc: boolean;
}

export function ApprovalHistoryCard({
  targetSourceId,
  isIdc,
}: ApprovalHistoryCardProps): ReactElement {
  const [rows, setRows] = useState<ApprovalHistoryRowWire[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<ApprovalHistoryRowWire | null>(null);

  // Latest-request-wins: rapid pagination can resolve out of order, and a stale
  // response must not commit page/rows over a newer one.
  const loadSeq = useRef(0);
  const load = useCallback(async (nextPage: number): Promise<void> => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setFailed(false);
    try {
      const data = await getApprovalHistory(targetSourceId, nextPage, PAGE_SIZE);
      if (seq !== loadSeq.current) return;
      setRows((data.content ?? []) as ApprovalHistoryRowWire[]);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      if (seq !== loadSeq.current) return;
      setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const { table } = opsStyles;

  // The settled table and its skeleton share ONE head: written twice, a column change
  // follows only one of them and the skeleton silently stops being the table's footprint.
  const head = (
    <thead>
      <tr>
        <th className={table.headCell}>요청 일시</th>
        <th className={table.headCell}>상태</th>
        <th className={table.headCell}>요청자</th>
        <th className={cn(table.headCell, 'w-24')} aria-label="상세" />
      </tr>
    </thead>
  );

  return (
    <section className={cn(pipelineStyles.card.base, opsStyles.pagedCard)} aria-label="승인 요청 내역">
      <h2 className={opsStyles.cardTitle}>승인 요청 내역</h2>
      <p className={opsStyles.cardDesc}>연동 요청 process의 진행 현황입니다.</p>

      {/* Fixed body slot — see opsStyles.pagedCardBody. */}
      <div className={opsStyles.pagedCardBody}>
      {loading ? (
        /* The settled table's own footprint. Column names are fixed strings this screen
           already knows, so they are drawn for real (`StatusCardSkeleton`'s rule) and only
           the values are bars.
           Heights are MEASURED, not derived — the browser reports a settled head row at
           37.3px and a settled body row at 46.0px, and the same classes reproduce the head
           exactly. The body row is what the bars have to hold up: py-3(24) + hairline(1)
           leaves 21px of content, so the text bars are h-[21px] and only the pill's stays
           h-5, its real height.
           ⚠️ That 21px is NOT the 14px line box. The sibling 수신자 table uses the same
           `table.cell` at the same 14px but carries neither a pill nor a 상세 보기 button,
           and it measures 44.7px a row — a 19.6px line box. The extra 1.4px here is bought
           by this table's two control cells, so do not carry the 21 to a plain text table.
           Five rows because that is the page size — how many rows exist is what is loading. */
        <div className={pipelineStyles.card.tableWrap} aria-busy>
          <span className="sr-only">불러오는 중</span>
          <table className={table.base}>
            {head}
            <tbody className="[&>tr:last-child>td]:border-b-0" aria-hidden>
              {Array.from({ length: PAGE_SIZE }, (_, index) => (
                <tr key={index}>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[21px] w-[128px]')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-5 w-[62px] rounded-full')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[21px] w-[84px]')} />
                  </td>
                  <td className={cn(table.cell, 'w-24')}>
                    <span className={cn(opsStyles.skeletonBar, 'ml-auto block h-[21px] w-[62px]')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : failed ? (
        <p className={pipelineStyles.empty.base}>승인 요청 내역을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="inbox" message="승인 요청 내역이 없습니다." />
      ) : (
        <div className={pipelineStyles.card.tableWrap}>
          <table className={table.base}>
            {head}
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {rows.map((row, index) => (
                <tr key={`${row.request?.id ?? 'row'}-${index}`}>
                  <td className={cn(table.cell, 'whitespace-nowrap')}>
                    {fmtDateTime(row.request?.requested_at)}
                  </td>
                  <td className={table.cell}>
                    <HistoryStatusPill status={row.result?.status ?? row.request?.status ?? null} />
                  </td>
                  <td className={table.cell}>
                    {row.request?.requested_by?.user_id ?? '-'}
                  </td>
                  <td className={cn(table.cell, 'text-right')}>
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
      </div>

      <OpsPagination page={page} totalPages={totalPages} onChange={(next) => void load(next)} always />

      {/* Keyed per request: the modal stays mounted across opens, and its body now owns
          filter/search/page state, so without this a request opened after another
          inherits the previous one's query — a stale search reads as "결과 없음" on a
          request that has rows. */}
      <ApprovalRequestDetailModal
        key={detail?.request?.id ?? 'none'}
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        item={detail ? toModalItem(detail) : null}
        targetSourceId={targetSourceId}
        isIdc={isIdc}
      />
    </section>
  );
}
