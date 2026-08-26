'use client';

import type { ReactNode } from 'react';
import { cn, numericFeatures, paginationStyles } from '@/lib/theme';

interface PaginationProps {
  /** 0-based page index */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  pageSizeOptions?: ReadonlyArray<number>;
  /**
   * Edge-control set. `prevNext` (default) renders single-chevron prev/next only;
   * `full` adds the first/last double-chevrons.
   *
   * The default flipped on 2026-08-26. `‹‹ ‹ › ››` put four edge controls around a
   * three-number window, and on a one-page table all four were permanently dead —
   * Geist's rule for exactly this ("hide unavailable slots rather than disabling
   * them") reads as: the first/last pair was never carrying its width. Jumping to
   * the last page is still reachable in one click because `buildVisiblePages`
   * always renders the last index.
   *
   * `full` stays for a caller that can prove it needs the jump, and the v16 IDC
   * step tables keep passing `prevNext` explicitly — that is now a no-op, and it is
   * left in place because the prop documents their pager (`이전 / [1] / 다음`).
   */
  controls?: 'full' | 'prevNext';
  /**
   * Text scale. `sm` (default) is v15's 12px. `md` is 14px, for the console tables
   * (round 17, owner: "target-sources/1006 에서 보여지는 pagination footer 디자인 차용"
   * + a standing 14px instruction) — the size reaches the select and the page buttons
   * too, so the bar holds ONE size.
   *
   * The 14px order was given a SECOND time (08-23, "2번 말하게 하지마") after four
   * console-table mounts shipped on the `sm` default — a docblock alone did not hold
   * the rule. `Pagination.mounts.test.ts` now fails any console-table caller that
   * mounts this bar without `size="md"`; if it fails you, pass the prop, do not
   * loosen the scan.
   *
   * There is deliberately no surface variant. Round 15 gave the console table a flat,
   * centred footer of its own; round 17 retired it because the owner picked THIS bar —
   * the one 20 other tables already use — leaving size as the only difference.
   *
   * ⛔ Do not gate the controls on `totalPages > 1`. That was tried and the owner's
   * answer was "pagination은 왜 없음?" — a footer whose controls come and go reads as a
   * missing footer, and 시안 D's "pagination earns its row" was about the ROW.
   * (Re-proposed 2026-08-26 as benchmark 시안 D and NOT adopted for that reason.)
   */
  size?: 'sm' | 'md';
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Returns the page numbers (0-based) and ellipses to render in the page-numbers
 * row. Always shows first/last; collapses the middle to current ±1 with '…'
 * separators when the total exceeds 7 pages.
 */
export const buildVisiblePages = (current: number, total: number): Array<number | '…'> => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: Array<number | '…'> = [0];
  const left = Math.max(1, current - 1);
  const right = Math.min(total - 2, current + 1);
  if (left > 1) out.push('…');
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 2) out.push('…');
  out.push(total - 1);
  return out;
};

/**
 * v15 `.pagination-row` footer (05-tables.md §7) — a standalone bar that sits
 * directly beneath a table: a 1px border with no top edge, `0 0 10px 10px` radius,
 * and an off-white fill. Those colours live in `paginationStyles`, not here.
 *
 * ## 2026-08-26 — 세 칸 그리드 (시안 A+C)
 *
 * 이전에는 `flex` + 가운데 `flex-1` 스페이서였다. 1,372px 짜리 콘솔 표에서 그 스페이서가
 * **903px(바 폭의 66%)** 를 먹고 왼쪽 무리와 페이저를 양 끝으로 밀어냈다 — 오너 지적
 * ("이 모양이 뭐냐"). 같은 부품이 MUI `TablePagination` 에서는 스페이서를 **맨 앞**에 둬서
 * 한 뭉치를 만드는데, 우리는 가운데 놓아서 협곡을 만들고 있었다.
 *
 * 지금은 `1fr auto 1fr` 세 칸이고, 배치는 **같은 탭의 논리 DB 모달 푸터**에서 그대로
 * 가져왔다(범위 / 페이저 / 페이지당). 이 앱 안에 이미 있던 문법이라 새로 발명한 게 아니고,
 * 표 21곳이 한 번에 바뀌는 변경에서 위험이 가장 낮은 선택이었다. 가운데 칸이 `auto` 라
 * 페이저 폭이 변해도(1자리 → 3자리) 광학 중심이 유지된다.
 *
 * 같이 나간 수선 세 건 — 어느 배치를 골랐든 나가야 했던 것들이다:
 *  - 셀렉트 화살표가 **렌더되지 않고 있었다**. `bg-[url("data:…<svg width='9' …>")]` 의
 *    arbitrary value 안에 공백이 있어 Tailwind v4 가 클래스를 만들지 않았는데
 *    (`backgroundImage === "none"`), `appearance-none` 과 `pr-[22px]` 는 살아 있어서
 *    55px 상자 오른쪽 22px 가 이유 없이 비어 있었다 — 드롭다운이 아니라 비활성 인풋으로
 *    보였다. 커스텀 화살표를 걷고 네이티브로 되돌린다.
 *  - 비활성 화살표가 `opacity-35` 로 **1.89:1** 이었다 → 색 교체로 4.85:1 (`paginationStyles`).
 *  - 좌우 여백이 14px 이라 표 셀의 18px gutter 와 **4px 어긋나** 있었다 → 18px.
 *
 * 근거: 벤치마크 아티팩트 `docs/ux/benchmark/pager-footer.md`.
 */
export const Pagination = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  controls = 'prevNext',
  size = 'sm',
}: PaginationProps) => {
  const options = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalCount, (page + 1) * pageSize);
  const visible = buildVisiblePages(page, totalPages);
  const md = size === 'md';
  // The size reaches the CONTROLS too: the select and the page buttons carry their own,
  // so leaving them at 12 would put two sizes in one bar.
  const controlText = md ? 'text-[14px]' : 'text-[12px]';
  // design-guide: 버튼=셀렉트=인풋 동일 높이. 예전에는 셀렉트 26 / 버튼 28 로 갈라져
  // 있었다. md 의 32 는 논리 DB 모달 푸터(=`OpsPagination`)의 값이라, 두 페이저가 같은
  // 화면에서 나란히 서도 컨트롤 크기가 어긋나지 않는다.
  const controlSize = md ? 'h-[32px]' : 'h-[28px]';

  const sizePicker = (
    <div className={cn('inline-flex items-center gap-1.5', controlText)}>
      <span>페이지당</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className={cn(
          // 네이티브 화살표를 쓴다 — 커스텀 data-URI 는 Tailwind v4 에서 컴파일되지 않아
          // 2026-08-26 이전까지 아무 화살표도 그려지지 않았다. 브라우저가 그리는 것이
          // 이 자리에서는 가장 안전하다.
          'cursor-pointer pl-[8px] pr-[4px]',
          paginationStyles.select,
          controlSize,
          controlText,
        )}
        aria-label="페이지당 표시 건수"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  const countLabel = (
    <span className={cn(paginationStyles.count, numericFeatures.tabular)}>
      <strong className={cn('font-semibold', paginationStyles.countStrong)}>
        {start}–{end}
      </strong>{' '}
      / 전체{' '}
      <strong className={cn('font-semibold', paginationStyles.countStrong)}>{totalCount}</strong>건
    </span>
  );

  const pageButtons = (
    /* The row owns the control size so PageBtn and the ellipsis inherit one value. */
    <div className={cn('inline-flex gap-1', controlText)}>
      {controls === 'full' && (
        <PageBtn
          active={false}
          big={md}
          disabled={page <= 0}
          onClick={() => onPageChange(0)}
          ariaLabel="처음 페이지"
        >
          ‹‹
        </PageBtn>
      )}
      <PageBtn
        active={false}
        big={md}
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        ariaLabel="이전 페이지"
      >
        ‹
      </PageBtn>
      {visible.map((entry, index) =>
        entry === '…' ? (
          <span
            key={`ellipsis-${index}`}
            className={cn(
              'inline-flex min-w-[20px] items-center justify-center self-center text-center',
              paginationStyles.ellipsis,
            )}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <PageBtn
            key={entry}
            active={entry === page}
            big={md}
            onClick={() => onPageChange(entry)}
            ariaLabel={`${entry + 1} 페이지`}
          >
            {entry + 1}
          </PageBtn>
        ),
      )}
      <PageBtn
        active={false}
        big={md}
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        ariaLabel="다음 페이지"
      >
        ›
      </PageBtn>
      {controls === 'full' && (
        <PageBtn
          active={false}
          big={md}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          ariaLabel="끝 페이지"
        >
          ››
        </PageBtn>
      )}
    </div>
  );

  return (
    /* 세 칸: 얼마나(범위) / 어디(페이저) / 얼마씩(페이지 크기). 가운데가 `auto` 라
       페이저는 자기 폭만 먹고, 남는 폭은 양쪽 `1fr` 이 반씩 가져간다 — 예전처럼 한 덩어리
       공백이 가운데 고이지 않는다. 좌우 18px 은 표 셀의 gutter 와 같은 값이라 푸터 첫 글자가
       첫 열과 줄이 맞는다. */
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_1fr] items-center px-[18px]',
        paginationStyles.bar,
        md ? 'py-3 text-[14px]' : 'py-[10px] text-[12px]',
      )}
    >
      {countLabel}
      {pageButtons}
      <div className="justify-self-end">{sizePicker}</div>
    </div>
  );
};

interface PageBtnProps {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  /** 콘솔 표(md)는 32×32, v15 표(sm)는 28×28 — 같은 바 안의 셀렉트와 같은 높이다. */
  big?: boolean;
}

/**
 * v15 `.pg-pages button` (05-tables.md §7g–7h): radius 6, 0/8 padding, transparent
 * border + bg. Ink, hover and the filled `.current` state come from
 * `paginationStyles` — this file names roles, `lib/theme.ts` spells the colours.
 *
 * Disabled 는 투명도가 아니라 색이다 — `opacity-35` 는 이 바 위에서 1.89:1 이었다.
 *
 * Font size is INHERITED from the pager row, not set here — the console variant runs
 * at 14px and a size declared on the button would pin every variant to 12.
 */
const PageBtn = ({ active, onClick, ariaLabel, children, disabled, big }: PageBtnProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-current={active ? 'page' : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-grid place-items-center rounded-[6px] border px-[8px] transition-colors disabled:cursor-not-allowed',
      big ? 'h-[32px] min-w-[32px]' : 'h-[28px] min-w-[28px]',
      numericFeatures.tabular,
      active ? cn(paginationStyles.pageBtnCurrent, 'font-semibold') : paginationStyles.pageBtn,
      paginationStyles.pageBtnDisabled,
    )}
  >
    {children}
  </button>
);
