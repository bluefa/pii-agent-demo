'use client';

/**
 * 실행 기록 modal — the RUNS (GET …/test-connection/execution-history), paged,
 * newest first.
 *
 * 사용자 화면 Step 5 와 같은 자리다(TcRunHistoryModal): 지금 상태는 밴드가 말하고,
 * 지난 회차는 밴드의 링크를 눌러 본다. 표 아래 카드 하나를 더 세우면 화면의 마지막
 * 절이 "과거"가 되어, 이 탭에 온 이유(지금 무엇이 실패했나)가 지면에서 가장 멀어진다.
 *
 * 열릴 때마다 마운트되므로 항상 0페이지·새 조회로 시작한다 — 오버레이가 떠 있는 동안
 * 쓰기는 일어나지 않는다. 형제 모달 TcHistoryModal(승인·반려 이력)의 문법 그대로다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTestConnectionExecutionHistory,
  type TcExecutionRow,
} from '@/app/lib/api/task-queue-tc';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { fmtDuration } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { Dash } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TcRunPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import { runDurationSeconds } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const PAGE_SIZE = 5;
const TITLE_ID = 'ops-tc-run-history-title';

export interface TcRunHistoryModalProps {
  targetSourceId: number;
  onClose: () => void;
}

export function TcRunHistoryModal({
  targetSourceId,
  onClose,
}: TcRunHistoryModalProps): ReactElement {
  const [rows, setRows] = useState<TcExecutionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${targetSourceId}:${page}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTestConnectionExecutionHistory(targetSourceId, page, PAGE_SIZE);
        if (cancelled) return;
        setRows(data.content);
        setTotalPages(Math.max(1, data.totalPages));
        setFailed(false);
      } catch {
        if (cancelled) return;
        setRows([]);
        setTotalPages(1);
        setFailed(true);
      }
      if (!cancelled) setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, loadKey]);

  const { appTable } = tqStyles;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        연결 테스트 실행 기록
      </h3>
      <p className={pipelineStyles.modal.desc}>
        회차별로 언제 실행했고 결과가 무엇이었는지의 기록 (최신순)
      </p>

      {loading ? (
        <div className="min-h-[220px]" aria-busy />
      ) : failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>실행 기록을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="flow" message="연결 테스트 실행 기록이 없습니다." className="mt-2" />
      ) : (
        <div className={appTable.wrap}>
          <table className={appTable.root}>
            <thead className={appTable.thead}>
              <tr>
                <th className={cn(appTable.th, 'w-[64px]')}>회차</th>
                <th className={appTable.th}>요청 시각</th>
                <th className={appTable.th}>완료 시각</th>
                <th className={cn(appTable.th, 'w-[90px]')}>소요</th>
                <th className={cn(appTable.th, 'w-[80px]')}>결과</th>
              </tr>
            </thead>
            <tbody className={appTable.body}>
              {rows.map((row, index) => (
                <tr key={`${row.version ?? 'run'}-${index}`}>
                  <td className={cn(appTable.td, '[font-family:var(--pl-font-mono)] text-[14px]')}>
                    {row.version == null ? <Dash /> : `#${row.version}`}
                  </td>
                  <td className={cn(appTable.td, 'whitespace-nowrap text-[14px]')}>
                    {row.requestedAt ? fmtDateTime(row.requestedAt) : <Dash />}
                  </td>
                  <td className={cn(appTable.td, 'whitespace-nowrap text-[14px]')}>
                    {row.completedAt ? fmtDateTime(row.completedAt) : <Dash />}
                  </td>
                  <td className={cn(appTable.td, 'whitespace-nowrap tabular-nums text-[14px]')}>
                    {fmtDuration(runDurationSeconds(row.requestedAt, row.completedAt))}
                  </td>
                  <td className={appTable.td}>
                    <TcRunPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !failed && totalPages > 1 && (
        <PlPagination
          className="mt-4"
          center
          page={page + 1}
          pages={totalPages}
          onPrev={() => setPage((n) => Math.max(0, n - 1))}
          onNext={() => setPage((n) => Math.min(totalPages - 1, n + 1))}
        />
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
