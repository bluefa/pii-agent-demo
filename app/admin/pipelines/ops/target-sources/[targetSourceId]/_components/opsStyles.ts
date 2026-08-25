/**
 * Ops target-source page chrome (Figma pYCA7zTWcZysYOpYykuYAN 4:2, adapted to
 * the --pl-* token system — raw Figma hex values map to their semantic tokens).
 */
import { primaryColors } from '@/lib/theme';

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
  /**
   * 관측 스코프 태그 — 카드 머리 메타 줄의 '최근 7일' (오너 2026-08-25: "파란색 태그로").
   *
   * 중립 회색 태그는 이 줄의 글자색(`--pl-text-weak`)과 같은 계열이라 태그가 아니라 굵은
   * 글자로 읽혔다. 파랑은 앱이 상호작용에 쓰는 한 가지 색이지만, 여기서는 면만 쓰고 밑줄도
   * 커서도 없어 누를 것으로 읽히지 않는다 — 같은 줄 오른쪽의 '전체 현황 보기'가 파란 **글자**
   * 라, 채널이 갈린다(면=라벨, 글자=진입).
   *
   * 색은 `primaryColors` 에서 그대로 온다(#E8F1FF / #0050D6, 5.92:1) — 앱의 파란 태그
   * 가족이다. 값을 손으로 베끼지 않는 이유는 census 다: 토큰이 움직이는 날 손복사본만
   * 제자리에 남아 두 파랑이 된다.
   *
   * ⛔ `cardStyles.stepTag` 를 빌려 쓰지 말 것: 그 토큰은 「N단계」 13개 헤드의 것이고
   * `design-guard.test.ts` 의 인구조사가 집합으로 고정한다. 그래서 기하도 일부러 다르다
   * (4px 라운드·semibold — 메타 줄의 가벼운 태그).
   */
  scopeTag: `inline-flex flex-none items-center rounded-[4px] px-1.5 py-0.5 text-[12px] font-semibold ${primaryColors.bgLight} ${primaryColors.textOnLight}`,

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

  /**
   * 칸 오른쪽 끝의 관리 입구 (오너 2026-08-25). `countLink` 와 다른 물건이다: 저쪽은 **값이
   * 곧 트리거**라 밑줄이 affordance 를 지지만, 이 링크는 값이 아니라 행위라 옆에 세울 값이
   * 없다. 대신 화살표가 "여기서 끝나지 않고 다른 화면으로 간다"를 말하고, 파랑은 hover
   * 에서만 든다 — 행마다 반복되는 링크가 상시로 파랗면 표에서 가장 시끄러운 것이 된다.
   *
   * 평소엔 **없다** (오너 2026-08-25). 행마다 반복되는 링크가 상시로 서 있으면 표에서
   * 가장 시끄러운 것이 되는데, 이 칸이 늘 말해야 하는 것은 건수지 입구가 아니다. 행에 눈이
   * 가는 순간 그 행이 무엇을 할 수 있는지 파랑으로 함께 켜진다 — 같은 행의 Credential 값도
   * 같이 켜지므로 두 입구가 한 제스처에 답한다.
   *
   * 사라지는 것은 `opacity` 지 자리가 아니다 — `hidden` 이면 hover 마다 건수 두 줄이 옆으로
   * 밀린다. 그리고 `focus-visible` 에서도 켜진다: 키보드로 온 사람에게 안 보이는 버튼에
   * 포커스가 서면 그 정거장은 사라진 것이나 같다.
   *
   * 그룹은 이름 있는 그룹이다(`/row`, `idcStyles.table.row` 가 선언). 맨 `group-hover` 는
   * 조상 중 아무 `group` 에나 걸려 표 바깥의 group 에서도 샌다
   * ([[feedback_bare_group_hover_leaks]]).
   *
   * 바탕 잉크 `--pl-text-medium` 10.46:1, `--pl-primary` 는 흰 면 5.17:1 · 행 hover 틴트
   * 4.95:1 로 두 상태 모두 4.5:1 을 넘는다(실측).
   */
  manageLink:
    'inline-flex flex-none cursor-pointer items-center whitespace-nowrap text-[14px] font-semibold text-[var(--pl-text-medium)] opacity-0 transition-[color,opacity] group-hover/row:opacity-100 group-hover/row:text-[var(--pl-primary)] hover:text-[var(--pl-primary)] focus-visible:opacity-100',

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
  /** `statusTag` 의 14px 판 — 확정 정보 표는 안의 모든 글자가 14px 이다(오너 2026-08-25).
      `cn` 은 단순 join 이라 뒤에 크기를 덧붙여도 이기지 못한다 — 크기가 다른 판을 따로 둔다. */
  statusTagLg:
    'inline-flex items-center rounded px-2 py-0.5 text-[14px] font-semibold tracking-[0.02em] whitespace-nowrap',

  /**
   * 최근 연결 테스트 밴드 — 사용자 화면 Step 5 카드(`idcStyles.connProgress`)의 문법을
   * 이 콘솔의 --pl-* 로 옮긴 것.
   *
   * 형태·간격·계층은 그쪽 그대로 두고 색만 갈아입힌다. 두 화면은 같은 실행을 말하므로
   * 같은 모양이어야 하지만, 색까지 같이 오면 운영 콘솔 안에 다른 팔레트의 섬이 생긴다.
   * 판정 로직도 나누지 않고 그대로 쓴다 — `lib/test-connection-summary` 한 벌이 문장·
   * 버킷·경과를 두 화면에 똑같이 준다.
   *
   * ⛔ 테두리는 상태를 입지 않는다. 이 팔레트의 계열 테두리(`--pl-ok-border` 등)는 같은
   * 계열 면(`--pl-ok-bg`)보다 훨씬 진해서, 22px 알약이 아니라 전폭 판에 두르면 면보다
   * 테두리가 먼저 읽힌다 — Step 5 가 면:테두리 비율을 지키느라 겪은 그 역전이다. 상태는
   * 면·제목색·글리프 셋이 이미 말하고 있으므로 테두리는 중립 헤어라인으로 남는다.
   */
  tcBand: {
    base: 'mt-4 rounded-[10px] border border-[var(--pl-border)] px-4 pt-[13px] pb-3.5 transition-colors',
    /** 국면이 입는 유일한 면. queued 는 running 과 같은 면을 쓴다 — 경고가 아니라 정상 단계다. */
    surface: {
      idle: 'bg-[var(--pl-gray-50)]',
      running: 'bg-[var(--pl-primary-bg)]',
      success: 'bg-[var(--pl-ok-bg)]',
      fail: 'bg-[var(--pl-err-bg)]',
      unknown: 'bg-[var(--pl-off-bg)]',
    },
    head: 'flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 mb-[11px]',
    /** 문장이 이 밴드의 제목이다 — 카드 제목(20px)과 본문(14px) 사이 한 단. */
    title: 'flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em] break-keep',
    titleColor: {
      idle: 'text-[var(--pl-text-strong)]',
      running: 'text-[var(--pl-text-strong)]',
      success: 'text-[var(--pl-ok-text)]',
      fail: 'text-[var(--pl-err-text)]',
      unknown: 'text-[var(--pl-text-medium)]',
    },
    accent: {
      idle: 'text-[var(--pl-text-weak)]',
      running: 'text-[var(--pl-primary)]',
      success: 'text-[var(--pl-ok-text)]',
      fail: 'text-[var(--pl-err-text)]',
      unknown: 'text-[var(--pl-text-weak)]',
    },
    icon: 'inline-grid place-items-center w-[18px] h-[18px] flex-shrink-0',
    /**
     * 시각 서브라인 — 문장의 근거라 문장 바로 아래 붙고, 제목의 18px 글리프 열에 맞춘다.
     *
     * 잉크는 `--pl-text-weak` 이었다(밴드 다섯 면에서 4.51~4.76:1, 브라우저 실측). 숫자로는
     * 4.5:1 을 넘지만 이 줄은 12px/500 이라 같은 비율의 14px 줄보다 훨씬 옅게 읽히고, 바로
     * 아래 사유 줄이 `--pl-text-medium`(9.49~10.01:1)이라 두 곁줄의 잉크가 두 배 넘게
     * 벌어져 있었다 — 오너가 "너무 흐리다"고 본 것이 그 격차다(2026-08-25).
     *
     * `--pl-gray-600` 은 램프의 다음 칸이다: 다섯 면 전부에서 6.97~7.36:1 로 5:1 을 넉넉히
     * 넘고, 사유 줄보다는 여전히 한 칸 아래라 곁줄 둘의 순서가 뒤집히지 않는다. 램프에
     * 5:1 짜리 칸은 없고, 한 줄을 위해 칸을 새로 만들지는 않는다. 시계 글리프는 이 span
     * 안에서 currentColor 를 상속하므로 같이 올라간다.
     */
    meta: 'flex items-center gap-2 text-[12px] font-medium tabular-nums text-[var(--pl-gray-600)]',
    /**
     * 밴드 안의 곁줄(사유). 상자가 아니라 맨 줄이다 — 카드 안에 상자를 또 두면 계층이
     * 아니라 같은 무게의 상자 둘이 된다.
     *
     * 들여쓰기는 없다 (오너 2026-08-25). 26px 을 물려 제목의 **글 열**에 맞춰 두었더니,
     * 위의 두 줄은 글리프에서 시작하는데 이 줄만 한 칸 안으로 들어가 밴드 왼쪽에 계단이
     * 생겼다. 대신 글리프를 제목과 같은 18px 열에 넣어 세 줄이 한 세로선에서 시작한다.
     */
    note: 'flex items-start gap-2 text-[14px] leading-[1.5] break-keep',
    /**
     * 카드 등급의 경고 줄 — 밴드 **밖**, 설명문과 밴드 사이. 여기 서는 것은 실행의 판정이
     * 아니라 다음 실행의 전제다(Credential 미설정). 상자가 아니라 맨 줄인 것은 밴드와 같은
     * 이유고, 들여쓰기(pl)는 없다 — 밴드에 딸린 줄이 아니라 카드의 줄이다.
     */
    cardNote:
      'mt-4 flex items-start gap-2 text-[14px] leading-[1.5] break-keep text-[var(--pl-warn-text)]',
    noteWarn: 'text-[var(--pl-warn-text)]',
    noteWeak: 'text-[var(--pl-text-medium)]',
    /** 곁줄 안의 원문 enum — 라벨과 같은 줄에 mono 로 병기한다. */
    noteRaw: 'text-[12px] text-[var(--pl-text-weak)]',
    /**
     * 곁줄의 토글 링크 — 밑줄이 affordance 를 지고 색은 줄에서 상속한다.
     *
     * 문장 **바로 뒤**에 붙는다. 카드 폭 끝으로 밀면(ml-auto) 1000px 건너편에 서서, 무엇을
     * 거르는 링크인지 문장과 함께 읽히지 않는다 — Step 5 는 이 줄이 자기가 거르는 표 바로
     * 위에 있어서 우측 정렬이 표의 컨트롤로 읽히지만, 여기선 위에 표가 없다.
     */
    noteAction: 'shrink-0 cursor-pointer whitespace-nowrap text-[14px] font-semibold underline underline-offset-2',
    /**
     * 진행 트랙. 바닥값(`--pl-gray-200`)이 Step 5 트랙과 **같은 값**이라, 위에 깔리는 행진
     * 무늬(`idcStyles.connProgress.trackMarch`)의 대비 1.42:1 이 그대로 보존된다 —
     * 그 값은 브라우저에서 넷을 1:1로 놓고 고른 것이라 다시 고르지 않는다.
     */
    track: 'relative h-2 overflow-hidden rounded-full bg-[var(--pl-gray-200)]',
    fillOk: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-ok)]',
    fillFail: 'h-full transition-[width] duration-[250ms] ease-out bg-[var(--pl-err)]',
    /** 카운트 줄 — 세그먼트 문법(점 · 라벨 · 굵은 수). */
    counts: 'flex items-center gap-3 text-[12px] font-medium tabular-nums text-[var(--pl-text-weak)]',
    countSeg: 'flex items-center gap-1.5',
    countValue: 'text-[14px] font-bold tabular-nums',
    countDot: 'h-2 w-2 rounded-full flex-shrink-0',
    countDotOk: 'bg-[var(--pl-ok)]',
    countDotFail: 'bg-[var(--pl-err)]',
    countDotRest: 'bg-[var(--pl-text-faint)]',
    /** 값이 없다는 사실은 색이 아니라 형태가 말한다 — 채운 점이 아니라 파선 링. */
    countDotMissing: 'h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--pl-warn-text)] flex-shrink-0',
    okValue: 'text-[var(--pl-ok-text)]',
    failValue: 'text-[var(--pl-err-text)]',

  },
} as const;
