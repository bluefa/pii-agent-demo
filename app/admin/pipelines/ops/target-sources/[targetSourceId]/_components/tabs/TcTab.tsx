'use client';

/**
 * Test Connection 탭 (design/pipeline/ops-target-source-tabs.html `tabTc()`) — the
 * Task Queue P5 결과 view condensed into one ops card: status head + 요약, the
 * per-resource 결과 table (논리 DB drill-down), and the 재실행 요청 / 연동 승인 actions.
 *
 * The status row and the result rows load independently and best-effort: a failed
 * results fetch still renders the status head (and its 반려 사유), and a missing
 * status row still renders whatever results exist. Both empty → 실행 이력 없음.
 *
 * Contract honesty: `database_type` / `connection_target` / `connection_status`
 * are passthrough fields outside the declared latest-results schema, so an absent
 * value renders — / Unknown and is never promoted to a success.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import {
  getTestConnectionDetail,
  getTestConnectionResults,
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
  rejectTestConnection,
  confirmInstallation,
  type TcResultRow,
} from '@/app/lib/api/task-queue-tc';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { LdbModal } from '@/app/admin/pipelines/queue/test-connections/_tc/LdbModal';
import {
  TcRerunModal,
  TcApproveModal,
} from '@/app/admin/pipelines/queue/test-connections/_tc/TcActionModals';
import {
  tcResultStats,
  putLdbCache,
  type LdbCache,
  type LdbTab,
} from '@/app/admin/pipelines/queue/test-connections/_tc/logic';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const COMPLETED = 'TEST_CONNECTION_COMPLETED';
const REJECTED = 'TEST_CONNECTION_REJECTED';

type PillTone = 'ok' | 'warn' | 'err' | 'off';

const PILL_TONE: Record<PillTone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-weak)]',
};

const PILL_DOT: Record<PillTone, string> = {
  ok: 'bg-[var(--pl-ok)]',
  warn: 'bg-[var(--pl-warn)]',
  err: 'bg-[var(--pl-err)]',
  off: 'bg-[var(--pl-off)]',
};

function TcPill({ tone, label }: { tone: PillTone; label: string }): ReactElement {
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, PILL_TONE[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', PILL_DOT[tone])} />
      {label}
    </span>
  );
}

/** Connection Status cell — only an explicit wire value claims Success/Failed. */
function ConnPill({ status }: { status: TcResultRow['connectionStatus'] }): ReactElement {
  if (status === 'SUCCESS') return <TcPill tone="ok" label="Success" />;
  if (status === 'FAILED') return <TcPill tone="err" label="Failed" />;
  return <TcPill tone="off" label="Unknown" />;
}

const Dash = (): ReactElement => <span className="text-[var(--pl-text-faint)]">—</span>;

/** Contract-declared count: absent → —, 0 → plain, >0 → 논리 DB modal link. */
function CountCell({ count, onOpen }: { count: number | null; onOpen: () => void }): ReactElement {
  if (count == null) return <Dash />;
  if (count === 0) return <span className="text-[var(--pl-text-weak)]">0개</span>;
  return (
    <button type="button" className={tqStyles.appTable.ldbLink} onClick={onOpen}>
      {count}개
    </button>
  );
}

interface LdbTarget {
  resourceId: string;
  databaseType: string | null;
  targetLabel: string;
  tab: LdbTab;
}

export interface TcTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function TcTab({ targetSourceId, detail }: TcTabProps): ReactElement {
  const toast = usePlToast();
  const { text } = pipelineStyles;

  const [status, setStatus] = useState<TestConnectionStatusRow | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [results, setResults] = useState<TcResultRow[]>([]);
  const [resultsFailed, setResultsFailed] = useState(false);

  const [ldbCache, setLdbCache] = useState<LdbCache>({});
  const [ldbTarget, setLdbTarget] = useState<LdbTarget | null>(null);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => {
    setLdbCache({});
    setReloadKey((key) => key + 1);
  }, []);

  // Loading is derived from "which load has settled" rather than its own flag, so
  // the effect never calls setState synchronously in its body.
  const loadKey = `${targetSourceId}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statusRow, resultRows] = await Promise.allSettled([
        getTestConnectionDetail(targetSourceId),
        getTestConnectionResults(targetSourceId),
      ]);
      if (cancelled) return;
      setStatus(statusRow.status === 'fulfilled' ? statusRow.value : null);
      setStatusFailed(statusRow.status === 'rejected');
      setResults(resultRows.status === 'fulfilled' ? resultRows.value : []);
      setResultsFailed(resultRows.status === 'rejected');
      setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, loadKey]);

  const ldbKey = useCallback(
    (resourceId: string) => `${targetSourceId}:${resourceId}`,
    [targetSourceId],
  );

  // Lazy per-resource load. A failure caches an `error` entry (NOT empty arrays)
  // so the modal shows a retry affordance instead of a false "논리 DB 없음".
  const loadLdb = useCallback(
    (resourceId: string) => {
      void Promise.all([
        getTestedLogicalDatabases(targetSourceId, resourceId),
        getExcludedLogicalDatabases(targetSourceId, resourceId),
      ])
        .then(([included, excluded]) => {
          setLdbCache((prev) => putLdbCache(prev, ldbKey(resourceId), { included, excluded }));
        })
        .catch(() => {
          setLdbCache((prev) =>
            putLdbCache(prev, ldbKey(resourceId), { included: [], excluded: [], error: true }),
          );
        });
    },
    [targetSourceId, ldbKey],
  );

  const openLdb = useCallback(
    (row: TcResultRow, tab: LdbTab) => {
      setLdbTarget({
        resourceId: row.resourceId,
        databaseType: row.databaseType,
        targetLabel: row.connectionTarget || row.resourceId,
        tab,
      });
      // Skip the fetch only when a successful entry is cached; a prior error retries.
      const cached = ldbCache[ldbKey(row.resourceId)];
      if (cached && !cached.error) return;
      loadLdb(row.resourceId);
    },
    [ldbCache, ldbKey, loadLdb],
  );

  const retryLdb = useCallback(
    (resourceId: string) => {
      setLdbCache((prev) => {
        const next = { ...prev };
        delete next[ldbKey(resourceId)];
        return next;
      });
      loadLdb(resourceId);
    },
    [ldbKey, loadLdb],
  );

  // On failure the modal stays open and the error surfaces via the section toast.
  const rerun = useApiMutation((reason: string) => rejectTestConnection(targetSourceId, reason), {
    onSuccess: () => {
      setRerunOpen(false);
      toast.show('재실행을 요청했습니다.');
      retry();
    },
    onError: () => toast.show('재실행 요청에 실패했습니다.'),
  });

  const approve = useApiAction(() => confirmInstallation(targetSourceId), {
    onSuccess: () => {
      setApproveOpen(false);
      toast.show('연동을 승인했습니다.');
      retry();
    },
    onError: () => toast.show('연동 승인에 실패했습니다.'),
  });

  const stats = tcResultStats(results);
  const isCompleted = status?.status === COMPLETED;
  const isRejected = status?.status === REJECTED;
  const hasStatus = status?.status != null;

  if (loading) {
    return (
      <section className={pipelineStyles.card.base} aria-label="Test Connection 결과">
        <h2 className={opsStyles.cardTitle}>Test Connection 결과</h2>
        <div className="min-h-[200px]" aria-busy />
      </section>
    );
  }

  if (!hasStatus && results.length === 0) {
    return (
      <section className={pipelineStyles.card.base} aria-label="Test Connection 결과">
        <h2 className={opsStyles.cardTitle}>Test Connection 결과</h2>
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>Test Connection 실행 이력이 없습니다.</p>
          <p className={cn(pipelineStyles.empty.meta, 'mt-1')}>
            Agent 설치 완료 이후 실행할 수 있습니다.
          </p>
          {(statusFailed || resultsFailed) && (
            <PlButton variant="secondary" size="sm" className="mt-3" onClick={retry}>
              다시 시도
            </PlButton>
          )}
        </div>
      </section>
    );
  }

  const summary = `연동 대상 논리 DB ${stats.includedTotal}개 · 제외 논리 DB ${stats.excludedTotal}개`;
  const desc = isRejected
    ? `반려 일자 ${fmtDateTime(status?.rejectedAt)} · 서비스에 재실행을 요청한 상태예요`
    : isCompleted
      ? `완료 일자 ${fmtDateTime(status?.completedAt)} · ${summary}`
      : summary;

  return (
    <section className={pipelineStyles.card.base} aria-label="Test Connection 결과">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={opsStyles.cardTitle}>Test Connection 결과</h2>
            {isCompleted ? (
              <TcPill tone="ok" label="완료" />
            ) : isRejected ? (
              <TcPill tone="warn" label="재실행 요청됨" />
            ) : (
              hasStatus && <TcPill tone="off" label={status?.status ?? ''} />
            )}
          </div>
          <p className={opsStyles.cardDesc}>{desc}</p>
        </div>
        {isCompleted && (
          <div className="flex flex-none gap-2">
            <PlButton variant="danger" onClick={() => setRerunOpen(true)}>
              재실행 요청
            </PlButton>
            <PlButton variant="primary" onClick={() => setApproveOpen(true)}>
              연동 승인
            </PlButton>
          </div>
        )}
      </div>

      {isRejected && status?.rejectReason && (
        <div className="mt-4 rounded-lg bg-[var(--pl-gray-50)] px-3.5 py-3">
          <div className="text-[12px] font-semibold text-[var(--pl-text-weak)]">재실행 요청 사유</div>
          <p className={cn(text.body, 'mt-1')}>{status.rejectReason}</p>
        </div>
      )}

      {resultsFailed ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>Test Connection 결과를 불러오지 못했습니다.</p>
          <PlButton variant="secondary" size="sm" className="mt-3" onClick={retry}>
            다시 시도
          </PlButton>
        </div>
      ) : results.length === 0 ? (
        <p className={cn(text.meta, 'mt-4')}>리소스별 결과가 아직 없습니다.</p>
      ) : (
        <>
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-4')}>
            <table className={opsStyles.table.base}>
              <thead>
                <tr>
                  <th className={opsStyles.table.headCell}>Database Type</th>
                  <th className={opsStyles.table.headCell}>Resource ID</th>
                  <th className={opsStyles.table.headCell}>연동 대상</th>
                  <th className={opsStyles.table.headCell}>연동 대상 논리 DB</th>
                  <th className={opsStyles.table.headCell}>연동 제외 논리 DB</th>
                  <th className={opsStyles.table.headCell}>Connection Status</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {results.map((row, index) => (
                  <tr key={`${row.resourceId}-${index}`} className={opsStyles.table.rowHover}>
                    <td className={opsStyles.table.cell}>
                      {row.databaseType ? (
                        <span className={cn(tqStyles.tag.base, tqStyles.tag.blue)}>
                          {row.databaseType}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={cn(opsStyles.table.cell, text.mono)}>{row.resourceId || '—'}</td>
                    <td className={opsStyles.table.cell}>
                      {row.connectionTarget ? (
                        <span className={tqStyles.appTable.tdMono}>{row.connectionTarget}</span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={cn(opsStyles.table.cell, 'tabular-nums')}>
                      <CountCell count={row.includedCount} onOpen={() => openLdb(row, 'inc')} />
                    </td>
                    <td className={cn(opsStyles.table.cell, 'tabular-nums')}>
                      <CountCell count={row.excludedCount} onOpen={() => openLdb(row, 'exc')} />
                    </td>
                    <td className={opsStyles.table.cell}>
                      <ConnPill status={row.connectionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn(text.meta, 'mt-3.5')}>
            Database Type · 연동 대상 · Connection Status는 계약 밖 passthrough 필드입니다 — 값이 없으면
            — / Unknown으로 표기하며, 임의로 성공 처리하지 않습니다.
          </p>
        </>
      )}

      {ldbTarget && (
        <LdbModal
          key={`${ldbTarget.resourceId}:${ldbTarget.tab}`}
          open
          onClose={() => setLdbTarget(null)}
          targetSourceId={targetSourceId}
          databaseType={ldbTarget.databaseType}
          targetLabel={ldbTarget.targetLabel}
          defaultTab={ldbTarget.tab}
          entry={ldbCache[ldbKey(ldbTarget.resourceId)]}
          onRetry={() => retryLdb(ldbTarget.resourceId)}
        />
      )}

      <TcRerunModal
        key={rerunOpen ? 'rerun-open' : 'rerun-closed'}
        open={rerunOpen}
        onClose={() => setRerunOpen(false)}
        targetSourceId={targetSourceId}
        onSubmit={(reason) => void rerun.mutate(reason)}
        submitting={rerun.loading}
      />

      <TcApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        targetSourceId={targetSourceId}
        serviceName={detail.service_name ?? '이 서비스'}
        stats={stats}
        onSubmit={() => void approve.execute()}
        submitting={approve.loading}
      />
    </section>
  );
}
