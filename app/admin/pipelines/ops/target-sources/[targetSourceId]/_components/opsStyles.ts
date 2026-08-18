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

  /** h1 + the service-side link on one baseline (GitHub repo-header grammar):
      the quiet 12px link reads as a destination hanging off the title, not as a
      second title. */
  titleLine: 'flex items-baseline gap-3 flex-wrap',
  identityRow: 'flex items-center gap-4 mt-3.5',

  /** Neutral tag / region tag — shared with SduOpsNotice·ServiceDetailView·
      TerraformStatusModal (Figma 49:4/34:4). */
  tag: 'inline-flex items-center rounded px-2 py-1 text-[12px] font-semibold bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)] whitespace-nowrap',
  regionTag: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
  /**
   * 실데이터 — `doesSupportRaw === true` 인 대상에만 붙는다 (서비스 운영의 대상 카드).
   * 대상 운영 헤더는 같은 면에 동작을 얹은 `rawDataToggle` 로 세 상태를 항상 그린다.
   *
   * **색이 아니라 획으로 선다.** 이 줄에서 색 채널은 이미 다 팔렸다: StepPill 하나가
   * off/warn/primary/ok 네 계열을 상태에 따라 돌아가며 쓰고(TONE_CLASS), 회색은 중국
   * 태그와 서비스코드 칩이, 파랑은 SDU 칩이 쓴다. 실제로 warn 으로 처음 그렸더니
   * PENDING 대상(#1013)에서 태그와 단계 알약이 **같은 토큰**(--pl-warn-bg/-text)으로
   * 나란히 서서 한 덩어리로 읽혔다. 상태에 따라 도는 값 옆에서는 어떤 색을 골라도
   * 언젠가는 겹친다.
   *
   * 그래서 이 줄에서 아무도 안 쓰는 채널을 쓴다 — 나머지 칩은 전부 테두리 없는 면이고,
   * 이것만 흰 면 + 획이다. 색이 없으니 StepPill 이 어느 계열로 가든 겹치지 않는다.
   * 투명이 아니라 흰 면인 것도 이유가 있다: 서비스 운영의 카드는 hover 에서 보라로
   * 물드는데(`tableRowLift.card`), 투명이면 태그가 그 물을 같이 먹는다.
   *
   * 대비 실측: 글자(`--pl-text-strong`) on 면(`--pl-bg-card`) = 17.85:1. 면은 카드
   * hover 틴트 위에서 ΔE00 8.92 (tableRowLift.card 주석의 실측치와 같은 쌍).
   */
  rawDataTag: 'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-semibold border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)]',
  /**
   * 대상 운영 헤더의 실데이터 칩 — 같은 면·획 위에 키·값 문법(modeTag)과 동작을 얹는다.
   *
   * 서비스 운영 카드는 참인 대상에만 태그를 붙이지만, 이 화면은 값을 **바꾸는** 자리라
   * 세 상태(포함 / 미포함 / 미확인)를 항상 그린다: 태그가 없는 것과 "미포함"은 서로 다른
   * 말인데, 안 그리면 두 상태가 같은 픽셀이 된다.
   *
   * 동작 채널은 설치모드 칩(tier 3 의 `modeTag`)과 같다 — 키는 weak, 값은 파랑·밑줄.
   * 파랑·밑줄 자체는 이 헤더의 일반 표기다(role 등록 버튼 `roleRegister`, 서비스 링크도
   * 쓴다); 칩의 **값 칸**에 그 표기를 두는 것이 이 둘뿐이라, 값은 `modeTagValue` 를 그대로
   * 쓴다 — 같은 뜻이면 정의도 하나여야 한쪽만 바뀌어 문법이 갈라지지 않는다.
   *
   * 키만 따로 있는 이유: 부모 칩이 `font-semibold` 라, 키를 한 단 내리는 건 여기서만
   * 필요하다 (`modeTag` 는 부모가 굵지 않아 내릴 것이 없다).
   */
  rawDataToggle: 'gap-1 cursor-pointer hover:bg-[var(--pl-gray-50)]',
  rawDataToggleKey: 'font-medium text-[var(--pl-text-weak)]',

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

  /** 서비스 축의 두 목적지 (Jira 티켓 · 서비스 운영) — 이름·코드 줄 바로 아래 곁줄.
      라벨 붙은 블록을 화면 오른쪽에 세워 두면 서비스 이야기를 두 군데서 하게 되어,
      cloudRow 와 같은 12px/weak 곁줄 문법으로 신원 스택에 흡수시켰다. 슬롯 높이를
      고정(min-h)해 티켓이 늦게 도착해도 헤더가 흔들리지 않는다. 파랑 없음: 밑줄이
      affordance 를 지고(opsStyles.countLink 규칙) 색은 Jira 마크 하나뿐이다. */
  chanRow: 'flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 min-h-[20px] text-[12px]',
  /* The mark sits outside the underlined text — text-decoration would otherwise
     strike through the glyph (a child cannot cancel an ancestor's underline). */
  chanLink: 'group inline-flex items-center gap-1',
  /** 마크 옆 종류 라벨 — 키만으로는 BDCDIP-1013 이 무엇인지 마크를 알아봐야 안다. */
  chanKind: 'text-[var(--pl-text-weak)]',
  chanLinkText:
    'font-semibold text-[var(--pl-text-medium)] underline underline-offset-2 decoration-[var(--pl-border-strong)] cursor-pointer group-hover:text-[var(--pl-text-strong)] group-hover:decoration-[var(--pl-text-strong)]',
  /** No browseUrl — the key is a value, not a door. Same slot, no affordance. */
  chanPlain: 'font-semibold text-[var(--pl-text-medium)]',
  /** 없음은 읽히라고 쓰는 문장이라 weak — 곁줄로 내려오면서 라벨이 사라졌으니
      이 한 줄이 "티켓 자리" 를 혼자 설명한다. */
  chanNone: 'text-[var(--pl-text-weak)]',
  chanArrow: 'text-[var(--pl-text-faint)]', // design-exempt: 링크 텍스트에 붙는 방향 글리프(↗), 의미는 옆 텍스트가 진다

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
