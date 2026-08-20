/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
export const opsStyles = {
  /**
   * R1 page root (docs/ux/benchmark/ops-detail-ia-redesign.md) — escapes
   * layout.contentFluid's padding (the dash.bleed escape hatch) so the masthead
   * wash and the lavender canvas both reach the viewport edges. The canvas is
   * painted HERE, not on --pl-bg-page: that token is the section's, and every
   * sibling pipelines screen stands on it.
   */
  page: '-mx-8 -mt-6 -mb-12 flex min-h-[calc(100vh_-_64px)] flex-col bg-[var(--pl-bg-canvas)]',
  /**
   * Masthead — one gray-100 wash holding breadcrumb + identity line, closed by
   * the tab band (tabStrip). The wash separates from the canvas on chroma, not
   * luminance (ΔE00 2.46, guard-pinned).
   */
  masthead: 'bg-[var(--pl-gray-100)] px-8 pt-4',

  /** Breadcrumb — 서비스 운영 / 서비스 이름 / #id. On the wash, so weak not faint:
      워시는 램프 한 칸을 잡아먹는다 (faint measures 2.34:1 here). */
  crumb: 'flex items-center gap-1.5 text-[12px] text-[var(--pl-text-weak)]',
  crumbLink: 'hover:text-[var(--pl-text-strong)] hover:underline',
  crumbSep: 'text-[var(--pl-text-faint)]', // design-exempt: decorative path glyph, the labels around it carry the reading
  crumbHere: 'font-semibold text-[var(--pl-text-strong)]',

  /** Identity line — provider mark + "Target Source 운영 #{id}" (h1) + step pill + stamp,
      the service-side link pushed to the far edge. One line: everything else the
      old five-tier header stacked here now lives in the meta rail (OpsMetaRail). */
  idLine: 'mt-1.5 flex flex-wrap items-center gap-3',
  idTitle: 'whitespace-nowrap text-[16px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 오너 08-20: 제목 16px, id 부분은 한 단 아래 14px. */
  idNum: 'text-[14px] tabular-nums',
  idHash: 'text-[14px] font-normal text-[var(--pl-text-faint)]', // design-exempt: prefix glyph, the id digits beside it carry the reading

  /** Meta block — 클라우드 · 설정 + 검증값 on the wash (오너 08-20: the target's
      own facts came back out of the rail; 08-20 둘째 조정: 한 줄 나열이 아니라
      기존 헤더처럼 행 스택). One key·value row per fact, fixed 72px label column
      (the old roleRow grammar); white chips and the ARN action are the only
      interactive islands. */
  metaRows: 'mt-2.5 flex flex-col gap-1',
  metaRow: 'flex min-h-[23px] items-center gap-3',
  metaKey: 'w-[72px] flex-none text-[12px] text-[var(--pl-text-weak)]',
  metaValue: 'min-w-0 text-[12px] font-semibold text-[var(--pl-text-medium)]',

  /** Neutral tag / region tag — shared with SduOpsNotice·ServiceDetailView·
      TerraformStatusModal (Figma 49:4/34:4). */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
  /**
   * 흰 면 + 획 칩 — the 실데이터 tag on the service-ops target cards
   * (ServiceDetailView). This screen's own editable values moved to `metaTag`
   * (오너 08-20 넷째 조정), one notch louder, but they keep this grammar.
   *
   * 색이 아니라 획으로 선다. R1′ V-b 레일은 카드 없이 캔버스 위 맨몸이라, 흰 면은
   * 이 화면에서 "만질 수 있는 값"에만 남는다 — 그 문법을 이 칩이 진다. 값의 밑줄이
   * affordance 를 지고(countLink 규칙) 색은 상태(StepPill)에 남는다.
   *
   * 대비 실측: 글자(--pl-text-strong) on 면(--pl-bg-card) = 17.85:1. 면은 캔버스
   * (--pl-bg-canvas) 위에서 ΔE00 4.12, 카드 hover 틴트 위에서 8.92 (tableRowLift.card
   * 주석의 실측치와 같은 쌍).
   */
  rawDataTag: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)]',
  /**
   * Masthead meta tags (오너 08-20 넷째 조정) — the editable values (설치모드·
   * 실데이터) read as emphasized tags and the ACTION moves to a 수정 link beside
   * them, so the tag no longer has to look clickable (no underline, no hover
   * fill). metaTag = white face + strong stroke, one notch louder (px-2) than
   * rawDataTag; metaTagQuiet = the read-only region tag (China/Global), filled
   * with the band's gray-200 so the white face keeps meaning "editable value"
   * (2.94 on the wash, text 8.44:1).
   */
  metaTag: 'inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-semibold border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)]',
  metaTagQuiet: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-medium bg-[var(--pl-gray-200)] text-[var(--pl-text-medium)]',

  /**
   * Card tabs in a band (R1, 오너 08-20 셋째 조정) — the strip itself is a
   * gray-200 band one ramp under the wash (ΔE00 2.94 on the wash, 3.53 against
   * the canvas below), so the tab tier reads as its own layer. The active tab
   * is a bare white face with an OPEN bottom — no stroke, because --pl-border
   * IS the band color (ΔE00 0.00): on the darker band the face alone carries
   * the shape (white on band 5.66, vs 2.78 it managed on the wash).
   */
  tabStrip: 'mt-2.5 -mx-8 flex items-end gap-1 overflow-x-auto bg-[var(--pl-gray-200)] px-8 pt-1.5',
  tab: 'cursor-pointer whitespace-nowrap rounded-t-[8px] px-4 py-2 text-[14px]',
  tabActive: 'bg-[var(--pl-bg-card)] font-semibold text-[var(--pl-text-strong)]',
  /** 워시는 램프 한 칸을 잡아먹는다, and the band eats one more: weak measures
      4.01:1 on gray-200 (AA fail) — idle steps up to medium (8.44:1). */
  tabIdle: 'font-medium text-[var(--pl-text-medium)] hover:text-[var(--pl-text-strong)]',
  /** 보기(진행 상태·스캔·연동 요청·확정) | 도구(인프라·연결 테스트·승인) group gap. */
  tabGap: 'w-3.5 flex-none self-stretch',

  /** Body — content column + 236px meta rail, both on the canvas. */
  body: 'flex flex-1 items-start gap-6 px-8 pt-6 pb-12',
  content: 'flex min-w-0 flex-1 flex-col gap-4',

  /**
   * Meta rail (R1′ V-b) — bare on the canvas: no card, 흰 면은 인터랙티브에만.
   * 흰 카드(종이)는 화면에서 주 콘텐츠 한 계층에만 허용 (GitHub PR sidebar ·
   * Notion properties 문법). 오너 08-20 조정 이후 레일은 서비스 축(이름·코드·
   * Jira·운영)만 남는다 — 대상 자신의 사실은 마스트헤드 metaRow 로 갔다.
   */
  rail: 'w-[236px] flex-none',
  railGroup: 'border-t border-[var(--pl-border)] py-3 first:border-t-0 first:pt-1',
  railLabel: 'text-[12px] font-bold tracking-[0.06em] text-[var(--pl-text-weak)]',
  railRow: 'mt-1.5 flex items-baseline justify-between gap-2',
  railKey: 'flex-none text-[12px] text-[var(--pl-text-weak)]',
  railValue: 'min-w-0 truncate text-right text-[12px] font-semibold text-[var(--pl-text-medium)]',
  railMono: '[font-family:var(--pl-font-mono)] font-medium',
  railLink: 'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] underline underline-offset-2 decoration-[var(--pl-primary-ring)] hover:decoration-[var(--pl-primary)]',
  railNone: 'text-[12px] text-[var(--pl-text-weak)]',
  /** 설명 본문 — 레일의 유일한 문단. 표시만 100자에서 접고(전문은 title), 계약의
      1000자 한도는 수정 다이얼로그가 진다. */
  railProse: 'mt-1.5 break-words text-[12px] leading-[18px] text-[var(--pl-text-medium)]',
  /** Skeleton bar ON THE WASH — the gray-100 `skeletonBar` vanishes there (same
      value as the wash), so masthead skeletons step one ramp deeper. */
  skeletonWash: 'animate-pulse rounded-[6px] bg-[var(--pl-gray-200)]',
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
