'use client';

/**
 * P6 연동 시점 (`/admin/pipelines/queue/integration-timeline`) — one question, one table:
 * when was a TargetSource made, and when did it first finish integrating.
 *
 * Every filter is a QUERY. axis / 기간 / sort / page all go to the server
 * and come back as a page of rows; nothing is narrowed or re-sorted here. That is what
 * makes the 건수 in the footer and the CSV the same set of rows as the table.
 *
 * What this screen deliberately does NOT have (owner, 2026-09-14): summary tiles, median /
 * average / percentile, an "elapsed so far" column, a CSP filter, bars inside cells. The
 * statistics belong to whatever tool receives the CSV — this screen cuts the period and
 * shows the rows.
 */
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';

import { cn, segmentedControlStyles, tableStyles, tagStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import {
  downloadIntegrationTimelineCsv,
  getIntegrationTimeline,
} from '@/app/lib/api/task-queue-timeline';
import {
  timelineSortParam,
  type IntegrationTimelineRow,
  type Paged,
  type TimelineAxis,
  type TimelineSort,
  type TimelineSortProp,
} from '@/lib/types/task-queue';
import {
  DateRangePicker,
  QUICK_SPANS,
  defaultRange,
  presetRange,
  quickSpanOf,
} from '@/app/admin/pipelines/queue/integration-timeline/_components/DateRangePicker';
import {
  EMPTY_CELL,
  formatLeadTime,
  formatWireDay,
} from '@/app/admin/pipelines/queue/integration-timeline/_format';

const PAGE_SIZE = 20;

const AXIS_OPTIONS: ReadonlyArray<{ value: TimelineAxis; label: string }> = [
  { value: 'CREATED', label: '연동 시작 날짜' },
  { value: 'FIRST_INSTALLED', label: '최초 연동 완료확인 날짜' },
];

interface SortableColumn {
  label: string;
  prop: TimelineSortProp;
}

const SORTABLE: Record<string, SortableColumn> = {
  id: { label: 'ID', prop: 'targetSourceId' },
  created: { label: '연동 시작 날짜', prop: 'createdAt' },
  installed: { label: '최초 연동 완료확인 날짜', prop: 'piiAgentFirstInstalledAt' },
};

const ts = {
  /**
   * Ground — full-bleed --pl-gray-200, the same escape hatch the sibling 연동 요청 page
   * (RequestsView.rq.page) and the ops detail (opsStyles.page) use: negative margins
   * cancel the shell padding, `body` re-applies it. White cards read as cards on it;
   * on --pl-bg-page they barely separated from the ground (owner, 2026-09-15).
   */
  page: '-mx-8 -mt-6 -mb-12 flex min-h-[calc(100vh_-_64px)] flex-col bg-[var(--pl-gray-200)]',
  body: 'px-8 pt-6 pb-12',
  head: 'flex flex-wrap items-end justify-between gap-4',
  title: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  // One line by the owner's call (2026-09-15): no measure cap, no wrapping. The header
  // row is flex-wrap, so on a narrow canvas the CSV button drops below instead.
  // medium, not weak: this line stands on the gray-200 ground, where weak is 4.01:1.
  lede: 'mt-1.5 whitespace-nowrap text-[14px] leading-[1.5] text-[var(--pl-text-medium)]',
  /**
   * The confirm-tab card (ConfirmTab.tsx): 12px radius, strong border, shadow-sm. No
   * `overflow-hidden` — the 기간 popover opens from inside the band and must not be
   * clipped; the band rounds its own top corners instead.
   */
  card:
    'mt-5 rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  /**
   * The table's toolbar (benchmark 2, 시안 3, owner 2026-09-15): the filters live on the
   * table they cut, in the gray-100 band the resource tables already use
   * (ResourceFilterBar). Order: 기준 · 기간 · what is being shown · (right) CSV.
   */
  band:
    'flex flex-wrap items-center gap-4 rounded-t-[11px] border-b border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-4 py-[14px]',
  /** Quick spans and the calendar field share one border: the date IS the pressed span. */
  compound:
    'inline-flex h-8 items-stretch rounded-[var(--pl-r-ctl)] border border-[var(--pl-border)] bg-[var(--pl-bg-card)]',
  compoundSeg:
    'inline-flex items-center gap-0.5 rounded-l-[7px] border-r border-[var(--pl-border)] bg-[var(--pl-gray-50)] p-0.5',
  // medium, not weak: this line stands on the gray-100 band.
  caption: 'text-[14px] leading-[1.4] tabular-nums text-[var(--pl-text-medium)]',
  captionSkeleton: 'inline-block h-3.5 w-8 animate-pulse rounded-[6px] bg-[var(--pl-gray-200)] align-middle',
  bandEnd: 'ml-auto flex items-center gap-2',
  tableWrap: 'overflow-x-auto',
  table: 'w-full border-collapse',
  sortButton: 'inline-flex items-center gap-1',
  sortMark: 'text-[var(--pl-primary)]',
  cellMono: 'tabular-nums [font-family:var(--pl-font-mono)]',
  cellNumeric: 'text-right',
  dim: 'text-[var(--pl-text-faint)]',
  link: 'font-medium text-[var(--pl-primary)] hover:underline',
  tag: 'inline-flex h-[22px] items-center rounded-[var(--pl-r-badge)] px-2 text-[12px] font-medium',
  state: 'px-[18px] py-9 text-center text-[14px] text-[var(--pl-text-weak)]',
  foot: 'flex items-center justify-between gap-3 px-3.5 py-2.5',
  footCount: 'text-[12px] tabular-nums text-[var(--pl-text-weak)]',
  footPager: 'mt-0',
  skeleton: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
} as const;

const COLUMN_COUNT = 7;

export function IntegrationTimelineView(): ReactElement {
  // The window is seeded once, from the day the screen opened — re-deriving it per render
  // would hand `useAbortableEffect` a new `to` at midnight and re-query underneath a
  // reader.
  const [range, setRange] = useState(() => defaultRange(new Date()));
  const [axis, setAxis] = useState<TimelineAxis>('CREATED');
  const [sort, setSort] = useState<TimelineSort>({ prop: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(0);

  const [paged, setPaged] = useState<Paged<IntegrationTimelineRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const compoundRef = useRef<HTMLDivElement>(null);

  const sortParam = timelineSortParam(sort);
  const query = useMemo(
    () => ({ axis, from: range.from, to: range.to, sort: sortParam }),
    [axis, range.from, range.to, sortParam],
  );

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return getIntegrationTimeline({ ...query, page, size: PAGE_SIZE }, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setPaged(result);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (signal.aborted) return;
          setError(cause);
          setLoading(false);
        });
    },
    [query, page],
  );

  // Any change to WHICH rows are asked for starts at the first page — page 3 of the old
  // filter is not page 3 of the new one.
  const refilter = useCallback((apply: () => void) => {
    apply();
    setPage(0);
  }, []);

  const toggleSort = (prop: TimelineSortProp): void => {
    refilter(() =>
      setSort((current) => ({
        prop,
        dir: current.prop === prop && current.dir === 'desc' ? 'asc' : 'desc',
      })),
    );
  };

  const onCsv = (): void => {
    setCsvError(null);
    downloadIntegrationTimelineCsv(query)
      .then((blob) => saveCsv(blob, `integration-timeline_${range.from}_${range.to}.csv`))
      .catch(() => setCsvError('CSV를 내려받지 못했습니다.'));
  };

  const rows = paged?.content ?? [];
  const pages = Math.max(1, paged?.totalPages ?? 1);

  return (
    <div className={ts.page}>
    <div className={ts.body}>
      <PlBreadcrumb crumbs={[{ label: 'Task Queue' }, { label: '연동 시점' }]} />
      <header className={ts.head}>
        <div>
          <h1 className={ts.title}>TargetSource 연동 시작 날짜와 최초 연동 완료확인 날짜</h1>
          <p className={ts.lede}>
            TargetSource 가 언제 연동을 시작했고 언제 최초 연동 완료가 확인됐는지 기간으로 잘라 봅니다.
            최초 연동 완료확인 날짜는 초기화로 단계가 되돌아가도 바뀌지 않습니다.
          </p>
        </div>
      </header>

      <section className={ts.card}>
        <div className={ts.band} aria-label="조회 조건">
          {/* No 기준/기간 labels: the axis segment repeats the column names it switches
              between, and the 기간 compound carries its own dates. */}
          <Segment
            ariaLabel="기간 기준"
            options={AXIS_OPTIONS}
            value={axis}
            onChange={(next) => refilter(() => setAxis(next))}
          />
          {/* One click for the windows people actually ask for; the calendar is for
              everything else. Both write the same applied range. A calendar range lights
              직접 선택 instead of a span, so the compound always says which kind of window
              it holds — and the dates beside it are the truth either way. */}
          <div className={ts.compound} ref={compoundRef}>
            <QuickSpans
              value={quickSpanOf(range, new Date())}
              onChange={(span) => refilter(() => setRange(presetRange(span, new Date())))}
              onCustom={() =>
                compoundRef.current
                  ?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
                  ?.click()
              }
            />
            <DateRangePicker
              attached
              from={range.from}
              to={range.to}
              onApply={(next) => refilter(() => setRange(next))}
            />
          </div>
          <span className={ts.caption} aria-live="polite">
            {AXIS_OPTIONS.find((option) => option.value === axis)?.label} 기준 ·{' '}
            {paged ? `${paged.totalElements}건` : <span className={ts.captionSkeleton} />}
          </span>
          <div className={ts.bandEnd}>
            {csvError && <span className="text-[12px] text-[var(--pl-err-text)]">{csvError}</span>}
            <PlButton onClick={onCsv}>CSV 내려받기</PlButton>
          </div>
        </div>
        <div className={ts.tableWrap}>
          <table className={ts.table}>
            <thead>
              <tr className={tableStyles.header}>
                <SortHeader column={SORTABLE.id} sort={sort} onSort={toggleSort} />
                <th className={tableStyles.headerCell}>서비스 이름</th>
                <th className={tableStyles.headerCell}>서비스 코드</th>
                <SortHeader column={SORTABLE.created} sort={sort} onSort={toggleSort} />
                <SortHeader column={SORTABLE.installed} sort={sort} onSort={toggleSort} />
                <th className={cn(tableStyles.headerCell, ts.cellNumeric)}>리드타임</th>
                <th className={tableStyles.headerCell}>최초 연동</th>
              </tr>
            </thead>
            <tbody className={tableStyles.body}>
              {loading && <SkeletonRows />}
              {!loading && error != null && (
                <tr>
                  <td className={ts.state} colSpan={COLUMN_COUNT}>
                    목록을 불러오지 못했습니다.
                  </td>
                </tr>
              )}
              {!loading && error == null && rows.length === 0 && (
                <tr>
                  <td className={ts.state} colSpan={COLUMN_COUNT}>
                    조건에 맞는 TargetSource 가 없습니다.
                  </td>
                </tr>
              )}
              {!loading
                && error == null
                && rows.map((row, index) => (
                  <Row key={row.targetSourceId ?? `row-${index}`} row={row} />
                ))}
            </tbody>
          </table>
        </div>
        <div className={ts.foot}>
          <span className={ts.footCount}>
            {paged ? `${paged.numberOfElements}건 · 전체 ${paged.totalElements}건 중` : ''}
          </span>
          <PlPagination
            page={page + 1}
            pages={pages}
            onPrev={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => Math.min(pages - 1, current + 1))}
            className={ts.footPager}
          />
        </div>
      </section>
    </div>
    </div>
  );
}

function Row({ row }: { row: IntegrationTimelineRow }): ReactElement {
  const installed = row.piiAgentFirstInstalledAt != null;
  const firstInstalled = formatWireDay(row.piiAgentFirstInstalledAt);
  const lead = formatLeadTime(row.leadTimeSeconds);
  return (
    <tr className={tableStyles.row}>
      <td className={cn(tableStyles.cell, ts.cellMono)}>
        {row.targetSourceId != null ? (
          <Link
            className={ts.link}
            href={passRoutes.pipelines.ops.targetSource(row.targetSourceId)}
          >
            #{row.targetSourceId}
          </Link>
        ) : (
          EMPTY_CELL
        )}
      </td>
      <td className={tableStyles.cell}>{row.serviceName ?? EMPTY_CELL}</td>
      <td className={cn(tableStyles.cell, ts.cellMono)}>{row.serviceCode ?? EMPTY_CELL}</td>
      <td className={cn(tableStyles.cell, ts.cellMono)}>{formatWireDay(row.createdAt)}</td>
      <td className={cn(tableStyles.cell, ts.cellMono, !installed && ts.dim)}>{firstInstalled}</td>
      <td
        className={cn(
          tableStyles.cell,
          ts.cellMono,
          ts.cellNumeric,
          row.leadTimeSeconds == null && ts.dim,
        )}
      >
        {lead}
      </td>
      <td className={tableStyles.cell}>
        {/* 한 사실만 말한다 — 완료/미완료. 경과일도, 경고 톤도, 테두리도 없다. */}
        <span className={cn(ts.tag, installed ? tagStyles.green : tagStyles.gray)}>
          {installed ? '완료' : '미완료'}
        </span>
      </td>
    </tr>
  );
}

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: SortableColumn;
  sort: TimelineSort;
  onSort: (prop: TimelineSortProp) => void;
}): ReactElement {
  const active = sort.prop === column.prop;
  return (
    <th
      className={tableStyles.headerCell}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={ts.sortButton} onClick={() => onSort(column.prop)}>
        {column.label}
        {active && <span className={ts.sortMark}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

function QuickSpans({
  value,
  onChange,
  onCustom,
}: {
  value: number | null;
  onChange: (span: number) => void;
  /** 직접 선택 — opens the calendar; pressed while the applied range is not a quick span. */
  onCustom: () => void;
}): ReactElement {
  return (
    <div className={ts.compoundSeg} role="group" aria-label="최근 기간">
      {QUICK_SPANS.map((quick) => {
        const active = quick.span === value;
        return (
          <button
            key={quick.span}
            type="button"
            aria-pressed={active}
            className={cn(
              segmentedControlStyles.itemSm,
              active && segmentedControlStyles.itemActive,
            )}
            onClick={() => onChange(quick.span)}
          >
            {quick.label}
          </button>
        );
      })}
      {/* ponytail: 직접 선택 is the 5th and last segment. Past five, fold into a dropdown
          (benchmark 1, 시안 3). */}
      <button
        type="button"
        aria-pressed={value === null}
        className={cn(
          segmentedControlStyles.itemSm,
          value === null && segmentedControlStyles.itemActive,
        )}
        onClick={onCustom}
      >
        직접 선택
      </button>
    </div>
  );
}

function Segment<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}): ReactElement {
  return (
    <div className={segmentedControlStyles.container} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              segmentedControlStyles.itemSm,
              active && segmentedControlStyles.itemActive,
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Placeholder rows — the table keeps its geometry while a page is in flight. */
function SkeletonRows(): ReactElement {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={index}>
          {Array.from({ length: COLUMN_COUNT }, (_, cell) => (
            <td key={cell} className={tableStyles.cell}>
              <span className={ts.skeleton} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Hands the server's file to the browser — the bytes are never rebuilt here. */
function saveCsv(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
