/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
export const opsStyles = {
  /** 3-tier surface (admin-ops.html .ts-mast): full-bleed white masthead over the
      layout's gray page — escapes layout.content padding (-mt-6 -mx-8), no card. */
  headCard: '-mt-6 -mx-8',
  header: 'relative bg-[var(--pl-bg-card)] px-8 pt-5 pb-[18px] border-b border-[var(--pl-border)]',

  /** 현재 단계 row under the breadcrumb. */
  stageRow: 'flex items-center gap-2 mt-1',
  stageLabel: 'text-[12px] text-[var(--pl-text-weak)]',

  titleRow: 'flex items-start justify-between gap-6 mt-3',
  titleGroup: 'flex items-center gap-2 min-w-0',
  /** Neutral header tags (Target # id / service code) — Figma 49:4/34:4. */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',

  /** Cloud info inline row — Figma 34:12. */
  cloudRow: 'flex items-center gap-1.5 mt-2 text-[14px]',
  cloudStrong: 'font-medium text-[var(--pl-text-strong)]',
  cloudSep: 'text-[var(--pl-text-faint)]',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
  modeTag: 'inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] bg-[var(--pl-gray-100)] cursor-pointer hover:bg-[var(--pl-gray-200)]',
  modeTagKey: 'text-[var(--pl-text-weak)]',
  modeTagValue: 'font-semibold text-[var(--pl-primary)] underline',

  /** Role sub-rows — Figma 16:6/16:13 (label 72px + mono value + 수정/등록 CTA). */
  roleRow: 'flex items-center gap-3 pl-3.5 mt-2',
  roleLabel: 'w-[72px] flex-none text-[12px] text-[var(--pl-text-weak)]',
  roleEmpty: 'text-[12px] text-[var(--pl-text-faint)]',
  roleRegister: 'text-[12px] font-semibold text-[var(--pl-primary)] underline cursor-pointer',
  /** Read-only 주체 값 (GCP SA·Azure App) — roleArn 과 같은 자리, 동작만 없다. */
  roleValue: 'text-[12px] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] break-all',

  /** 협업 채널 — popover-style callout (Radix/shadcn grammar: white surface +
      border + soft shadow + border-matched arrow), pinned to the masthead's
      top-right. CTA hierarchy: Jira link = primary (brand color), 관리 = quiet. */
  bubbleWrap: 'absolute top-5 right-8 z-10',
  bubble:
    'relative min-w-[190px] rounded-xl bg-[var(--pl-bg-card)] border border-[var(--pl-border)] shadow-[var(--pl-shadow-lg)] px-4 py-3 flex flex-col gap-1.5',
  /* Border-matched arrow: rotated square sharing the bubble's border on its two
     visible edges, pointing down-left toward the target title. */
  bubbleTail:
    'absolute left-5 -bottom-[6px] h-3 w-3 rotate-45 bg-[var(--pl-bg-card)] border-b border-r border-[var(--pl-border)]',
  bubbleTop: 'flex items-center justify-between gap-4',
  bubbleTitle: 'text-[12px] font-semibold text-[var(--pl-text-weak)]',
  bubbleManage:
    'text-[12px] font-medium text-[var(--pl-text-faint)] hover:text-[var(--pl-text-medium)] hover:underline cursor-pointer',
  bubbleJiraRow:
    'self-start inline-flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-md hover:bg-[var(--pl-primary-bg)] transition-colors',
  /* Plain inline (not inline-flex) so the underline runs unbroken across "KEY ↗". */
  bubbleLink:
    'text-[14px] font-semibold text-[var(--pl-primary)] underline underline-offset-2 cursor-pointer',

  /** Tab rail (admin-ops.html .tabbar) — tinted band; only the active tab turns
      white so it visually connects to the body below. `items-center` centers the
      trailing 관리자 처리 actions (h32) against the taller tabs. */
  tabStrip: 'flex items-center gap-0.5 px-8 bg-[var(--pl-gray-100)] border-b border-[var(--pl-border)]',
  tab: 'px-4 py-3 text-[14px] cursor-pointer whitespace-nowrap rounded-t-[6px] border-b-2 -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)] bg-[var(--pl-bg-card)]',
  tabIdle: 'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)]',
  tabDisabled: 'font-medium text-[var(--pl-text-faint)] cursor-not-allowed',

  /** 진행 상태 tab content — 24px below the tab rail (prototype). */
  content: 'mt-6 flex flex-col gap-4',
  /** Side-by-side cards — grid rows stretch so the pair is always equal height. */
  cardsRow: 'grid grid-cols-2 gap-4',
  /** 20px — at 16px the card title reads the same tier as in-card block headers (ops feedback, scan tab). */
  cardTitle: 'text-[20px] font-semibold text-[var(--pl-text-strong)]',
  /** 14/weak, 12px below the title — the helper line recedes to gray, one tier under body headers. */
  cardDesc: 'text-[14px] text-[var(--pl-text-weak)] mt-3',

  /** A paged card in cardsRow: column layout so the pager sits at the bottom. */
  pagedCard: 'flex flex-col',
  /** Its body slot — tall enough for a full PAGE_SIZE(5) table, so a card with
      one row (or none) does not shrink below its sibling. `flex-1` then absorbs
      any extra height the taller sibling forces on this one. */
  pagedCardBody: 'mt-3 min-h-[266px] flex-1',

  /** In-cell count link — the user-side Step 6/7 grammar (LogicalDbCountCell
      `linkNeutral`): the underline carries the affordance so color stays free to
      mean state, because this link repeats once per row. */
  countLink:
    'inline-flex cursor-pointer items-center border-b border-current pb-px text-[14px] font-semibold tabular-nums text-[var(--pl-text-medium)] transition-colors hover:text-[var(--pl-text-strong)]',
  /** A reported 0 has nothing to open — content, not a link, and not the — placeholder. */
  countZero: 'text-[14px] tabular-nums text-[var(--pl-text-weak)]',

  /** In-cell text action that opens an editor — the Credential cell. A select box
      per row turns the table into a toolbar and buries the value inside a control,
      so the value IS the trigger. The hint's slot is reserved (opacity, not
      display) so revealing it never shifts the column, and focus-visible reveals
      it too: hover is never the only cue. */
  cellAction:
    'group inline-flex max-w-full items-baseline gap-2 rounded py-0.5 text-left text-[14px] text-[var(--pl-text-medium)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--pl-primary)]',
  cellActionValue:
    'truncate border-b border-transparent group-hover:border-current group-hover:text-[var(--pl-text-strong)] group-focus-visible:border-current group-focus-visible:text-[var(--pl-text-strong)]',
  cellActionEmpty:
    'truncate border-b border-transparent text-[var(--pl-text-faint)] group-hover:border-current group-hover:text-[var(--pl-text-medium)] group-focus-visible:border-current group-focus-visible:text-[var(--pl-text-medium)]',
  cellActionHint:
    'flex-none text-[12px] font-semibold text-[var(--pl-primary)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',

  /** Credential 배정 modal — a scrolling radio group built on the resource table's
      grammar: hairline row dividers, no box, no fill. A credential is a value in a
      list, not a card; boxing and bolding each one made 3 rows look important and
      would make 20 unreadable. Only the checked row is tinted (state). */
  credModal: {
    search:
      'mt-1 h-9 w-full rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[14px] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-faint)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]',
    /** Fixed height, not max-height: the list must not resize as the query filters
        it, and 3 credentials must occupy the same box as 30. */
    list: 'h-[300px] overflow-y-auto border-t border-[var(--pl-border)]',
    row: 'cursor-pointer border-b border-[var(--pl-gray-100)] hover:bg-[var(--pl-gray-50)]',
    rowOn: 'bg-[var(--pl-primary-bg)] hover:bg-[var(--pl-primary-bg)]',
    radio: 'h-4 w-4 flex-none accent-[var(--pl-primary)] cursor-pointer',
    /** 값 칸은 한 단이다 — 어느 행이 골라졌는지는 라디오와 행 배경이 이미 말하므로, 굵기까지
     *  얹으면 이름 열만 혼자 떠서 표가 기울어 읽힌다. */
    cell: 'truncate px-2 py-2.5 align-middle text-[14px] text-[var(--pl-text-medium)]',
    /** 열 이름이 곧 정렬 버튼. sticky 라 300px 를 스크롤해도 컨트롤이 사라지지 않는다. */
    headCell:
      'sticky top-0 z-10 whitespace-nowrap border-b border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-2 py-2 text-left text-[12px] font-medium text-[var(--pl-text-weak)]',
    sortBtn: 'inline-flex cursor-pointer items-center gap-1 hover:text-[var(--pl-text-strong)]',
    sortOn: 'text-[var(--pl-text-strong)]',
    used: 'whitespace-nowrap px-2 py-2.5 text-right align-middle text-[14px] tabular-nums text-[var(--pl-text-weak)]',
    empty: 'px-1 py-8 text-center text-[14px] text-[var(--pl-text-weak)]',
    /** 대상 3단 머리 — 라벨 / 값 / 안내. 값은 mono: Resource ID 는 읽는 값이 아니라 대조하는 값이다. */
    targetLabel: 'text-[12px] font-medium text-[var(--pl-text-faint)]',
    targetValue:
      'mb-2 mt-0.5 break-all font-mono text-[14px] font-semibold leading-[1.4] text-[var(--pl-text-strong)]',
  },

  /** 상세 보기 → text button (Figma 40:21). */
  detailLink: 'inline-flex items-center gap-1 text-[14px] font-medium text-[var(--pl-primary)] cursor-pointer hover:underline whitespace-nowrap',

  /** Loading skeleton block — same grammar as detailStyles.skeleton (task detail). */
  skeleton: 'animate-pulse rounded-[10px] bg-[var(--pl-gray-100)]',

  /** Figma 4:2 table grammar — plain headers (no fill), divider rows. */
  table: {
    base: 'w-full border-collapse text-[14px]',
    headCell:
      'py-2.5 px-3 text-left text-[12px] font-medium text-[var(--pl-text-weak)] border-b border-[var(--pl-border)] whitespace-nowrap',
    cell: 'py-3 px-3 border-b border-[var(--pl-gray-100)] align-middle text-[var(--pl-text-strong)]',
    rowHover: 'hover:bg-[var(--pl-gray-50)] transition-colors',
  },

  /** Uppercase wire-status tag (Figma APPROVED/CANCELLED chips). */
  statusTag:
    'inline-flex items-center rounded px-2 py-0.5 text-[12px] font-semibold tracking-[0.02em] whitespace-nowrap',
} as const;
