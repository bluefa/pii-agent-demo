/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
export const opsStyles = {
  /** Full-bleed masthead over the layout's gray page — escapes layout.contentFluid
      padding (-mt-6 -mx-8), no card. The route is fluid (layout.tsx `isOpsTarget`)
      so this bleed reaches the viewport edge instead of stopping at a 1440px cap. */
  headCard: '-mt-6 -mx-8',
  /** No bottom border: the masthead and the tab rail below it are one white block,
      and the rail's own border is the single line that closes it. */
  header: 'bg-[var(--pl-bg-card)] px-8 pt-6 pb-5',

  /** Title row — the fixed page label (h1) with the 협업 채널 block docked right. */
  titleRow: 'flex items-start justify-between gap-7',
  /** Left column: h1 + the provider mark and identity stack under it. */
  titleCol: 'min-w-0 flex-1',
  /** h1 + the service-side link on one baseline (GitHub repo-header grammar):
      the quiet 12px link reads as a destination hanging off the title, not as a
      second title. */
  titleLine: 'flex items-baseline gap-3 flex-wrap',
  identityRow: 'flex items-center gap-4 mt-3.5',

  /** Neutral tag / region tag — shared with SduOpsNotice·ServiceDetailView·
      TerraformStatusModal (Figma 49:4/34:4). */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',

  /** Cloud context — tier 3 of the identity stack (계정 · 리전 · 설치모드). */
  cloudRow: 'flex items-center gap-1.5 mt-1 text-[12px] text-[var(--pl-text-weak)]',
  cloudStrong: '[font-family:var(--pl-font-mono)] text-[var(--pl-text-medium)]',
  cloudSep: 'text-[var(--pl-text-faint)]',
  modeTag: 'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] bg-[var(--pl-gray-100)] cursor-pointer hover:bg-[var(--pl-gray-200)]',
  modeTagKey: 'text-[var(--pl-text-weak)]',
  modeTagValue: 'font-semibold text-[var(--pl-primary)] underline',

  /** Role sub-rows — tier 4, aligned to the identity stack's text column (no
      indent of their own: `improvedStyles.header.body` already sets that column). */
  roleRow: 'flex items-center gap-3 mt-1.5',
  roleLabel: 'w-[72px] flex-none text-[12px] text-[var(--pl-text-weak)]',
  roleEmpty: 'text-[12px] text-[var(--pl-text-faint)]',
  roleRegister: 'text-[12px] font-semibold text-[var(--pl-primary)] underline cursor-pointer',
  /** Read-only 주체 값 (GCP SA·Azure App) — roleArn 과 같은 자리, 동작만 없다. */
  roleValue: 'text-[12px] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)] break-all',

  /** 협업 채널 — a block docked in the flow, not a popover: the old bubble's tail
      pointed at nothing and its `absolute` box pinned itself to the content cap.
      Three tiers mirroring the identity stack on the left — 범위 / 티켓(외부) /
      관리 위치(내부). Fixed width so a longer issue key never shifts the stack,
      and the tiers hold their slots while loading so the header height is stable.
      No blue: the underline carries the affordance (opsStyles.countLink rule) and
      the only hue is the Jira brand mark. */
  chan: 'flex-none w-[216px] rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-3.5 pt-2.5 pb-2.5 flex flex-col gap-1',
  chanLabel: 'text-[11px] font-semibold tracking-[0.03em] text-[var(--pl-text-faint)]',
  /* The mark sits outside the underlined text — text-decoration would otherwise
     strike through the glyph (a child cannot cancel an ancestor's underline). */
  /* leading-[20px] on all three tier-2 states (link · 없음 · skeleton) so the
     slot is one height and the block does not resize when the channel lands. */
  chanRow: 'group self-start inline-flex items-center gap-1.5',
  chanKey:
    'text-[14px] leading-[20px] font-semibold text-[var(--pl-text-strong)] underline underline-offset-[3px] decoration-[var(--pl-border-strong)] group-hover:decoration-[var(--pl-text-strong)] cursor-pointer',
  /** No browseUrl — the key is a value, not a door. Same slot, no affordance. */
  chanKeyPlain: 'text-[14px] leading-[20px] font-semibold text-[var(--pl-text-medium)]',
  chanNone: 'text-[13px] leading-[20px] text-[var(--pl-text-faint)]',
  /** Tier 3 — sits under a hairline so "어디서 관리하는가" reads as a separate fact
      from the ticket itself, not as a second line of it. */
  chanGo:
    'group mt-0.5 pt-[7px] border-t border-[var(--pl-gray-100)] text-[12px] text-[var(--pl-text-weak)] hover:text-[var(--pl-text-medium)]',
  chanGoName:
    'font-semibold text-[var(--pl-text-medium)] underline underline-offset-2 decoration-[var(--pl-border-strong)] group-hover:decoration-[var(--pl-text-strong)]',
  chanGoOff: 'mt-0.5 pt-[7px] border-t border-[var(--pl-gray-100)] text-[12px] text-[var(--pl-text-faint)]',
  chanArrow: 'text-[var(--pl-text-faint)]',

  /** Tab rail — line tabs (Carbon: the body below is cards on a ground, not a
      panel, so a contained tab's white face had nothing to connect to). The rail
      is the masthead's last row: same white face, one border closing both, and
      the active tab is marked by weight + hue + underline. */
  tabStrip: 'flex items-center gap-1 px-8 bg-[var(--pl-bg-card)] border-b border-[var(--pl-border)]',
  tab: 'px-3 py-3 text-[14px] cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)]',
  tabIdle: 'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-strong)] hover:border-[var(--pl-border-strong)]',
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
  /** Skeleton text line — 블록은 `skeleton`, 글줄은 이것 (AlertStageCard 의 bar 관례). */
  skeletonBar: 'animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

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
