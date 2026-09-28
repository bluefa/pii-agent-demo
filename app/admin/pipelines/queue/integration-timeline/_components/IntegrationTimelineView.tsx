'use client';

/**
 * P6 연동 시점 (`/admin/pipelines/queue/integration-timeline`) — one question, one table:
 * when was a TargetSource made, and when did it first finish integrating.
 *
 * Every filter is a QUERY. axis / 기간 / page all go to the server and come back as a
 * page of rows; nothing is narrowed or re-sorted here. That is what makes the 건수 in the
 * footer and the CSV the same set of rows as the table. The order is the server's default
 * (연동 시작 날짜 내림차순) — the screen offers no sort (owner, 2026-09-15).
 *
 * What this screen deliberately does NOT have (owner, 2026-09-14): summary tiles, median /
 * average / percentile, an "elapsed so far" column, a CSP filter, bars inside cells. The
 * provider is a COLUMN (owner, 2026-09-15), not a filter — the same `Cloud` cell the queue
 * table shows. The statistics belong to whatever tool receives the CSV — this screen cuts the period and
 * shows the rows.
 */
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';

import { cn, segmentedControlStyles, tableStyles, tagStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import {
  downloadIntegrationTimelineCsv,
  getIntegrationTimeline,
} from '@/app/lib/api/task-queue-timeline';
import type { IntegrationTimelineRow, Paged, TimelineAxis } from '@/lib/types/task-queue';
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
  // Measured on the sibling 연동 요청 page (2026-09-15): its context line carries a 32px
  // number, so although the box margin is 4px the VISIBLE gap from the title's glyphs to the
  // text is 18px, and text → next block is 25px. This page has no big number, so the visible
  // distances are set directly: 16 (4px grid, nearest to 18) and 24. Layers are told apart by
  // distance, not by chrome — no breadcrumb above the title either (owner, 2026-09-15).
  lede: 'mt-4 whitespace-nowrap text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  /**
   * The confirm-tab card (ConfirmTab.tsx): 12px radius, strong border, shadow-sm. No
   * `overflow-hidden` — the 기간 popover opens from inside the band and must not be
   * clipped; the band rounds its own top corners instead.
   */
  card:
    'mt-6 rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
  /**
   * The table's toolbar (benchmark 2, 시안 3, owner 2026-09-15): the filters live on the
   * table they cut, in the gray-100 band the resource tables already use
   * (ResourceFilterBar). Order: 날짜 기준 · divider · 기간 · (right) Excel — benchmark 3 시안 1
   * (owner, 2026-09-15): the two groups are told apart by a 12/700 label each and one strong
   * divider, not by shape; the 「… 기준 · N건」 caption is gone (the segment and the footer
   * already say both).
   */
  band:
    'flex flex-wrap items-center gap-4 rounded-t-[11px] border-b border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-4 py-[14px]',
  /** Group label — the table-header size (12/semibold), medium so it holds on the gray-100 band. */
  label: 'text-[12px] font-bold leading-[1.2] text-[var(--pl-text-medium)]',
  /** The one line between 날짜 기준 and 기간 — strong on purpose (owner: 구분선만 찐하게). */
  divider: 'h-6 w-0.5 bg-[var(--pl-border-strong)]',
  /** Quick spans and the calendar field share one border: the date IS the pressed span. */
  compound:
    'inline-flex h-8 items-stretch rounded-[var(--pl-r-ctl)] border border-[var(--pl-border)] bg-[var(--pl-bg-card)]',
  compoundSeg:
    'inline-flex items-center gap-0.5 rounded-l-[7px] border-r border-[var(--pl-border)] bg-[var(--pl-gray-50)] p-0.5',
  bandEnd: 'ml-auto flex items-center gap-2',
  downloadError: 'text-[12px] text-[var(--pl-err-text)]',
  tableWrap: 'overflow-x-auto',
  table: 'w-full border-collapse',
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

const COLUMN_COUNT = 8;

export function IntegrationTimelineView(): ReactElement {
  // The window is seeded once, from the day the screen opened — re-deriving it per render
  // would hand `useAbortableEffect` a new `to` at midnight and re-query underneath a
  // reader.
  const [range, setRange] = useState(() => defaultRange(new Date()));
  const [axis, setAxis] = useState<TimelineAxis>('CREATED');
  const [page, setPage] = useState(0);

  const [paged, setPaged] = useState<Paged<IntegrationTimelineRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const compoundRef = useRef<HTMLDivElement>(null);

  const query = useMemo(
    () => ({ axis, from: range.from, to: range.to }),
    [axis, range.from, range.to],
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

  const onCsv = (): void => {
    setCsvError(null);
    downloadIntegrationTimelineCsv(query)
      .then((blob) => saveCsv(blob, `integration-timeline_${range.from}_${range.to}.csv`))
      .catch(() => setCsvError('Excel 파일을 내려받지 못했습니다.'));
  };

  const rows = paged?.content ?? [];
  const pages = Math.max(1, paged?.totalPages ?? 1);

  return (
    <div className={ts.page}>
    <div className={ts.body}>
      <header className={ts.head}>
        <div>
          <h1 className={ts.title}>TargetSource 연동 시점</h1>
          <p className={ts.lede}>
            TargetSource 가 언제 연동을 시작했고 언제 최초 연동 완료가 확인됐는지 기간으로 잘라 봅니다.
            최초 연동 완료확인 날짜는 초기화로 단계가 되돌아가도 바뀌지 않습니다.
          </p>
        </div>
      </header>

      <section className={ts.card}>
        <div className={ts.band} aria-label="조회 조건">
          <span className={ts.label}>날짜 기준</span>
          <Segment
            ariaLabel="날짜 기준"
            options={AXIS_OPTIONS}
            value={axis}
            onChange={(next) => refilter(() => setAxis(next))}
          />
          <span className={ts.divider} aria-hidden="true" />
          <span className={ts.label}>기간</span>
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
          <div className={ts.bandEnd}>
            {csvError && <span className={ts.downloadError}>{csvError}</span>}
            {/* The file is still text/csv; the label names the tool the operator opens it in
                (owner, 2026-09-15). A generic sheet glyph, not a vendor logo. */}
            <PlButton variant="ok" onClick={onCsv}>
              <SheetGlyph />
              Excel 내려받기
            </PlButton>
          </div>
        </div>
        <div className={ts.tableWrap}>
          <table className={ts.table}>
            <thead>
              <tr className={tableStyles.header}>
                <th className={tableStyles.headerCell}>ID</th>
                <th className={tableStyles.headerCell}>서비스 이름</th>
                <th className={tableStyles.headerCell}>서비스 코드</th>
                <th className={tableStyles.headerCell}>Cloud</th>
                <th className={tableStyles.headerCell}>연동 시작 날짜</th>
                <th className={tableStyles.headerCell}>최초 연동 완료확인 날짜</th>
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
      <td className={tableStyles.cell}>
        <ProvTag
          provider={row.cloudProvider ?? ''}
          isSdu={row.isSduType}
          isChina={row.isChinaRegion}
        />
      </td>
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

function SheetGlyph(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M2 6.5h12M2 10.5h12M6.5 2v12" />
    </svg>
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
