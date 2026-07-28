'use client';

/**
 * 운영 알림 — action-needed Target Sources across all services
 * (design/pipeline/admin-ops.html `renderAlerts()`, restyled to the ops
 * grammar). Stat cards double as filters; the list is sorted by elapsed time.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { getOpsTargetSources, type OpsTargetSourceListItem } from '@/app/lib/api/ops';
import type { BffProcessStatus } from '@/app/lib/api';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** Rows older than this are "장기 정체" regardless of status. */
const STALE_SECONDS = 7 * 24 * 3600;
const DAY_SECONDS = 24 * 3600;

/** The alert list is cross-service, so it must be sorted/filtered as a whole.
 *  The endpoint is paged, so page 0 is fetched with a hard cap of 200 rows and
 *  everything below happens client-side (mock/ops scale is far under the cap). */
const FETCH_CAP = 200;

type AlertFilter = BffProcessStatus | 'STALE';
type ValueTone = 'warn' | 'err' | 'plain';

interface AlertKind {
  key: AlertFilter;
  label: string;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  tone: ValueTone;
}

const ALERT_KINDS: readonly AlertKind[] = [
  { key: 'PENDING', label: '승인 대기', need: '연동 대상 승인·반려', tone: 'warn' },
  { key: 'CONFIRMED', label: '설치 작업 필요', need: 'Agent 설치 수행', tone: 'err' },
  { key: 'CONNECTED', label: '연결 테스트 검토', need: '완료 승인', tone: 'warn' },
  { key: 'STALE', label: '장기 정체 (7일↑)', need: '원인 확인', tone: 'plain' },
];

/** The three statuses that always need someone — the default (no filter) view. */
const ACTION_STATUSES: readonly BffProcessStatus[] = ['PENDING', 'CONFIRMED', 'CONNECTED'];

/** 필요한 작업 for a row's status; stale-only rows have no status-bound action. */
const needForStatus = (status: BffProcessStatus): string | null =>
  ALERT_KINDS.find((kind) => kind.key === status)?.need ?? null;

const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  warn: 'text-[var(--pl-warn-text)]',
  err: 'text-[var(--pl-err-text)]',
  plain: 'text-[var(--pl-text-strong)]',
};

const statCard = {
  row: 'grid grid-cols-[repeat(4,minmax(0,260px))] gap-3',
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

/** Seconds since `iso`; unparseable timestamps sort last (0). */
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

export function AlertsView(): ReactElement {
  const [rows, setRows] = useState<OpsTargetSourceListItem[]>([]);
  /** Captured with the payload so elapsed values stay consistent across renders. */
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<AlertFilter | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const page = await getOpsTargetSources(undefined, 0, FETCH_CAP);
        if (cancelled) return;
        setRows(page.content ?? []);
        setNow(Date.now());
      } catch {
        if (cancelled) return;
        setRows([]);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const count = (key: AlertFilter): number =>
    key === 'STALE'
      ? rows.filter((row) => elapsedSeconds(row.last_changed_at, now) >= STALE_SECONDS).length
      : rows.filter((row) => row.process_status === key).length;

  const matches = (row: OpsTargetSourceListItem): boolean => {
    const stale = elapsedSeconds(row.last_changed_at, now) >= STALE_SECONDS;
    if (filter === null) return ACTION_STATUSES.includes(row.process_status) || stale;
    if (filter === 'STALE') return stale;
    return row.process_status === filter;
  };

  const listed = rows
    .filter(matches)
    .map((row) => ({ row, elapsed: elapsedSeconds(row.last_changed_at, now) }))
    .sort((a, b) => b.elapsed - a.elapsed);

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className={cn(pipelineStyles.text.pageTitle, 'mb-1.5')}>운영 알림</h1>
          <p className={pipelineStyles.text.sectionDesc}>
            설치 인력·관리자 액션이 필요한 Target Source를 모든 서비스에 걸쳐 모아 봅니다.
          </p>
        </div>
        <PlButton variant="secondary" onClick={reload} disabled={loading}>
          새로고침
        </PlButton>
      </div>

      <div className={statCard.row}>
        {ALERT_KINDS.map((kind) => {
          const active = filter === kind.key;
          const value = count(kind.key);
          return (
            <button
              key={kind.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? null : kind.key)}
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
            {listed.length}건 · 경과 시간 내림차순
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
        ) : listed.length === 0 ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>해당 조건의 알림이 없습니다.</p>
        ) : (
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
                {listed.map(({ row, elapsed }) => (
                  <tr
                    key={row.target_source_id}
                    // `relative` carries the stretched row link below.
                    className={cn(opsStyles.table.rowHover, 'relative cursor-pointer')}
                  >
                    <td className={cn(opsStyles.table.cell, 'whitespace-nowrap')}>
                      <Link
                        href={passRoutes.pipelines.ops.targetSource(String(row.target_source_id))}
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
                      {needForStatus(row.process_status) ?? (
                        <span className={pipelineStyles.text.muted}>장기 정체 상태입니다. 원인을 확인해 주세요.</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
