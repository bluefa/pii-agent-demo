'use client';

/**
 * 운영 알림 — the Target Sources across all services that are waiting on an
 * operator action, in the four buckets the BFF aggregates
 * (`GET /dashboard/summary` counts + `GET /dashboard/target-sources/{kind}`).
 *
 * The bucketing is the server's: it owns which targets land in which bucket and
 * the exact counts. This view renders one card per bucket and drills into the
 * selected one — it must NOT re-derive membership from a row's status, because
 * the population is cross-service and one page of it is not the whole truth.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { formatDateTime } from '@/lib/utils/date';
import { getAlertTargetSources, getDashboardSummary } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, DashboardSummary, RequestListRow } from '@/lib/types/task-queue';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { ConfirmStatusPill } from '@/app/admin/pipelines/queue/requests/_components/ConfirmStatusPill';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 20;

type AlertCounts = Pick<
  DashboardSummary,
  'confirmingCount' | 'needInstallCount' | 'needTestConnectionCount' | 'needPiiAgentConfirmCount'
>;

interface AlertCardMeta {
  kind: AlertTargetKind;
  label: string;
  /** Step number as stated by the contract; `confirming` has none. */
  step: string | null;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  count: (counts: AlertCounts) => number;
}

const ALERT_CARDS: readonly AlertCardMeta[] = [
  {
    kind: 'confirming',
    label: '리소스 확정 진행 중',
    step: null,
    need: '확정 완료 여부 확인',
    count: (s) => s.confirmingCount,
  },
  {
    kind: 'need-install',
    label: '설치 필요',
    step: 'Step 4',
    need: 'Agent 설치 수행',
    count: (s) => s.needInstallCount,
  },
  {
    kind: 'need-test-connection',
    label: '연결 테스트 필요',
    step: 'Step 5',
    need: '연결 테스트 실행',
    count: (s) => s.needTestConnectionCount,
  },
  {
    kind: 'need-pii-agent-confirm',
    label: 'PII Agent 확인 필요',
    step: 'Step 6',
    need: '완료 승인',
    count: (s) => s.needPiiAgentConfirmCount,
  },
];

const statCard = {
  row: 'grid grid-cols-4 gap-3 mt-4',
  base: 'text-left rounded-[10px] border px-5 py-4 cursor-pointer transition-colors',
  idle: 'bg-[var(--pl-gray-100)] border-[var(--pl-border)] hover:border-[var(--pl-border-strong)]',
  active:
    'bg-[var(--pl-bg-card)] border-[var(--pl-primary)] shadow-[0_0_0_3px_var(--pl-primary-ring)]',
  step: 'inline-flex items-center rounded-md border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--pl-text-weak)]',
  label: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
  value: 'mt-3 text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums',
  need: 'mt-1 text-[12px] text-[var(--pl-text-weak)]',
} as const;

const EMPTY_SUMMARY_COUNTS: AlertCounts = {
  confirmingCount: 0,
  needInstallCount: 0,
  needTestConnectionCount: 0,
  needPiiAgentConfirmCount: 0,
};

export function AlertsView(): ReactElement {
  const [counts, setCounts] = useState(EMPTY_SUMMARY_COUNTS);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestListRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<AlertTargetKind>(ALERT_CARDS[0].kind);
  const [page, setPage] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Loading is derived from "which load has settled" rather than its own flag,
  // so the effect never calls setState synchronously in its body.
  const loadKey = `${kind}:${page}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [summary, list] = await Promise.all([
          getDashboardSummary({ signal: controller.signal }),
          getAlertTargetSources(kind, page, PAGE_SIZE, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setCounts(summary);
        setEvaluatedAt(summary.evaluatedAt);
        setRows(list.content);
        setTotalElements(list.totalElements);
        setTotalPages(Math.max(1, list.totalPages));
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalElements(0);
        setFailed(true);
      }
      if (!controller.signal.aborted) setLoadedKey(loadKey);
    })();
    return () => controller.abort();
  }, [kind, page, loadKey]);

  // Switching buckets restarts paging — page 3 of one bucket means nothing in another.
  const selectKind = (next: AlertTargetKind): void => {
    setKind(next);
    setPage(0);
  };

  const selected = ALERT_CARDS.find((card) => card.kind === kind) ?? ALERT_CARDS[0];

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <h1 className={pipelineStyles.text.pageTitle}>운영 알림</h1>
        <PlButton variant="secondary" onClick={reload} disabled={loading}>
          새로고침
        </PlButton>
      </div>

      <section className={pipelineStyles.card.base} aria-label="운영 알림 안내">
        <h2 className={opsStyles.cardTitle}>조치가 필요한 Target Source</h2>
        <p className={cn(pipelineStyles.text.sectionDesc, 'mt-1.5')}>
          설치 인력·관리자의 액션을 기다리는 Target Source를 모든 서비스에 걸쳐 단계별로 모아 봅니다.
          아래 카드를 선택하면 해당 단계의 대상 목록이 표시되고, 각 행에서 Target Source 운영 화면으로
          이동할 수 있습니다.
        </p>
        {evaluatedAt && (
          <p className={cn(pipelineStyles.text.meta, 'mt-2')}>
            집계 시각 {formatDateTime(evaluatedAt)}
          </p>
        )}

        <div className={statCard.row}>
          {ALERT_CARDS.map((card) => {
            const active = card.kind === kind;
            const value = card.count(counts) ?? 0;
            return (
              <button
                key={card.kind}
                type="button"
                aria-pressed={active}
                onClick={() => selectKind(card.kind)}
                className={cn(statCard.base, active ? statCard.active : statCard.idle)}
              >
                <span className="flex items-center gap-1.5">
                  {card.step && <span className={statCard.step}>{card.step}</span>}
                  <span className={statCard.label}>{card.label}</span>
                </span>
                <span
                  className={cn(
                    statCard.value,
                    'block',
                    value
                      ? 'text-[var(--pl-warn-text)]'
                      : 'text-[var(--pl-text-strong)]',
                  )}
                >
                  {value}
                </span>
                <span className={cn(statCard.need, 'block')}>{card.need}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className={cn(pipelineStyles.card.base, 'mt-4')}
        aria-label={`${selected.label} 대상 목록`}
      >
        <div className="flex items-center gap-2">
          <h2 className={opsStyles.cardTitle}>{selected.label}</h2>
          <span className={pipelineStyles.text.meta}>{totalElements}건</span>
        </div>

        {failed ? (
          <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
            <p>운영 알림 목록을 불러오지 못했습니다.</p>
            <PlButton variant="secondary" className="mt-3" onClick={reload}>
              다시 시도
            </PlButton>
          </div>
        ) : loading ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
        ) : rows.length === 0 ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>해당 단계의 대상이 없습니다.</p>
        ) : (
          <>
            <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
              <table className={opsStyles.table.base}>
                <thead>
                  <tr>
                    <th className={opsStyles.table.headCell}>Target Source</th>
                    <th className={opsStyles.table.headCell}>서비스</th>
                    <th className={opsStyles.table.headCell}>Provider</th>
                    <th className={opsStyles.table.headCell}>연동 상태</th>
                    <th className={opsStyles.table.headCell}>필요한 작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.targetSourceId}
                      // `relative` carries the stretched row link below.
                      className={cn(opsStyles.table.rowHover, 'relative cursor-pointer')}
                    >
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        <Link
                          href={passRoutes.pipelines.ops.targetSource(
                            String(row.targetSourceId),
                          )}
                          aria-label={`Target Source ${row.targetSourceId} 운영 화면으로 이동`}
                          className="absolute inset-0"
                        />
                        <span className={pipelineStyles.table.mono}>#{row.targetSourceId}</span>
                      </td>
                      <td className={opsStyles.table.cell}>
                        <span className="font-medium">{row.serviceName}</span>{' '}
                        <span className={pipelineStyles.text.meta}>{row.serviceCode}</span>
                      </td>
                      <td className={opsStyles.table.cell}>
                        <ProvTag provider={row.cloudProvider ?? 'UNKNOWN'} />
                      </td>
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        <ConfirmStatusPill status={row.confirmStatus} />
                      </td>
                      <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                        {selected.need}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
