'use client';

/**
 * Test Connection 실행 card — 지금 상태 · 직접 실행 · 수행 기록.
 *
 * The two "이력" here are different things and are deliberately kept apart:
 *  - 수행 기록 (inline table)  = the RUNS (GET …/test-connection/execution-history)
 *  - 처리 이력 (modal)          = who confirmed / who asked for a re-run
 *                               (GET …/test-connection/history)
 *
 * 연동 승인 / 재실행 요청 do NOT live here — they are the operator's decision on the
 * result and belong next to the result table (TcDecisionCard).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useApiAction } from '@/app/hooks/useApiMutation';
import {
  getTestConnectionExecutionHistory,
  type TcExecutionRow,
  type TcExecutionStatus,
} from '@/app/lib/api/task-queue-tc';
import { triggerTestConnection } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  TC_TONE_FILL,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

const PAGE_SIZE = 5;
const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

const RUN_META: Record<TcExecutionStatus, { tone: TcTone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  FAIL: { tone: 'err', label: '실패' },
  RUNNING: { tone: 'warn', label: '진행 중' },
  PENDING: { tone: 'warn', label: '대기' },
  UNKNOWN: { tone: 'off', label: 'Unknown' },
};

export interface TcRunCardProps {
  targetSourceId: number;
  /** Header status row — `null` when the target has no TC status yet. */
  status: TestConnectionStatusRow | null;
  /** Bumped by the tab after any write anywhere in the tab. */
  reloadKey: number;
  onReload: () => void;
  onOpenHistory: () => void;
}

export function TcRunCard({
  targetSourceId,
  status,
  reloadKey,
  onReload,
  onOpenHistory,
}: TcRunCardProps): ReactElement {
  const toast = usePlToast();
  const { text } = pipelineStyles;

  const [rows, setRows] = useState<TcExecutionRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${targetSourceId}:${reloadKey}:${page}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTestConnectionExecutionHistory(targetSourceId, page, PAGE_SIZE);
        if (cancelled) return;
        setRows(data.content);
        setTotalPages(data.totalPages);
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

  // Direct run (POST …/test-connection/async) — the server owns eligibility
  // (409 while running / 4xx before install), so the button just reports.
  const runTc = useApiAction(() => triggerTestConnection(targetSourceId), {
    onSuccess: () => {
      toast.show('연결 테스트 실행을 요청했습니다.');
      setPage(0);
      onReload();
    },
    onError: () => toast.show('연결 테스트 실행 요청에 실패했습니다.'),
  });

  const isCompleted = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;
  const desc = isCompleted
    ? `서비스가 완료를 확인했습니다 · ${fmtDateTime(status?.completedAt)}`
    : isRejected
      ? `재실행을 요청한 상태입니다 · ${fmtDateTime(status?.rejectedAt)}`
      : '서비스의 Test Connection 완료 확인을 기다리는 중입니다.';

  return (
    <section className={pipelineStyles.card.base} aria-label="Test Connection 실행">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={opsStyles.cardTitle}>Test Connection</h2>
            {isCompleted ? (
              <TcPill tone="ok" label="완료 확인됨" />
            ) : isRejected ? (
              <TcPill tone="warn" label="재실행 요청됨" />
            ) : (
              status?.status != null && <TcPill tone="off" label={status.status} />
            )}
          </div>
          <p className={opsStyles.cardDesc}>{desc}</p>
        </div>
        <div className="flex flex-none gap-2">
          <PlButton
            variant="secondary"
            onClick={() => void runTc.execute()}
            disabled={runTc.loading}
          >
            연결 테스트 실행
          </PlButton>
          <PlButton variant="secondary" onClick={onOpenHistory}>
            처리 이력
          </PlButton>
        </div>
      </div>

      {isRejected && status?.rejectReason && (
        <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
          <div className="text-[12px] font-semibold text-[var(--pl-text-weak)]">재실행 요청 사유</div>
          <p className={cn(text.body, 'mt-1')}>{status.rejectReason}</p>
        </div>
      )}

      <h3 className={cn(text.subsectionTitle, 'mt-5')}>수행 기록</h3>
      {loading ? (
        <div className="min-h-[160px]" aria-busy />
      ) : failed ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>수행 기록을 불러오지 못했습니다.</p>
          <PlButton variant="secondary" size="sm" className="mt-3" onClick={onReload}>
            다시 시도
          </PlButton>
        </div>
      ) : rows.length === 0 ? (
        <p className={cn(text.meta, 'mt-3')}>Test Connection 실행 기록이 없습니다.</p>
      ) : (
        <>
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={opsStyles.table.base}>
              <thead>
                <tr>
                  <th className={cn(opsStyles.table.headCell, 'w-[80px]')}>회차</th>
                  <th className={cn(opsStyles.table.headCell, 'w-[170px]')}>요청 시각</th>
                  <th className={cn(opsStyles.table.headCell, 'w-[170px]')}>완료 시각</th>
                  <th className={opsStyles.table.headCell}>결과</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {rows.map((row, index) => {
                  const meta = RUN_META[row.status];
                  return (
                    <tr key={`${row.version ?? 'run'}-${index}`} className={opsStyles.table.rowHover}>
                      <td className={cn(opsStyles.table.cell, 'tabular-nums')}>
                        {row.version == null ? <Dash /> : `#${row.version}`}
                      </td>
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        {row.requestedAt ? fmtDateTime(row.requestedAt) : <Dash />}
                      </td>
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        {row.completedAt ? fmtDateTime(row.completedAt) : <Dash />}
                      </td>
                      <td className={opsStyles.table.cell}>
                        <span className={cn(opsStyles.statusTag, TC_TONE_FILL[meta.tone])}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <PlPagination
              className="mt-4"
              center
              page={page + 1}
              pages={totalPages}
              onPrev={() => setPage((n) => Math.max(0, n - 1))}
              onNext={() => setPage((n) => Math.min(totalPages - 1, n + 1))}
            />
          )}
        </>
      )}
    </section>
  );
}
