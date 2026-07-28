'use client';

/**
 * 운영 알림 — action-needed Target Sources across all services
 * (design/pipeline/admin-ops.html `renderAlerts()`, restyled to the ops
 * grammar). Stat cards double as filters.
 *
 * The aggregation is the server's (ops assumed §7): it owns the alert taxonomy,
 * the exact counts, the total ordering by elapsed time, and the join against the
 * Test Connection queue. This view fetches one page and renders it — it must NOT
 * re-derive which kinds apply to a row, because the alert population is
 * cross-service and no single page of it is the whole truth.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { getOpsAlerts, type OpsAlertKind, type OpsAlertRow } from '@/app/lib/api/ops';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 20;

/** Elapsed styling thresholds. The 7일 stale *rule* is the server's; these are
 *  only how long a row has to sit before the chip turns warn/err. */
const STALE_SECONDS = 7 * 24 * 3600;
const DAY_SECONDS = 24 * 3600;

type ValueTone = 'warn' | 'err' | 'plain';

interface AlertKindMeta {
  key: OpsAlertKind;
  label: string;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  tone: ValueTone;
}

/** Card order = the order a row's kinds are resolved to one 필요한 작업 label. */
const ALERT_KINDS: readonly AlertKindMeta[] = [
  { key: 'PENDING', label: '승인 대기', need: '연동 대상 승인·반려', tone: 'warn' },
  { key: 'CONFIRMED', label: '설치 작업 필요', need: 'Agent 설치 수행', tone: 'err' },
  { key: 'TC_REJECTED', label: '재실행 요청', need: '재실행 결과 확인', tone: 'err' },
  { key: 'CONNECTED', label: '연결 테스트 검토', need: '완료 승인', tone: 'warn' },
  { key: 'STALE', label: '장기 정체 (7일↑)', need: '원인 확인', tone: 'plain' },
];

/** The Test Connection alerts deep-link straight into that tab. */
const TC_KINDS: readonly OpsAlertKind[] = ['CONNECTED', 'TC_REJECTED'];

const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  warn: 'text-[var(--pl-warn-text)]',
  err: 'text-[var(--pl-err-text)]',
  plain: 'text-[var(--pl-text-strong)]',
};

const statCard = {
  row: 'grid grid-cols-[repeat(5,minmax(0,220px))] gap-3',
  base: 'text-left rounded-[10px] border px-5 py-4 cursor-pointer transition-colors',
  idle: 'bg-[var(--pl-gray-100)] border-[var(--pl-border)] hover:border-[var(--pl-border-strong)]',
  active:
    'bg-[var(--pl-bg-card)] border-[var(--pl-primary)] shadow-[0_0_0_3px_var(--pl-primary-ring)]',
  label: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
  value: 'mt-3 text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums',
  need: 'mt-1 text-[12px] text-[var(--pl-text-weak)]',
} as const;

const elapsedChip = {
  base: 'inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-semibold tabular-nums',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  plain: 'text-[12px] font-medium tabular-nums text-[var(--pl-text-weak)]',
} as const;

/** Seconds since `iso`; unparseable timestamps read as 0. */
const elapsedSeconds = (iso: string, now: number): number => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 1000));
};

/** 'N일 N시간' / 'N시간' / 'N분' (design `delayCell`). */
const elapsedText = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간`;
  return `${Math.floor(seconds / 60)}분`;
};

/**
 * A row can be several kinds at once; the 필요한 작업 column has room for one.
 * Card order decides, so the most actionable kind wins over 장기 정체 — which is
 * a symptom, not a task.
 */
const primaryKind = (row: OpsAlertRow): AlertKindMeta | null =>
  ALERT_KINDS.find((kind) => row.alert_kinds.includes(kind.key)) ?? null;

export function AlertsView(): ReactElement {
  const [counts, setCounts] = useState<Partial<Record<OpsAlertKind, number>>>({});
  const [rows, setRows] = useState<OpsAlertRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  /** Captured with the payload so elapsed values stay consistent across renders. */
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<OpsAlertKind | null>(null);
  const [page, setPage] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Loading is derived from "which load has settled" rather than its own flag,
  // so the effect never calls setState synchronously in its body.
  const loadKey = `${filter ?? ''}:${page}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getOpsAlerts(filter ?? undefined, page, PAGE_SIZE);
        if (cancelled) return;
        setCounts(data.counts);
        setRows(data.alerts.content ?? []);
        setTotalElements(data.alerts.totalElements);
        setTotalPages(Math.max(1, data.alerts.totalPages));
        setNow(Date.now());
        setFailed(false);
      } catch {
        if (cancelled) return;
        setRows([]);
        setTotalElements(0);
        setFailed(true);
      }
      if (!cancelled) setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, page, loadKey]);

  // Switching the filter restarts paging — page 3 of one kind means nothing in another.
  const selectFilter = (kind: OpsAlertKind): void => {
    setFilter((prev) => (prev === kind ? null : kind));
    setPage(0);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className={cn(pipelineStyles.text.pageTitle, 'mb-1.5')}>운영 알림</h1>
          <p className={pipelineStyles.text.sectionDesc}>
            설치 인력·관리자 액션이 필요한 Target Source를 모든 서비스에 걸쳐 모아 봅니다. 연결 테스트
            검토·재실행 요청 건도 여기에 함께 표시합니다.
          </p>
        </div>
        <PlButton variant="secondary" onClick={reload} disabled={loading}>
          새로고침
        </PlButton>
      </div>

      <div className={statCard.row}>
        {ALERT_KINDS.map((kind) => {
          const active = filter === kind.key;
          const value = counts[kind.key] ?? 0;
          return (
            <button
              key={kind.key}
              type="button"
              aria-pressed={active}
              onClick={() => selectFilter(kind.key)}
              className={cn(statCard.base, active ? statCard.active : statCard.idle)}
            >
              <span className={cn(statCard.label, 'block')}>{kind.label}</span>
              <span
                className={cn(
                  statCard.value,
                  'block',
                  value ? VALUE_TONE_CLASS[kind.tone] : VALUE_TONE_CLASS.plain,
                )}
              >
                {value}
              </span>
              <span className={cn(statCard.need, 'block')}>{kind.need}</span>
            </button>
          );
        })}
      </div>

      <section className={cn(pipelineStyles.card.base, 'mt-4')} aria-label="액션 대기 목록">
        <div className="flex items-center gap-2">
          <h2 className={opsStyles.cardTitle}>액션 대기 목록</h2>
          <span className={pipelineStyles.text.meta}>
            {totalElements}건 · 경과 시간 내림차순
          </span>
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
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>해당 조건의 알림이 없습니다.</p>
        ) : (
          <>
            <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
              <table className={opsStyles.table.base}>
                <thead>
                  <tr>
                    <th className={opsStyles.table.headCell}>Target Source</th>
                    <th className={opsStyles.table.headCell}>서비스</th>
                    <th className={opsStyles.table.headCell}>Provider</th>
                    <th className={opsStyles.table.headCell}>현재 단계</th>
                    <th className={opsStyles.table.headCell}>필요한 작업</th>
                    <th className={opsStyles.table.headCell}>경과</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const elapsed = elapsedSeconds(row.last_changed_at, now);
                    const kind = primaryKind(row);
                    const toTc = row.alert_kinds.some((k) => TC_KINDS.includes(k));
                    return (
                      <tr
                        key={row.target_source_id}
                        // `relative` carries the stretched row link below.
                        className={cn(opsStyles.table.rowHover, 'relative cursor-pointer')}
                      >
                        <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                          <Link
                            href={passRoutes.pipelines.ops.targetSource(
                              String(row.target_source_id),
                              toTc ? 'tc' : undefined,
                            )}
                            aria-label={`Target Source ${row.target_source_id} 운영 화면으로 이동`}
                            className="absolute inset-0"
                          />
                          <span className={pipelineStyles.table.mono}>#{row.target_source_id}</span>
                        </td>
                        <td className={opsStyles.table.cell}>
                          <span className="font-medium">{row.service_name}</span>{' '}
                          <span className={pipelineStyles.text.meta}>{row.service_code}</span>
                        </td>
                        <td className={opsStyles.table.cell}>
                          <ProvTag provider={row.cloud_provider} isSdu={row.is_sdu_type} />
                        </td>
                        <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                          <StepPill status={row.process_status} />
                        </td>
                        <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                          {kind && kind.key !== 'STALE' ? (
                            kind.need
                          ) : (
                            <span className={pipelineStyles.text.muted}>
                              장기 정체 상태입니다. 원인을 확인해 주세요.
                            </span>
                          )}
                        </td>
                        <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                          {elapsed >= STALE_SECONDS ? (
                            <span className={cn(elapsedChip.base, elapsedChip.err)}>
                              {elapsedText(elapsed)}
                            </span>
                          ) : elapsed >= DAY_SECONDS ? (
                            <span className={cn(elapsedChip.base, elapsedChip.warn)}>
                              {elapsedText(elapsed)}
                            </span>
                          ) : (
                            <span className={elapsedChip.plain}>{elapsedText(elapsed)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
