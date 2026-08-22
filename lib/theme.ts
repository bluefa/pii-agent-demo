/**
 * 디자인 토큰 시스템
 *
 * 이 파일은 UI 스타일을 중앙에서 관리합니다.
 * Look & Feel 변경 시 이 파일만 수정하면 됩니다.
 *
 * `colorRaw` (below) holds raw hex values; the Tailwind class strings
 * (primaryColors, statusColors, ...) reuse the same hex literals. Keep them
 * in sync — the class strings cannot be derived from `colorRaw` because
 * Tailwind's class extraction is static.
 */

// =============================================================================
// Raw color SSOT — used by RAF color interpolation (motion.colors)
// =============================================================================

export const colorRaw = {
  primary: '#0064FF',
  primaryDark: '#0050D6',
  success: '#45CB85',
  successDark: '#2A7D52',
  pendingBg: '#F3F4F6',
  pendingText: '#9CA3AF',
  connectorTrack: '#E5E7EB',
  white: '#FFFFFF',
} as const;

/**
 * Toss surface/text tokens (v15 2nd `:root`, design/v15-extract/00-tokens.md).
 * The target-source screens are "Toss-flavored" and consume THESE exact hexes;
 * previously scattered inline across components. Named here as the SSOT.
 */
export const tossColors = {
  /** Toss black — strongest text. */
  strongText: '#191F28',
  /** Medium body text. */
  mediumText: '#4E5968',
  /** Weak text — captions, table headers, keys. */
  weakText: '#8B95A1',
  /** Faint text — connectors, separators. */
  faintText: '#B0B8C1',
  /** Nested surface inside cards. */
  innerBg: '#F7F8FA',
  /** Divider between rows / cells. */
  divider: '#EBEEF2',
} as const;

/**
 * Toss 2-layer card shadow (--toss-shadow-sm, 00-tokens.md). Arbitrary-value
 * utility string for consumption via Tailwind `shadow-[...]`.
 */
export const tossShadow = {
  sm: 'shadow-[0_1px_2px_rgba(17,24,39,0.04),0_4px_16px_-8px_rgba(17,24,39,0.06)]',
  /** One step up from `sm` — same 2-layer shape, roughly doubled presence. For
   *  small white cards that must read as raised on an already-white surface. */
  md: 'shadow-[0_1px_3px_rgba(17,24,39,0.06),0_8px_20px_-8px_rgba(17,24,39,0.12)]',
  /** One step up from `md` — clearly lifted, still soft-edged. */
  lg: 'shadow-[0_2px_4px_rgba(17,24,39,0.08),0_12px_28px_-8px_rgba(17,24,39,0.18)]',
} as const;

// =============================================================================
// 색상 (Colors)
// =============================================================================

/**
 * Primary 색상 — 주요 액션, 링크, 강조에 사용
 * 모든 값이 완성된 Tailwind 클래스 (동적 조합 금지)
 */
export const primaryColors = {
  bg: 'bg-[#0064FF]',
  bgHover: 'hover:bg-[#0050D6]',
  bgLight: 'bg-[#E8F1FF]',
  bg50: 'bg-blue-50',
  bg100: 'bg-blue-100',
  text: 'text-[#0064FF]',
  /**
   * Primary text ON `bgLight` (#E8F1FF). `text` cannot be used there: #0064FF holds 4.92:1 on
   * white but drops to 4.33:1 on the tint, under AA for text below 18px. #0050D6 gives 5.92:1.
   */
  textOnLight: 'text-[#0050D6]',
  /**
   * Fill for a clickable row under pointer hover *or* keyboard focus — same tint as
   * `bgLight`, so pair with `textOnLight`. Both variants together: a row that only
   * lights up on hover leaves keyboard users without the state pointer users get.
   */
  bgLightActive: 'hover:bg-[#E8F1FF] focus-visible:bg-[#E8F1FF]',
  /** `textOnLight` driven by an ancestor `group`'s hover/focus — pairs with `bgLightActive`. */
  groupTextOnLight: 'group-hover:text-[#0050D6] group-focus-visible:text-[#0050D6]',
  textHover: 'hover:text-[#0050D6]',
  textHoverBase: 'hover:text-[#0064FF]',
  text700: 'text-blue-700',
  textDark: 'text-blue-900',
  border: 'border-[#0064FF]',
  border100: 'border-blue-200',
  borderLight: 'border-blue-100',
  borderHoverBase: 'hover:border-[#0064FF]',
  focusRing: 'focus:ring-[#0064FF]',
  haloRing: 'shadow-[0_0_0_4px_rgba(0,100,255,0.18)]',
  haloRingSoft: 'shadow-[0_0_0_6px_rgba(0,100,255,0.10)]',
  marker: 'marker:text-[#0064FF]',
  /**
   * Row/card hover tint driven by an ancestor `group`. Uses the DARK primary: #0064FF scores
   * 4.92:1 on white but only 4.46:1 once a hover background sits under it, which is below AA
   * for text under 18px. #0050D6 holds 5.79:1 on the table's hover tint.
   */
  textGroupHover: 'group-hover:text-[#0050D6] group-focus-within:text-[#0050D6]',
  /** Progress-bar fill — brand blue drifting to indigo along the run. */
  barGradient: 'bg-gradient-to-r from-[#0064FF] to-[#4F46E5]',
} as const;

/**
 * 스캔 완료 전환 (app/globals.css @keyframes scan-*). 진행 UI가 결과로 바뀌는
 * 순간을 확인 프레임 → fade-through 의 두 박자로 늘린다.
 * 타이밍의 주인은 useScanCompletionTransition, 표현의 주인은 이 토큰들이다.
 */
export const scanTransition = {
  /** 결과 뷰 입장 — 확인 프레임이 퇴장한 뒤 이어지는 200ms. */
  reveal: 'motion-safe:animate-[scan-reveal_200ms_ease-out]',
  /** 완료 체크 드로우. stroke-dasharray 를 가진 path 에만 건다. */
  checkDraw: 'motion-safe:animate-[scan-check-draw_300ms_ease-out]',
} as const;

/**
 * Step 5 진행 중 글리프의 신호 행진 — ActivityIcon 의 밝은 마디에만 건다.
 * 트랙 path 는 애니메이션 없이 깔려 있어 모션이 꺼져도 파형이 남는다.
 */
export const tcActivityMarch = 'motion-safe:animate-[tc-activity-march_1400ms_linear_infinite]';

/**
 * Step 5 시작 대기 글리프의 모래 — HourglassIcon 에만 건다. 셋이 한 기계라 세 클래스를
 * 함께 걸어야 뜻이 성립한다: 유리만 돌면 모래가 중간에 멈춘 채 뒤집히고, 모래만 흐르면
 * 다 떨어진 유리가 그대로 서 있다. 그래서 호출부에 흩지 않고 아이콘 안에서 셋을 건다.
 * duration 이 셋 다 같아야 이음매(72%)가 맞는다 — app/globals.css 의 ⛔ 주석 참조.
 *
 * 모션이 꺼지면 위가 찬 정지 모래시계가 남는다(빈 상태는 SVG transform 속성이 들고,
 * CSS 애니메이션이 그 위를 덮는 구조라 motion-reduce 에서 저절로 시작 프레임이 된다).
 */
export const tcHourglass = {
  glass: 'motion-safe:animate-[tc-hourglass-flip_1400ms_ease-in-out_infinite]',
  /** 위 벌브 — 수위가 목으로 내려간다. */
  drain: 'motion-safe:animate-[tc-hourglass-drain_1400ms_linear_infinite]',
  /** 아래 벌브 — 같은 박자로 쌓인다. */
  fill: 'motion-safe:animate-[tc-hourglass-fill_1400ms_linear_infinite]',
  /**
   * 모래. 유리(currentColor = `accent.running` #0064FF)와 갈라지는 유일한 잉크다.
   *
   * ⛔ 이 카드에서 amber 는 임자가 있다 — `connProgress` 의 pending 표면(정책 변경)이
   * 점 #E8A03A · 잉크 #B45309 로 경고를 말하고, `SURFACE` 주석은 queued 를 그 계열에서
   * **일부러 빼 놓았다**("경고(amber)가 아니라 정상 단계라"). 그래서 모래는 그 둘 중
   * 어느 값도 쓰면 안 된다. #E8A03A 는 색상각 33°(주황)이고 이 값은 45°(노랑)라, 같은
   * 화면에 서도 «경고 점»이 아니라 «모래»로 갈린다. 더 주황으로 끌면 그 구분이 없어진다.
   *
   * 재료색이지 상태색이 아니다 — 국면은 문장·글리프 형태가 말하고, 이 잉크는 모래가
   * 모래라는 것만 말한다. 그래서 표면따라 바뀌지 않고 고정이다.
   */
  sand: 'fill-[#DDB13C]',
} as const;

/**
 * 상태 색상 (CLAUDE.md 규칙 준수)
 * - success (#45CB85): 연결됨, 완료
 * - error (red-500): 끊김, 에러
 * - warning (orange-500): 진행중, AWS
 * - pending (gray-400): 대기중
 * - info (blue-500): 신규
 */
export const statusColors = {
  success: {
    bg: 'bg-[#45CB85]/10',
    text: 'text-[#2A7D52]',
    textDark: 'text-[#2A7D52]',
    border: 'border-[#45CB85]/30',
    dot: 'bg-[#45CB85]',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-500',
    textDark: 'text-red-800',
    border: 'border-red-300',
    /**
     * Load-bearing error edge — a rule that carries the state on its own, with no tinted
     * surface behind it (see `warning.borderStrong` for the full reasoning). red-600 holds
     * 4.05:1 on white, clearing the 3:1 non-text floor (WCAG 1.4.11); the `border` tier
     * (red-300) does not.
     */
    borderStrong: 'border-red-600',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-orange-100',
    /** Weakest warning surface — a tinted panel/banner, one step below `bg`. */
    bgSoft: 'bg-orange-50',
    text: 'text-orange-500',
    textDark: 'text-orange-800',
    border: 'border-orange-300',
    /**
     * Load-bearing warning edge — a rule or bar that carries the state on its own, with no
     * tinted surface behind it. orange-600, not the `border` tier (orange-300, 1.7:1) or
     * orange-500 (2.80:1): a mark that IS the signal must clear the 3:1 non-text floor
     * (WCAG 1.4.11), and orange-600 holds 3.56:1 on white.
     */
    borderStrong: 'border-orange-600',
    dot: 'bg-orange-500',
  },
  pending: {
    bg: 'bg-gray-100',
    text: 'text-gray-400',
    textDark: 'text-gray-600',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
  info: {
    bg: 'bg-blue-100',
    bgLight: 'bg-blue-50',
    text: 'text-blue-500',
    textDark: 'text-blue-800',
    border: 'border-blue-300',
    borderLight: 'border-blue-200',
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
  },
} as const;

/**
 * Cloud Provider 브랜드 색상
 */
export const providerColors = {
  AWS: {
    border: 'border-[#FF9900]',
    bg: 'bg-[#FF9900]/5',
    text: 'text-[#FF9900]', // design-exempt: brand logotype (WCAG 1.4.11)
    bar: 'bg-[#FF9900]',
    gradient: 'bg-gradient-to-r from-[#FF9900] via-[#FFA936] to-[#FFC266]',
  },
  Azure: {
    border: 'border-[#0078D4]',
    bg: 'bg-[#0078D4]/5',
    text: 'text-[#0078D4]',
    bar: 'bg-[#0078D4]',
    gradient: 'bg-gradient-to-r from-[#0078D4] via-[#2E90E8] to-[#5CA9F5]',
  },
  GCP: {
    border: 'border-[#4285F4]',
    bg: 'bg-[#4285F4]/5',
    text: 'text-[#4285F4]', // design-exempt: brand logotype (WCAG 1.4.11)
    bar: 'bg-[#4285F4]',
    gradient: 'bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC04]',
  },
  IDC: {
    border: 'border-gray-700',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    bar: 'bg-gray-700',
    gradient: 'bg-gradient-to-r from-gray-800 via-gray-600 to-gray-400',
  },
  SDU: {
    border: 'border-purple-600',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    bar: 'bg-purple-600',
    gradient: 'bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-500',
  },
} as const;

/**
 * 텍스트 색상
 */
export const textColors = {
  primary: 'text-gray-900',
  secondary: 'text-gray-700',
  /** The quietest tier available to text: 4.83:1 on white, 4.63:1 on gray-50. */
  tertiary: 'text-gray-500',
  /**
   * Decorative only — empty-state glyphs, the icon inside a labelled input, a `·`
   * between meta groups. Never text, and never a control's only glyph: gray-400 is
   * 2.54:1 on white, under AA's 4.5:1 for text *and* under 1.4.11's 3:1 for a
   * meaningful graphic. If removing it would cost the user information, it does not
   * belong on this token — use `tertiary`.
   */
  quaternary: 'text-gray-400',
  inverse: 'text-white',
} as const;

/**
 * 배경 색상
 */
export const bgColors = {
  muted: 'bg-gray-50',
  /**
   * 카드 안에 앉는 레일·사이드 패널 — muted 보다 한 단계 가라앉은 표면.
   * gray-100 위에서 gray-500(tertiary)은 4.37:1 로 AA 미달: 이 표면 위의
   * 텍스트는 secondary(gray-700) 이상을 쓴다.
   */
  panel: 'bg-gray-100',
  mutedHover: 'hover:bg-gray-50',
  /** `muted` 면 위에 앉은 버튼의 hover — 같은 면 위에서 `mutedHover` 는 보이지 않는다. */
  panelHover: 'hover:bg-gray-100',
  primary: 'bg-[#0064FF]',
  surface: 'bg-white',
  surfaceHover: 'hover:bg-white',
  divider: 'bg-gray-200',
  strong: 'bg-gray-300',
} as const;

/**
 * 보더 색상
 */
export const borderColors = {
  light: 'border-gray-100',
  default: 'border-gray-200',
  strong: 'border-gray-300',
  /**
   * The only neutral border that clears WCAG 1.4.11 (3:1) against light grounds —
   * 4.63:1 on gray-50, 5.9:1 on white, where `strong` manages 1.4:1. Use it when the
   * border *is* the state indicator, not when it merely separates.
   */
  emphasis: 'border-gray-500',
  /**
   * Outline for a card that repeats down a list on the tinted canvas. `default`
   * measures 1.13:1 against #F4F4FB — the eye separates those cards on their 4.1
   * ΔE00 of fill alone, and the line contributes nothing. This one reads 1.27:1
   * on the canvas and 1.39:1 on the card, roughly doubling the line's share of
   * the edge without darkening it into a table rule.
   */
  card: 'border-[#D6DBE6]',
} as const;

/**
 * 인터랙티브 요소 색상
 */
export const interactiveColors = {
  closeButton: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  inactiveTab: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
  /** Underline tab without hover-border (Guide CMS provider tabs) */
  underlineTab: 'border-transparent text-gray-500 hover:text-gray-900',
  unselectedBorder: 'border-gray-200 hover:border-gray-300',
  unselectedText: 'text-gray-600 hover:border-gray-300',
} as const;

// =============================================================================
// 컴포넌트 스타일 (Component Styles)
// =============================================================================

/**
 * 버튼 스타일
 */
export const buttonStyles = {
  /** v15 .btn — radius 12, weight 700, h40, 14px, ls -0.01em, :active scale(.97). */
  base: 'px-4 h-10 rounded-[12px] font-bold text-[14px] tracking-[-0.01em] transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
  variants: {
    primary: 'bg-[#0064FF] text-white hover:bg-[#0050D6] shadow-sm hover:shadow',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow',
    success: 'bg-[#45CB85] text-white hover:bg-[#3AB574] shadow-sm hover:shadow',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    /** Soft Primary — light blue fill + primary text (결정 #58, secondary CTA). */
    soft: 'bg-blue-50 text-[#0050D6] hover:bg-blue-100',
    /**
     * Outline primary — brand stroke + brand text on white, no fill. Reads as a CTA
     * without spending the one filled button a card is allowed (Primer: primary is
     * rarely more than one per page). Same role the admin console calls `pl.button.outline`.
     */
    outline: 'bg-white text-[#0064FF] border border-[#0064FF] hover:bg-[#EFF6FF]',
    /** Warn outline — amber outline for overwrite/reload actions (결정 #42). */
    warnOutline: 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100',
    /** v15 danger-outline — soft red fill, no border (#FEF2F2 / #991B1B / 600). */
    dangerOutline: 'bg-[#FEF2F2] text-[#991B1B] font-semibold border-0 hover:bg-[#FEE2E2]',
    /**
     * Ink CTA — for a page where blue is already load-bearing elsewhere (rail selection,
     * per-row detail links). A blue button on such a page reads as more background blue;
     * ink is the only value on screen that nothing else is using.
     */
    ink: 'bg-[#191F28] text-white hover:bg-[#333D4B] shadow-sm hover:shadow',
  },
  sizes: {
    /** v15 .btn.sm — radius 10, h32, 13px. */
    sm: 'px-3 h-8 rounded-[10px] text-[13px]',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  },
  /**
   * Ghost text action — a secondary action that steps back from button chrome
   * into underlined-link syntax, so the only button chrome on a band belongs to
   * its one real CTA. Pair with a `textColors` tier for the resting colour.
   */
  ghostText:
    'text-[13px] font-semibold underline underline-offset-[3px] decoration-[#D1D6DB] transition-colors hover:text-[#191F28] disabled:cursor-not-allowed disabled:opacity-60',
} as const;

/**
 * 카드 스타일
 */
/**
 * 설치 단계의 주체(서비스측 / BDC측) — 태그가 아니라 글자색으로만 가른다.
 * 목차·표에서 항목마다 반복되는 값이라 채운 배지를 두면 색이 내용을 이긴다.
 * 두 값 모두 흰 바닥에서 AA 를 넘는 800 단계다.
 */
export const sideTextColors = {
  service: 'text-blue-800',
  bdc: 'text-indigo-800',
} as const;

/**
 * 리소스 행의 판정(대상 / 제외 / 연동 불가) — sideTextColors 와 같은 규칙으로, 태그가 아니라 글자다.
 * 행마다 반복되는 값이라 채운 배지를 두면 색 덩어리가 내용보다 먼저 읽힌다.
 *
 * 세 값이 대등할 필요는 없다:
 * - `target` 은 기본값이라 목록의 대부분을 차지한다. 아이콘도 색도 주지 않고 본문 2차 색(7.1:1)에
 *   무게만 500 으로 둔다 — 여기에 색을 쓰면 정상을 강조하느라 예외가 묻힌다.
 * - 찾아내야 하는 두 값만 왼쪽 아이콘 + 색을 갖는다. **아이콘의 유무가 첫 번째 신호**이고,
 *   두 값은 서로 다른 도형(원-사선 / 삼각)이라 색을 빼도 갈린다(WCAG 1.4.1).
 *
 * 색 선택 (제외 = 마젠타 #C11574, 5.8:1):
 *   회색은 원래 문제였고(제외가 안 보인다), 남은 의미 축은 대부분 차 있다 —
 *   초록=정상 / 앰버=연동 불가 / 빨강=실패 / #0064FF=누를 수 있는 것.
 *   제외는 실패가 아니라 사람이 내린 결정이라 그 어느 칸에도 안 맞아, 앱에서 비어 있는 축을 쓴다.
 *   `ineligible` 은 기존 statusColors.warning.textDark(#B45309, 5.0:1)를 그대로 잇는다.
 */
export const verdictText = {
  base: 'inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold',
  /** 기본값 — 아이콘 없음, 한 단 낮은 무게. */
  target: 'text-[#4E5968] font-medium',
  excluded: 'text-[#C11574]',
  ineligible: 'text-[#B45309]',
  icon: 'h-3.5 w-3.5 flex-shrink-0',
} as const;

/**
 * 제외 행 왼쪽 끝 4px 상태 레일 — 배경 틴트가 못 하는 일을 대신한다.
 *
 * 틴트(#F9FAFB)는 흰 바탕과 1.05:1 이라 WCAG 1.4.11 의 3:1 근처에도 못 간다. 배경은 면적이 넓어서
 * 신호로 쓸 만큼 진하게 하면 그 위 본문 글자의 대비를 갉아먹는다 — 4px 막대는 면적이 좁아
 * 고채도 색을 대비 손실 없이 실을 수 있고, 스캔 시작점인 왼쪽 끝에 있어 눈이 행을 횡단하지 않아도 된다.
 *
 * `target` 은 색이 없다: 침묵이 곧 정상이다.
 * 레일 색은 판정 글자색과 같은 축이되 채도를 낮춘 값 — 행 단위 신호는 훑기용이라 글자만큼 셀 필요가 없다.
 *
 * 열이 아니라 첫 셀의 inset box-shadow 다. 전용 <td> 를 하나 세우면 여섯 개 테이블의 헤더·
 * 그룹 부모행·인스턴스행·접힌 멤버행이 전부 colSpan 을 다시 세어야 하고, 한 군데만 놓쳐도 열이
 * 어긋난다. inset 그림자는 레이아웃을 전혀 건드리지 않아 기존 셀 padding(18px, 이름 열은 30px)
 * 안쪽에 그려지고, x 0..4 를 쓴다 — 이름 열에 걸린 셰브론(박스 x 8..24, hit halo x 4..28)과도,
 * 그룹 트리 레일(::before/::after, x=16)과도 겹치지 않는다. 셰브론이 x 4 에서 시작하던 동안에는
 * 레일과 맞붙어(제외된 RDS 클러스터에서 파란 컨트롤이 자홍 막대에 붙은 것으로) 읽혔다 —
 * "닿지 않는다"가 아니라 "떨어져 있다"가 이 주석의 불변식이다.
 */
export const verdictRail = {
  target: '',
  excluded: 'shadow-[inset_4px_0_0_0_#D6409F]',
  ineligible: 'shadow-[inset_4px_0_0_0_#D97706]',
} as const;

/** 행의 첫 셀에 얹을 레일 클래스. 대상 행은 빈 문자열 — 침묵이 곧 정상이다. */
export const verdictRailClass = (excluded: boolean, ineligible = false): string =>
  ineligible ? verdictRail.ineligible : excluded ? verdictRail.excluded : verdictRail.target;

/**
 * 리소스 테이블 행 상태(hover/제외) — WaitingApprovalTable 이 재수출해 여러 테이블이 공유.
 * 값의 근거 (PR #593):
 * - 틴트는 중립 회색이 아니라 옅은 파랑. hover 시 Resource Name 이 브랜드 블루로 바뀌는데,
 *   중립 회색 위에서는 그 셀 하나만 변한 것으로 읽히고, 옅게 파란 행은 하나의 활성 객체로
 *   읽힌다. 깊이는 중립 팔레트 단계 #EBEEF2 와 동일(1.16:1 vs white) — 추가 값은 어둡기가
 *   아니라 색상(hue)을 사고, 텍스트 대비 비용은 거의 없다(#0050D6 5.79:1, #191F28 14.25:1).
 * - 채도는 의도적으로 낮다: primary 틴트 #E8F1FF 와 같은 휘도(1.01:1 차이)에 앉아 있어,
 *   "hovered"와 "primary"를 가르는 것은 채도뿐이다. 따라서 미래의 `selected` 상태는
 *   파란 틴트를 쓰면 안 된다 — hover 가 이미 그 축을 점유했다.
 * - 각 상태가 자기 색 두 벌(기본/hover)을 모두 소유한다: base 는 색을 갖지 않는다.
 */
export const tableRowLift = {
  // `group/row` in addition to the bare `group`: `cellText` below is a plain `group-hover:`
  // and needs `.group`, while `chipEdge` must fire for ROWS ONLY and named groups are the
  // only way to say that — a bare `group-hover:` answers to any `.group` ancestor anywhere.
  base: 'group group/row transition-colors duration-150 motion-reduce:transition-none',
  target: 'hover:bg-[#EAEEF7] focus-within:bg-[#EAEEF7]',
  /**
   * Confirmed/console tables (round 5). The prototype the owner approved hovers at
   * #F7F9FB, not the approval tables' #EAEEF7 — and the quieter value is load-bearing
   * now: the console grid's border-default rails hold 1.19:1 under this tint but wash
   * to 1.08:1 under #EAEEF7, and the covered-clip cut needs its boundary exactly while
   * the row is being read. `cellText` still applies — #191F28 only gains contrast here.
   */
  console: 'hover:bg-[#F7F9FB] focus-within:bg-[#F7F9FB]',
  // 틴트가 아니라 `verdictRail` 이 제외를 표시한다 — #F9FAFB 는 흰 바탕과 1.05:1 이라
  // WCAG 1.4.11 의 3:1 근처에도 못 가서, 행 단위 신호로는 처음부터 작동한 적이 없다.
  // 진하게 올리는 대신 오히려 낮췄다: 배경은 면적이 넓어 신호가 될 만큼 진해지면 그 위
  // 본문 글자의 대비를 갉아먹고, 좁은 레일은 같은 일을 대비 손실 없이 한다.
  // 남긴 이유는 행 묶기 — 연속된 제외 행이 하나의 덩어리로 읽힌다.
  excluded: 'bg-[#FBFCFD] hover:bg-[#E3E8F2] focus-within:bg-[#E3E8F2]',
  /** hover 행의 셀 텍스트 승격 — #4E5968 → #191F28 (6.12:1 → 14.25:1 on the hover tint). */
  cellText: 'group-hover:text-[#191F28] group-focus-within:text-[#191F28]',
  /**
   * hover 동안에만 나타나는 칩 테두리 — 행 안의 모든 칩(kind 태그·Reader/Writer·선택됨·
   * 상태 pill)이 공유한다.
   *
   * 칩 어휘 전체가 L* 88.7..96.2 에 모여 있는데 두 hover 틴트가 L* 92.0/94.0 으로 그 안에
   * 앉는다. 즉 어떤 칩 하나가 아니라 **모든 칩**이 커서 아래에서 틴트와 등휘도가 된다
   * (gray-100 1.06:1 · 선택됨 1.02:1 · orange-100 1.01:1 · blue/red-100 1.05:1).
   * 틴트를 옮겨서 푸는 길은 없다: 밴드 폭이 7.5 L* 라 안쪽 어디에 두든 무언가와 부딪히고,
   * 밴드 아래로 내리면 승격 대상이 아닌 판정 글자(#B45309)가 AA 밑으로 떨어진다.
   *
   * 그래서 움직이는 쪽은 칩이고, 움직이는 것은 면이 아니라 **경계**다. 검정 15% 를 칩 자기
   * 면 위에 얹으므로 8종 각각이 자기 색조를 어둡게 한 테두리를 갖는다 — 어떤 칩에도 남의
   * 색을 들여오지 않는다. 최악값도 바깥 틴트와 1.33:1, 안쪽 자기 면과 1.40:1 이라, 등휘도
   * 경계가 잃어버린 '양쪽 모두에 대한 명도차'를 1px 선이 되돌려준다.
   *
   * inset 이라 레이아웃을 건드리지 않는다(box-shadow 다) — 행 기하는 이미 맞춰져 있고
   * 칩이 커지면 `stackedIdentityLift` 의 12px 계산이 어긋난다. rest 에서는 아무것도 그리지
   * 않는다: 흰 행 위에서 칩은 이미 판으로 읽히므로, 크롬은 필요한 순간에만 존재한다.
   */
  chipEdge:
    'group-hover/row:ring-1 group-hover/row:ring-inset group-hover/row:ring-black/15 group-focus-within/row:ring-1 group-focus-within/row:ring-inset group-focus-within/row:ring-black/15',
  /**
   * Card-row hover on the tinted canvas — violet, originally lifted byte-for-byte
   * from the EC2 tag's surface so the two would land in one family. They still
   * share the family; they no longer share the value. `tagStyles.resourceKind`
   * moved to #E4DAFB because a chip whose fill EQUALS the row under the cursor
   * has no edge left (ΔE00 0), and a tag has to survive the surface it sits on
   * while this tint only has to separate from the card and the canvas.
   *
   * `bg-gray-50` measured ΔE00 1.20 from the white card: under the ~2.3 threshold
   * at which two colours are seen as different at all, so the whole card was a
   * click target announcing nothing. Violet buys the separation on CHROMA rather
   * than on level (ΔE00 8.92 from the card, 5.21 from the canvas, and only 5 L*
   * of darkening), which is what keeps the text on the card legible.
   *
   * Pair it with `cellText` on anything at `textColors.tertiary`: gray-500 reads
   * 4.26:1 on this tint, under AA.
   */
  card: 'hover:bg-[#F3EEFF] focus-within:bg-[#F3EEFF]',
} as const;

export const cardStyles = {
  /** v15 Toss card — radius 20 + 2-layer toss-shadow-sm. */
  base: 'bg-white rounded-[20px] shadow-[0_1px_2px_rgba(17,24,39,0.04),0_4px_16px_-8px_rgba(17,24,39,0.06)]',
  padding: {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  },
  /** v15 header — 28/28/12 padding, no base border. */
  header: 'pt-[28px] px-[28px] pb-[12px]',
  /** v15 card body — 16/28/28 padding. */
  body: 'pt-[16px] px-[28px] pb-[28px]',
  /** @deprecated Use cardStyles.eyebrow for the small uppercase header role. */
  title: 'text-sm font-semibold text-gray-500 uppercase tracking-wide',
  /** Small uppercase header above a card display title (ADR-014 card-eyebrow). */
  eyebrow: 'text-[12px] font-bold text-[#0064FF] tracking-[0.02em]',
  /** Large display heading inside a card header (ADR-014 card-display-title). */
  displayTitle: 'text-[26px] font-extrabold text-[#191F28] tracking-[-0.045em] leading-[1.2]',
  /** In-card section / step-card title — v15 display geometry (26 / 800 / -0.045em / #191F28). */
  // 22px sits BELOW the 24px page H1 (pageHeaderTitleStyle) — the unified header
  // introduced a page-level title above every step card, so the step title must
  // read as a section heading, not compete with the page identity (was 26px).
  // Tracking is -0.01em, not the -0.03em latin display type takes: Korean glyphs are already dense,
  // so tighter tracking reads as cramped instead of as a tightened headline.
  cardTitle: 'text-[22px] font-extrabold tracking-[-0.01em] leading-[1.2] text-[#191F28]',
  /**
   * "N단계" tag above a step-card title, matching INSTALL_STEPS order in
   * InstallationProcessProgressBar. Was copy-pasted into every step card with a "keep the two in
   * sync" note; six cards (cloud 1·2·3, IDC 1·2·3 + 6) is where that stops being a note.
   */
  stepTag: `mb-1.5 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold ${primaryColors.bgLight} ${primaryColors.textOnLight}`,
  /** State pill beside a step title (승인 대기 / 반영중). Shape only — the caller owns the tone. */
  stepBadge: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
  /**
   * Step-card guidance paragraph — what happened and what to do next, one tier under the title.
   * 16px rather than the 14px `subtitle`: this copy is read, not skimmed. Declared as its own
   * token because `cn` is a plain join, so layering a size over `subtitle` left the winner to CSS
   * order — every step card had re-declared the size inline to dodge that.
   */
  guidance: `text-[16px] font-medium leading-[1.55] ${textColors.tertiary}`,
  /** Paragraph beneath a display title (ADR-014 card-subtitle) — 14/500/#6B7684. */
  subtitle: 'text-[14px] font-medium text-[#6B7684] leading-[1.55]',
  /** Inline "Provider: X" indicator in a card header — weak label + strong name. */
  providerTag: 'text-[12px] text-[#6B7684]',
  providerTagName: 'text-[#191F28]',
  /** Guide CMS editor wrapper — single border + radius-8 + overflow-hidden */
  editorFrame: 'border border-gray-200 rounded-lg bg-white overflow-hidden',
  /** Toolbar surface — muted bg sitting above the Tiptap area */
  toolbarSurface: 'flex items-center gap-1 bg-gray-50 border-b border-gray-200 px-2 py-1.5',
  /** 30×30 toolbar button (idle) — paired with toolbarBtnActive when pressed */
  toolbarBtn:
    'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-gray-600 transition-colors hover:bg-white hover:text-gray-900',
  /** Active toolbar button — white card + soft pill shadow */
  toolbarBtnActive: 'bg-white text-[#0064FF] shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  /** GuideCard 용 warm(amber) variant — SIT 프로토타입 */
  warmVariant: {
    container: 'bg-amber-50/40 border-amber-200',
    header: 'bg-gradient-to-b from-amber-100/50 to-amber-50/30 border-b border-amber-200',
    icon: 'bg-amber-500 text-white',
    titleText: 'text-amber-900',
    body: 'text-gray-600',
    skeletonHeader: 'bg-amber-200/40 border-b border-amber-200/40',
    skeletonBar: 'bg-amber-200/60',
  },
} as const;

/**
 * Variant chip — small label inline with row text (AUTO / MANUAL / 준비 중).
 */
export const chipStyles = {
  /**
   * 12px, not 11: 이 칩(설치 모드·중국 리전)은 옆의 12px 라벨과 한 줄에 서는데
   * 11px 이면 라벨보다 한 눈금 작아 값이 이름보다 작아 보였다. 11 은 홀수라
   * 디자인 규칙에도 어긋난다.
   */
  base: 'inline-flex items-center px-1.5 py-0.5 rounded-md text-[12px] font-semibold',
  variant: {
    auto: 'bg-blue-50 text-blue-700 border border-blue-200',
    manual: 'bg-amber-50 text-amber-800 border border-amber-200',
    prep: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
} as const;

/**
 * Pill segmented control — shared by editor lang tabs and preview lang toggle.
 */
export const segmentedControlStyles = {
  container: 'inline-flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 gap-0.5',
  item:
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 rounded-md transition-colors hover:text-gray-700',
  itemActive: 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
} as const;

/**
 * Page chrome — breadcrumb / title / subtitle stack above ProviderTabs.
 * Values track DESIGN.md page-title / page-breadcrumb / page-subtitle (ADR-014).
 */
export const pageChromeStyles = {
  breadcrumb: 'text-xs text-gray-500 px-6 pt-5 font-medium',
  title: 'text-[24px] font-extrabold tracking-[-0.03em] text-gray-900 px-6 mt-1 leading-[1.2]',
  subtitle: 'text-sm text-gray-500 px-6 mt-2 mb-6',
} as const;

/** PageHeader h1 — v15 page-title geometry (24/800/-0.03em/1.2), toss strong text color. */
export const pageHeaderTitleStyle =
  'text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#191F28]';

/** Muted suffix inside the page H1 (e.g. the "(serviceCode)" parens) — inherits the H1 size, weak Toss gray. */
export const pageHeaderTitleMutedStyle = 'font-medium text-[#6B7684]';

/** "인프라 삭제" chip — quiet danger-outline (red-50 fill, red-200 border, red-800 text). */
export const deleteInfraButtonStyle =
  'inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100';

/**
 * Page-meta horizontal kv strip (Toss display variant).
 * See ADR-014 D1; consumer rollout starts in Wave 1.
 */

/**
 * What survives of the v15 `.identity-bar` (01-chrome.md 752–855): the copy
 * affordance, now on the flat page header's mono identifiers. The bar itself
 * is gone — the target-source detail header replaced it.
 */
export const identityBarStyles = {
  copyBase:
    'inline-grid place-items-center w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer transition-[background-color,color] duration-[120ms]',
  copyIdle: 'text-[#6B7684] hover:bg-[#F7F8FA] hover:text-[#191F28]',
  copyCopied: 'text-[#2A7D52]',
} as const;

/**
 * OpenType numeric features — tabular alignment for step numbers, etc.
 */
export const numericFeatures = {
  tabular: 'tabular-nums',
} as const;

/**
 * Target-source detail flat page header — chrome, not a card. Replaces the v16
 * meta card (rounded-20 + shadow) so only step content keeps card chrome.
 *
 * Rules this group encodes:
 * - The header itself paints no surface (C3, owner pick 2026-08-09) — it sits on
 *   the route layout's #F4F4FB wash and the boundary to the body is distance.
 *   The ONE exception is the 설치 대상 summary card below, which the owner asked
 *   to read as a summary rather than a strip (2026-08-22); see `targetGroup`.
 * - Grouping is distance-only (no rules inside the header): labels bind to
 *   their content at 6px, blocks separate at 18px — the 1:3 ratio reads as
 *   grouping without lines.
 * - Weight ceiling is 600. Nothing here is a display size any more: the page's
 *   identity is a 12px path, so hierarchy comes from size (12→14px) and color
 *   (#4E5968→#191F28) only.
 * - Contrast is measured on the page wash (#F4F4FB) again — the card that briefly
 *   put this whole group on white is gone (see `targetGroup`). Re-measuring all ten
 *   tints across the move found exactly ONE that could not follow: `kvLabel` at
 *   #6B7684 is 4.62:1 on white and 4.22:1 on the wash, so the card had quietly been
 *   load-bearing for it. Everything else cleared AA on both.
 *   lib/design-guard.test.ts pins every pair, on the wash.
 */
export const projectHeaderStyles = {
  /** Kept as a named seam for future re-tints — C3 renders no plane at all. */
  surface: '',
  /**
   * 20 + 28: the page gutter, then the keyline the step cards below already type to
   * (`px-[28px]` inside a card that starts at the gutter). ⛔ The 20 is the layouts'
   * `px-5` (CloudTargetSourceLayout / IdcTargetSourceLayout, 오너 13차 지시) — move that
   * gutter and this number moves with it, or the header's type slides off the cards'.
   *
   * One number where there were three (오너 10차 지시). The header used to put its box
   * at x=336, the card's text at 353 (px-4 plus the card's own border) and the
   * stepper's text at 336 with no inset at all, while every step card below typed at
   * 364 — so the eye read a wobble down the left edge of the page. Nothing in this
   * header carries its own horizontal padding any more; the column provides it once.
   */
  inner: 'px-[48px] pt-[18px]',
  /** The path and any page action. No plane under it — see `targetGroup`. */
  titleRow: 'flex items-start justify-between gap-4',
  /**
   * 시안 C — the page's identity is a PATH, not a title. 「PII Agent 설치」 keeps its
   * place as the first segment instead of a 24px heading: it is true all day and is
   * never the reason anyone opened this screen, so it reads at the weight of a
   * location, and the service name it used to crowd gets the whole middle.
   *
   * Same grammar as the ops side of the same target (`opsStyles.crumb`): 12px, a
   * 280px clamp on the name, the last segment closing the path as "you are here".
   * Nothing here links, so this is a heading SHAPED like a path, not a breadcrumb.
   */
  crumb: 'flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] leading-[1.5] text-[#4E5968]',
  /** 「PII Agent 설치」 — semibold (오너 13차 지시). Weight only, not colour: it is still
      a location, and darkening it as well would put it in competition with the
      service name that follows instead of introducing it. */
  crumbRoot: 'flex-none font-semibold',
  crumbSep: 'flex-none text-[#A6ADBB]', // design-exempt: decorative path glyph, the labels around it carry the reading
  crumbName: 'max-w-[280px] truncate',
  /**
   * 「서비스」 — the kind marker in front of the name (오너 12차 지시). A path segment
   * states a value and says nothing about what KIND of value it is, which is fine for
   * a location a reader recognises and useless for one they do not: `/ DLV` told a
   * first-time reader nothing at all. Naming the kind is the one thing a breadcrumb
   * cannot do and a tag can.
   *
   * The same shell as `codeChip` below, minus the value — one slate vocabulary for the
   * whole line. Slate, not blue: in this palette blue means "clickable" and nothing on
   * this heading is.
   *
   * Both path tags carry `tagStroke` (오너 15차 지시). See that token for the value.
   */
  crumbKind:
    'inline-flex flex-none items-center rounded-[6px] border border-[#D7DBE3] bg-[#EAEEF7] px-2 py-[3px] text-[12px] font-medium text-[#55617A]',
  /**
   * The service code as a tag, carrying its own label (오너 12차 지시). Restored from
   * the token this file held until `dddad0da`, when the code moved into the path's
   * last segment and emptied the slot — same radius, same padding, same label and
   * value tints, so this is the old chip and not a new one.
   *
   * The one thing that did NOT come back is its own fill. `#E9EEF9` measures ΔE 1.08
   * from `modeChipAuto`'s `#EAEEF7` and both sit at L* 94.0 — restoring it would have
   * put two indistinguishable slates on one header behind two tokens. The two chips
   * separate on the value's mono, which is the difference that carries meaning.
   *
   * `items-baseline`, so the 12px label and the mono value sit on one line however
   * the mono face's metrics differ from the body face.
   *
   * `#D7DBE3` is a **stroke on black**, two rungs down from the fill (오너 15차 지시).
   * It is literally `rgba(0,0,0,.08)` over `#EAEEF7`, baked opaque — the border box
   * paints over the fill anyway, so the two render identically, and only the hex form
   * is measurable by `design-guard.test.ts`. Black rather than a darker slate: the
   * fill already carries the blue cast, and a second blue rung would have made the
   * edge read as more chip rather than as an edge.
   *
   * "Two rungs" is measured, not chosen. From this fill, the repo's own strokes sit at
   * ΔE00 2.31 (`blockHead`'s hairline) and 4.29 (the card stroke that used to house
   * this header); `#D7DBE3` is **4.20** — the second rung, and 5.89 from the page wash,
   * so the tag keeps a silhouette on both sides of its edge. ⛔ Don't reach for the
   * third rung (`#C6CCD6`, ΔE 7.84): these tags sit in a 12px path, not on a card.
   */
  codeChip:
    'inline-flex flex-none items-baseline gap-1.5 rounded-[6px] border border-[#D7DBE3] bg-[#EAEEF7] px-2 py-[3px]',
  codeChipLabel: 'text-[12px] font-medium text-[#55617A]',
  codeChipValue: 'font-mono text-[12px] font-semibold text-[#2C3A55]',
  /**
   * 시안 2 (P2): task-first H1 — the service identity demotes to this line, and
   * that line is now the disclosure itself: the facts on it ARE the summary of
   * the block it opens, so head and body read as one object instead of a control
   * standing beside the thing it controls (오너 3차 지시).
   *
   * A real plane, not a stroke on the wash (오너 5차 지시: 요약본처럼 보이게).
   * The stroke-only version was an empty rectangle drawn on the same colour it
   * stood on, so it read as a filter toolbar; what says "summary" is a surface
   * carrying two tiers — the path naming the target, the facts naming the scope
   * it installs into. Pulling the path INSIDE the card is what bought those two
   * tiers for +5px: it was already sitting 8px above on the wash, unhoused.
   *
   * 개선안 ㄷ — the plane is gone (오너 11차 지시). A card declares three things at
   * once: this is a group, this is an object, this is above the ground. Only the
   * first was ever wanted here, and the other two were doing damage. At 851px in a
   * 931px column the box covered 91% of what contained it, which is the size at
   * which a box stops separating anything (Apple HIG); and it shared the step card's
   * x, its width and its shadow, differing only on radius — so the page's SUBJECT
   * read as one of the page's ITEMS. That is why three rounds of raising the stroke,
   * the shadow and the fill never made it read as a summary: the surface was not too
   * weak, it was saying the wrong thing.
   *
   * What the owner's original complaint actually wanted was a NAME, and the header
   * already had one in this exact grammar — 「설치 진행」. So this block gets its
   * sibling: `blockLabel` above, one hairline under it, and the 6/18px distance ratio
   * these tokens already carried doing the grouping. It is a `<section>` with an
   * accessible name, which is more than the card ever had.
   *
   * 18px from the path above — the block separation this file already uses, and the
   * `18 : 6` ratio is now the only thing grouping these tiers. No width cap: `inner`
   * already lands the content box on the step card's own text column (364..1314 at
   * 1710px), and an 860px cap stopped the rules 118px short of it, which read as the
   * header having a right margin nothing else on the page had.
   */
  targetGroup: 'mt-[18px]',
  /**
   * The block's name and its one control, on the line the hairline closes. The rule
   * lives on this row rather than on a divider of its own: one line, drawn once,
   * marking where the named block starts — not a second box.
   *
   * Shared with 설치 진행 (`InstallationProcessProgressBar`), which is the point: the
   * header is two blocks in one grammar, and a rule under only one of them would make
   * them look like different kinds of thing.
   */
  blockHead: 'flex items-center justify-between gap-4 border-b border-[#E1E4EB] pb-1.5',
  /**
   * Block eyebrow (설명 / 설치 진행) — the stronger of the two label tiers, always
   * on a line of its own above the content it names.
   *
   * Neutral, not lavender (오너 7차 지시). The old pair bought its hierarchy from
   * hue, so two labels differed by colour FAMILY rather than by rank; the plain ramp
   * says the same thing in tones this product already speaks. 6.50:1 here against
   * 4.51:1 on `kvLabel` — a 1.44x step, measured on the wash, which is what this
   * block stands on again. A re-tint keeps BOTH the step and the floor. The 0.02em
   * tracking is the second signal, and it matters more now that hue is not one.
   *
   * This token names 「설치 대상」 as well as 「설명」 and 「설치 진행」 — the block name
   * that replaced the card is the same tier as the block names beside it, which is
   * the whole reason the header now reads as named blocks (오너 11차 지시).
   */
  blockLabel: 'whitespace-nowrap text-[12px] font-semibold tracking-[0.02em] text-[#4E5968]',
  block: 'mt-[18px]',
  /** Description body — 2-line clamp; the whole block is skipped when empty. */
  descText: 'mt-1.5 max-w-[82ch] text-[14px] font-medium leading-[1.5] text-[#4E5968] line-clamp-2',
  /** The provider's name in ink — IDC and SDU only, now that the branded clouds let
      their logo say it (오너 8차 지시). leading is explicit on BOTH line boxes — see
      summaryValue. */
  providerName: 'text-[14px] font-medium leading-[1.5] tracking-[-0.01em] text-[#191F28]',
  /** Plain-language gloss after a bare token (IDC → 사내망). */
  providerGloss: 'text-[#4E5968]',
  providerGlossBar: 'mx-1.5 text-[#C6CCD6]', // design-exempt: decorative separator glyph, not text
  divider: 'w-px flex-none self-stretch bg-[#E4E5EE]',
  /** Field name — every row of the fact column runs through here: AWS Account ID,
      GCP Project ID, Azure Subscription/Tenant ID, 설치 모드. The quieter of the two
      label tiers and the one sitting nearest the AA floor; see blockLabel for the
      pair. Semibold like blockLabel, so the two tiers separate on colour and
      tracking, never on weight.

      #6B7684 → #68717F is the whole price of dropping the card (오너 11차 지시): the
      old tint was 4.62:1 on the card's white and **4.22:1 on the wash**, the one
      token of ten that could not make the move. This is the smallest darkening that
      clears AA (4.51:1), chosen over the safer #656E7C because it keeps the widest
      step from blockLabel — the two tiers have only colour and tracking left to
      separate on, and 0.01 of AA headroom buys 0.06 of that step. ⛔ Do not lighten:
      there is no room under it. */
  kvLabel: 'whitespace-nowrap text-[12px] font-semibold text-[#68717F]',
  /** The 설치 모드 value — chip and its gloss on one baseline, in a grid cell. */
  modeRow: 'flex items-center',
  /** Copy affordance — hover/focus reveal, so idle rows show only the value. */
  copyReveal: 'opacity-0 transition-opacity duration-[120ms] group-hover/kv:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none',
  /** 설치 모드 값 칩 — auto is the quiet default (no action needed)… */
  modeChipAuto: 'inline-flex items-center rounded-[6px] bg-[#EAEEF7] px-2 py-0.5 text-[12px] font-semibold text-[#4B6284]',
  /** …manual keeps the amber outline: the customer must run the script themselves. */
  modeChipManual: 'inline-flex items-center rounded-[6px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800',
  modeNote: 'ml-2 whitespace-nowrap text-[12px] font-medium text-[#4E5968]',
  /**
   * The block's whole scope area: the provider on the left as the subject, every
   * identifier it owns listed to its right. Plain content, not a press — the
   * identifiers carry copy buttons and nothing interactive may sit inside a
   * `<button>`, so the disclosure is the cue up on the block head instead.
   *
   * Centered, not top-aligned (오너 9차 지시): the mark is the subject of the whole
   * fact block, not a bullet on its first line, and `items-start` was reading it as
   * the latter — 28px pinned to the top of a 50px stack left it 11px high. The
   * divider opts out with `self-stretch`, and the stack is the tallest item, so this
   * moves the mark and nothing else.
   *
   * No horizontal padding of its own any more — `inner` owns the one keyline.
   */
  summaryRow: 'flex items-center gap-3 pb-1 pt-2.5',
  /**
   * The provider cell — a bare mark for the branded clouds, mark plus name at the
   * house's 6px for IDC and SDU. Explicit `flex-none` at the call site, never baked
   * in: `flex: none` pins flex-shrink to 0, which is right here and silently fatal on
   * the identifier column, where it would defeat the truncation and let the row
   * overflow the card instead.
   */
  summaryFact: 'flex items-center gap-1.5',
  /**
   * Every identifier the target owns, one per row (오너 6차 지시: Azure 는 sub·tenant
   * 를 2줄로). A grid, not a wrapping flex row: `auto` sizes the label column to the
   * longest label so 「Subscription ID」 and 「Tenant ID」 start their values on the
   * same x, which is the whole reason two lines read as a list rather than as a
   * line that ran out of room. Rows are structural, so the second one appears
   * because a second identifier exists — never because the viewport shrank.
   *
   * 6px binds a label to its value, 4px separates two identifiers: tighter than the
   * blocks' 1:3 because these rows are one field repeated, not distinct groups.
   */
  summaryIds: 'grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-1',
  /** The brand mark (`ProviderGlyph` tone="brand", 오너 지시) — one provider looks the
      same everywhere in the product. Bare, no plate: brand colour is the emphasis,
      and a grey tile only muted it. IDC and SDU have no brand and fall back to this
      `currentColor`.

      28px, up from the 20px the ops dashboard identity cell uses (오너 8차 지시) —
      `CloudProviderIcon`'s own `lg` rung, not a number picked here. The step pays for
      itself because the mark is now the ONLY thing naming the branded clouds on this
      card: AWS's logo is a wordmark whose letters print at 0.32x the slot, so 20px
      left them 6px tall — below the size at which a word is read rather than guessed. */
  summaryGlyph: 'h-7 w-7 flex-none text-[#4E5968]',
  /** An identifier's value cell — the one thing on the card allowed to shrink, and
      the reason it can carry Azure's 293px Subscription UUID at all: the value
      prints in full where the column has room and ellipses where it does not. A
      fixed cap would have clipped it on a 1710px screen too. `group/kv` drives the
      copy reveal; the whole value also stays in a native `title`. */
  summaryValue:
    'group/kv flex min-w-0 items-center gap-1 text-[14px] font-medium leading-[1.5] text-[#191F28]',
  summaryValueText: 'min-w-0 truncate',
  summaryValueMono: 'font-mono tracking-[-0.02em] tabular-nums',
  /**
   * Blue, because in this palette blue is the one colour that means "clickable" —
   * and it names what opens, which the chevron alone cannot. It rides the block
   * head: the scope below it holds copy buttons, so the scope cannot itself be the
   * press, and a named block's one control belongs beside the name.
   *
   * The name is 「설명」, not 「설치 대상 정보」 (오너 11차 지시). Three rounds of moving
   * essentials onto the face emptied the fold down to a single paragraph, and a cue
   * that promises 「정보」 over one paragraph is a cue that overstates its body. It is
   * also gated now: no description, no cue — an empty disclosure is worse than none.
   */
  metaCue:
    'flex flex-none items-center gap-1 rounded-[6px] text-[12px] font-semibold text-[#0050D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0050D6]/40',
  metaToggleIcon: 'h-3.5 w-3.5 transition-transform motion-reduce:transition-none',
  metaToggleIconOpen: 'rotate-180',
  /** Distance, not a second rule: the block already draws one line under its name,
      and a rule here would put the fold in a box of its own — which is the habit
      this whole round was about. `block` inside supplies the 18px. */
  targetBody: 'pb-1',
} as const;

/**
 * 설치 진행 — one row at rest, the seven-step road behind a disclosure (오너 14차 지시).
 *
 * The road named every step so a first-time reader could see the whole route, and
 * charged ~60px of header for it on every visit after the first. 오너 13차 지시 cut it
 * to a sentence on its own line under the block name; this round folds that sentence
 * up ONTO the block name — 설치 진행 · 전체 7단계 중 [4단계 Agent 설치] — and gives the
 * road back to the reader who wants it, on the same 「name + cue + body」 grammar
 * 설치 대상 uses one block above. Nothing was deleted this time, only ranked: the one
 * fact a mid-install reader needs is always on screen, and the route is one click.
 *
 * Position is carried by the NUMBERS, which is why they are the only thing that steps
 * up a size: 14px in a 12px row, on the same 12/14 pair the block labels and values
 * already use.
 */
export const installStepperStyles = {
  wrap: 'mt-[18px] pb-[18px]',
  /**
   * The block's name and its position line on ONE row (오너 14차 지시), as the left
   * half of the shared `blockHead` — the cue takes the right half.
   *
   * A container of its own rather than pouring the label into `summary`: `blockHead`
   * is `justify-between`, so three children would push the sentence into the middle
   * of the row instead of leaving it beside the name it belongs to. The 12px here
   * against `summary`'s 8px inside is what stops 「설치 진행 전체 7단계 중」 reading as
   * one run-on phrase — the two share a colour and nearly a weight, so distance is
   * the only separator left.
   */
  head: 'flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1',
  /**
   * `items-baseline`, because the counts run 14px inside a 12px sentence and a
   * centred row would leave them sitting a pixel high. Wraps rather than truncates —
   * the 연결 테스트 verdict rides this line now, and at 520px the two do not fit.
   */
  summary: 'flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-medium text-[#4E5968]',
  /** 전체 **7**단계 중 — tabular, so the digits do not shift the line as the target
      advances through the steps. */
  count: 'text-[14px] font-semibold tabular-nums text-[#191F28]',
  /**
   * 「4단계 Agent 설치」 — where you are, as one tag (오너 14차 지시). Blue, on the
   * owner's call: the slate this used to wear is the path's tag vocabulary, and on a
   * row that now also carries the block's name the step needed to be the thing the
   * eye lands on.
   *
   * ⛔ Fill AND ink must stay equal to `cardStyles.stepTag` — the 「N단계」 tag over
   * every step-card title, which is the SAME fact rendered a second time and is on
   * screen at the same moment. This shipped for one review round as `#1747B5` on the
   * same `#E8F1FF`, reasoned only against `metaCue` and never against the card tag;
   * one fill carrying one fact in two tints reads as two meanings.
   * `primaryColors.bgLight`/`textOnLight` are written out as literals because
   * `design-guard.test.ts` parses these strings as source and cannot follow a `${}` —
   * a test pins the two tokens equal instead. 5.92:1.
   *
   * The cue at the other end of the row wears the same `#0050D6`, and that is
   * survivable where the card clash was not: the cue has no fill, carries a chevron,
   * sits at the opposite edge, and is not the same fact.
   *
   * `items-baseline`, so the 14px count and the 12px name sit on one line inside the
   * tag and the tag itself lands on the sentence's baseline.
   */
  stepTag:
    'inline-flex items-baseline gap-1.5 rounded-[6px] bg-[#E8F1FF] px-2 py-[3px] text-[12px] font-semibold text-[#0050D6]',
  /** The step number inside the tag — same 14px tier as `count`, but it takes the
      tag's ink rather than the sentence's near-black, which would read as a second
      colour inside a two-word plate. */
  tagCount: 'text-[14px] font-semibold tabular-nums',
  /**
   * Verdict slot for 연결 테스트 — in flow, following the step tag on the head row,
   * and only while the road is open (오너 14차 지시 후속). It is detail about one step,
   * so it comes with the press that names the steps rather than standing on the
   * always-visible row.
   *
   * ⛔ Never `absolute` again. It used to hang from `top-full` under the 연결 테스트
   * dot, so it reflowed nothing and would silently overlap the first card if the
   * body's `pt-8` ever tightened — only a human looking at the screen would have
   * caught it. Hanging it back on the step is the obvious way to fold it with the
   * road, and it is the way that brings the bug back; gating the row slot is not.
   */
  tagSlot: 'inline-flex items-center',
  /** Left-anchored, capped width — 7 steps don't need the full column; ~120px
      per step keeps the road compact while the longest label still fits.
      10px under the block rule: the name is no longer touching the road. */
  list: 'mt-2.5 grid w-full max-w-[860px] list-none p-0',
  item: 'flex min-w-0 flex-col items-center gap-1.5',
  track: 'relative flex h-[10px] w-full items-center justify-center',
  lineBase: 'absolute top-1/2 -mt-px h-[2px]',
  /** Road ahead — a 2px surface, so it answers to ΔE00 (14.9 from the wash), not 4.5:1. */
  line: 'bg-[#B0B8C1]',
  /** Road walked — the primary itself; the dots' wash ring punches it into beads. */
  lineDone: 'bg-[#0050D6]',
  dotBase: 'relative z-[1] flex-none rounded-full ring-[3px] ring-[#F4F4FB]',
  /** Exactly one of the three applies — `cn` has no tailwind-merge, so each carries its own size. */
  dotPending: 'h-2 w-2 bg-[#6B7684]',
  dotDone: 'h-2 w-2 bg-[#0050D6]',
  /** 10px, not 8: "you are here" should read before color does. */
  dotCurrent: 'h-2.5 w-2.5 bg-[#0050D6]',
  labelBase: 'px-1 text-center text-[12px] leading-[1.35]',
  /** Walked and unwalked steps share one label color — the dots already say which is which. */
  labelRest: 'font-medium text-[#4E5968]',
  labelCurrent: 'font-semibold text-[#0050D6]',
} as const;

/**
 * 입력 필드 스타일
 */
export const inputStyles = {
  // Placeholder is gray-500, not gray-400: WCAG counts placeholder text as text, and
  // gray-400 measures 2.6:1 on white — well under AA. gray-500 gives 4.83:1.
  base: 'w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0064FF] focus:border-transparent transition-shadow',
  error: 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500',
  success: 'border-[#45CB85]/30 bg-[#45CB85]/5',
} as const;

/**
 * 모달 스타일
 */
export const modalStyles = {
  overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
  container: 'bg-white rounded-xl shadow-xl overflow-hidden',
  header: 'px-6 py-4 border-b border-gray-100 flex items-center justify-between',
  body: 'p-6',
  footer: 'px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3',
  /**
   * IDC opt-in Toss chrome (Modal `chrome="toss"`) — radius 24, 26px title,
   * 28/40 body, white footer with #EBEEF2 divider, 38px round icon circle.
   * Mirrors `.modal` / `.modal-header` / `.modal-title` in SIT v15.
   */
  toss: {
    container: 'rounded-[24px]',
    header: 'px-10 pt-9 pb-1.5 flex items-start justify-between',
    title: 'text-[26px] font-extrabold tracking-[-0.03em] leading-[1.25] text-[#191F28]',
    /* mt-4 = the 16px title→subtitle gap every step-flow modal shares (ConfirmRewind 외).
       #6B7280, not #8B95A1: the description is normal-size text (14px) so AA needs 4.5:1 —
       #8B95A1 measured 3.04:1 on white and read as washed out; #6B7280 is 4.83:1 on the
       same quiet tier. */
    subtitle: 'mt-4 text-[14px] font-medium leading-[1.6] text-[#6B7280]',
    /* 한 줄짜리 부제를 쓰는 모달의 12px 변형. mt 만 다른 완전한 문자열로 둔다 —
       cn 은 단순 join 이라 같은 속성을 겹쳐 쓰면 어느 쪽이 이길지 클래스 순서로
       정해지지 않는다(Tailwind 가 CSS 에 찍는 순서가 결정한다). */
    subtitleTight: 'mt-3 text-[14px] font-medium leading-[1.6] text-[#6B7280]',
    body: 'px-10 pt-7 pb-2',
    footer: 'px-10 pt-5 pb-6 border-t border-[#EBEEF2] bg-white flex justify-end gap-2.5',
    iconBase: 'w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0',
    iconInfo: 'bg-[#E8F1FF] text-[#0064FF]',
    iconWarn: 'bg-[#FEF3C7] text-[#B45309]',
    /**
     * Toss chrome for a read-only notice — no footer, no ✕, so the 40/36 padding that
     * frames a two-button dialog leaves the text floating. Every edge comes in 8px and
     * the title drops 26 → 20px, since nothing here is a decision. Header owns no bottom
     * padding: the body's pt-6 alone is the 24px between title and the first group.
     */
    compact: {
      header: 'px-8 pt-7 flex items-start justify-between',
      title: 'text-[20px] font-extrabold tracking-[-0.03em] leading-[1.3] text-[#191F28]',
      body: 'px-8 pt-6 pb-7',
    },
  },
  sizes: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  },
} as const;

/**
 * 테이블 스타일
 */
export const tableStyles = {
  /**
   * v15 thead — #F7F8FA bg, 600; NO uppercase / NO tracking-wider.
   * Text is #4E5968, NOT the v15 #8B95A1: that gray scores 2.86:1 on this header background,
   * far under AA, and column names are the labels a user needs most when scanning rows they
   * cannot yet read. #4E5968 holds 6.69:1 and still sits lighter than every body cell
   * (#374151 secondary, #191F28 primary), so the header/body hierarchy is unchanged.
   */
  header: 'bg-[#F7F8FA] text-left text-xs font-semibold text-[#4E5968]',
  headerCell: 'px-[18px] py-[12px]',
  body: 'divide-y divide-[#EBEEF2]',
  row: 'hover:bg-gray-50 transition-colors',
  /** v15 td — 16/18 padding, #191F28 / weight 500. */
  cell: 'px-[18px] py-[16px] text-[#191F28] font-medium',
} as const;

/**
 * 뱃지 스타일
 */
export const badgeStyles = {
  base: 'inline-flex items-center gap-1.5 rounded-full font-medium',
  sizes: {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  },
} as const;

/**
 * TopNav 스타일 — PASS 프로토타입 전용 (slate-900 shell + PASS 워드마크 로고)
 *
 * brand 의 raw hex 는 로고 색으로 예외 허용.
 * 소비 측에서 이 상수만 참조하고 문자열을 중복 정의하지 말 것 — 유일한 소비자는 PassLogo.
 *
 * The brand blue needs a DARK-SURFACE FORM here: the ink value #0064FF scores
 * only 3.63:1 on slate-900, so the wordmark uses the lifted form below. Keep the
 * two in sync — they are the same colour, not different ones.
 *
 * The descriptor row ("PII Agent Self Service") and its three fills are gone with
 * the second lockup line; see PassLogo.
 */
export const navStyles = {
  bg: 'bg-slate-900',
  /** Thin vertical separator between nav clusters on the dark bar. */
  divider: 'h-5 w-px shrink-0 bg-white/15',
  brand: {
    /** PA — the ink half of the wordmark. */
    wordmarkInk: 'fill-white', // design-exempt: brand logotype on navStyles.bg (slate-900)
    /** SS — the verdict half. Dark-surface form of the CTA blue #0064FF (3.63:1 → 5.41:1). */
    wordmarkAccent: 'fill-[#4D94FF]', // design-exempt: brand logotype on navStyles.bg (slate-900)
  },
  link: {
    inactive: 'text-slate-300 hover:bg-white/5 hover:text-white',
    active: 'text-white bg-white/10',
  },
  user: {
    avatar: 'bg-slate-600 text-white',
    email: 'text-slate-300',
    /** Google account-chip pattern: initial circle, click opens account card.
     *  36, up from 32: GitHub and the Google Cloud console both run the account
     *  disc at 32, but they also run their marks and menu items at 32-36. This
     *  bar's band is mark 32 / item 40, and the chip sits inside it rather than
     *  under it. Going further — 48 was tried — puts the initials at the same
     *  visual weight as the brand mark in the same bar.
     *  The initial scales with the disc, so the two sizes move together. */
    chip: 'w-9 h-9 rounded-full inline-flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-white/25 transition-shadow',
    menu: {
      container:
        'absolute right-0 top-full mt-2 z-50 min-w-[240px] max-w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.14)] flex flex-col text-left',
      /** 신원 행 — 카드가 이 한 줄뿐이던 시절의 원래 레이아웃. */
      identity: 'flex items-center gap-3',
      avatar:
        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-slate-600 text-white shrink-0',
      name: 'text-sm font-semibold text-gray-900 truncate',
      email: 'text-xs text-gray-500 truncate',
      /** 신원과 이동 항목 사이. p-4 를 가로로 되먹어 카드 폭 전체를 긋는다. */
      divider: '-mx-4 my-3 h-px bg-gray-200',
      /** 관리자 전용 이동 항목. 링크라서 hover 와 키보드 focus 를 모두 갖는다. */
      item: 'flex items-center gap-2 -mx-2 px-2 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none transition-colors',
      itemIcon: 'text-gray-500 shrink-0',
    },
  },
} as const;

/**
 * Confirm step modal — design source: SIT Prototype v3 line 2563–2587 (rewind-confirm dialog).
 */
export const confirmModalStyles = {
  iconCircle: {
    warn: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
  },
  note: {
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
  },
  /** v15 cancel/danger-outline — radius 12, border 0, weight 600, #991B1B. */
  dangerOutlineButton:
    'inline-flex items-center justify-center px-4 py-2 rounded-[12px] text-sm font-semibold border-0 bg-red-50 text-[#991B1B] hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  outlineButton:
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
} as const;

/**
 * Step banner — 단계 본문 위 안내 배너 (시안 SIT Prototype v3 line 1832)
 */
export const bannerStyles = {
  /** v15 StepBanner — radius 12, 18/22 padding, no border, 500, font 14, gap 14, mb 20. */
  base: 'flex items-center gap-[14px] px-[22px] py-[18px] mb-5 rounded-[12px] font-medium text-[14px]',
  variants: {
    info: 'bg-blue-50 text-[#1E40AF]',
    warn: 'bg-amber-50 text-amber-900',
    success: 'bg-emerald-50 text-[#065F46]',
    error: 'bg-red-50 text-red-900',
  },
} as const;

/**
 * 텍스트 계층 램프 — 5 크기(24/20/16/14/12) × 3 weight = 7 역할.
 * 기준: docs/redesign/typography-and-spacing.md
 *
 * line-height 는 배수가 아니라 px 로 고정한다 — 소수 행간이 half-leading 으로
 * 새어나가면 stackGap 이 선언대로 보이지 않는다.
 * ⚠️ admin 파이프라인(Figma R24) 화면은 대상이 아니다. 그쪽 홀수·소수 px 는
 * 디자이너 램프의 충실 반영이라 이 램프로 덮으면 안 된다.
 */
export const textStyles = {
  pageTitle: 'text-[24px] font-bold leading-[32px] tracking-[-0.02em]',
  sectionTitle: 'text-[20px] font-bold leading-[28px] tracking-[-0.02em]',
  cardTitle: 'text-[16px] font-bold leading-[24px] tracking-[-0.01em]',
  body: 'text-[14px] font-normal leading-[20px] tracking-[-0.01em]',
  bodyStrong: 'text-[14px] font-semibold leading-[20px] tracking-[-0.01em]',
  caption: 'text-[12px] font-normal leading-[16px] tracking-[-0.01em]',
  captionStrong: 'text-[12px] font-semibold leading-[16px] tracking-[-0.01em]',
} as const;

/**
 * 텍스트 계층 간 수직 거리 — 요소가 아니라 두 계층의 '관계'에 붙는다.
 * 각 단계가 정확히 2배라 "섹션 간 여백 ≥ 내부 여백 × 2"가 구조로 보장된다.
 * margin 이 아니라 컨테이너 gap 으로 적용한다.
 */
export const stackGap = {
  /** 4px — 한 덩어리로 읽혀야 하는 쌍 (라벨↔값, 제목↔부제) */
  tight: 'gap-1',
  /** 8px — 같은 그룹의 형제 항목 */
  related: 'gap-2',
  /** 16px — 그룹 제목↔본문, 카드 내 블록 경계 */
  group: 'gap-4',
  /** 32px — 섹션↔섹션, 카드↔카드 */
  section: 'gap-8',
} as const;

/**
 * 인라인 색상 태그 — DB Type, 연동 대상/비대상 등.
 * Color keys (blue/green/...) preserved for legacy callers.
 * Prefer semantic aliases (success/info/warning/error/neutral) in new code.
 */
export const tagStyles = {
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
  success: 'bg-green-100 text-green-800',
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
  /**
   * 리소스 종류 태그(EC2 · RDS Cluster) — 이 행이 '무엇인가'를 말하는 사실.
   *
   * 면은 보라, 글자는 회색. 판정(파랑·주황·빨강)과 색 가족을 나눠 갖는 일은 면이 하고,
   * 글자는 읽히기만 하면 된다 — 채도 있는 글자는 행 안에서 이름보다 먼저 눈에 들어와
   * 사실을 판정처럼 외치게 만든다. #4E5968 은 이 면에서 5.32:1 로 AA 를 넘고,
   * 회색 한 칸 아래(#6B7280)는 3.62:1 이라 쓸 수 없다.
   *
   * 면이 #F3EEFF 가 아닌 이유는 hover 다. 그 값은 L* 94.9 라, 행이
   * `tableRowLift.target`(#EAEEF7, L* 94.0)으로 바뀌는 순간 칩과 행의 명도차가 0.9 로
   * 무너지고(1.02:1) 밝기 순서까지 뒤집혔다 — 흰 행에서 '주변보다 어두운' 칩이 hover 에서
   * '아주 살짝 밝은' 칩이 된다. 그러면 경계를 지탱하는 건 채도뿐인데, 색채 채널은 명도
   * 채널보다 공간 해상도가 낮아 20px 칩의 등휘도 경계는 테두리가 아니라 얼룩으로 읽힌다.
   * ΔE00 은 5.99 로 JND 를 넉넉히 통과했다: H10(#CFE0FF)과 같은 함정이라, 작은 표시는
   * 색차가 아니라 대비로 판정해야 한다.
   *
   * #E4DAFB(L* 88.7)는 hover 위에서 1.15:1 — 흰 행에서 이미 잘 보이는 1.14:1 과 같은
   * 분리다. 기준이 3:1 이 아닌 이유는 뜻을 나르는 게 'EC2'·'RDS Cluster' 라는 글자이지
   * 면이 아니어서다(1.4.11 의 대상이 아니다). 지켜야 할 값은 '평상시 수준을 hover 에서도
   * 유지한다'이고, 그래서 이 면은 어떤 표면 위에서도 그 표면보다 어두워야 한다.
   */
  resourceKind: 'bg-[#E4DAFB] text-[#4E5968]',
} as const;

/**
 * 논리 DB 목록 모달 (Step 5) — Database ▸ Schema 트리 전용 토큰.
 *
 * The rails/guides are ORIENTATION channels (which region an exclusion covers), so they
 * run at ~40% tone; full-saturation amber stays on the content channels (제외 chip, reason
 * sub-line). Saved exclusions rail amber, staged (unsaved) ones rail the primary blue.
 */
export const logicalDbStyles = {
  /** Database 그룹 행 밴드 — 카드 위 한 단계 가라앉은 표면. 텍스트는 secondary 이상. */
  dbRow: 'bg-gray-50',
  /** staged(저장 전) 행 틴트 — 파랑 계열, 확정 제외의 빨강과 구분. */
  stagedRow: 'bg-blue-50',
  /** 확정 제외 레일 — 부모~자식을 잇는 3px 인셋 스트라이프 (amber-600 @ 40%). */
  railDeny: 'shadow-[inset_3px_0_0_0_rgba(217,119,6,0.4)]',
  /** 저장 전 제외 레일 — primary @ 40%. */
  railStaged: 'shadow-[inset_3px_0_0_0_rgba(0,100,255,0.4)]',
  /** 트리 세로 가이드선 (중립 / 제외 영역 / staged 영역). */
  guide: 'bg-gray-200',
  guideDeny: 'bg-amber-600/30',
  guideStaged: 'bg-[#0064FF]/30',
  /** `└` 커넥터 — 상속 제외 시 레일과 같은 계열로 물든다. */
  branch: 'text-gray-400',
  branchDeny: 'text-amber-600/60',
  branchStaged: 'text-[#0064FF]/60',
  /** 이름 아래 한 줄 사유 문장 — 확정(amber-800, AA on white/blue-50) / 예정(primary dark). */
  subDeny: 'text-amber-800',
  subPending: 'text-[#0050D6]',
} as const;

/**
 * Segmented tab control — modal task-detail filter tabs.
 * One nested group keeps related classes co-located.
 */
export const tabStyles = {
  segmented: {
    container: 'inline-flex gap-1 p-1 rounded-lg',
    containerBg: 'bg-gray-50',
    item: 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold cursor-pointer text-gray-500',
    itemActive: 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
    countBadge: 'inline-block min-w-[18px] px-1.5 py-px rounded-full text-[11px] font-bold text-center bg-gray-100 text-gray-500',
    countBadgeActive: 'bg-blue-50 text-blue-600',
  },
} as const;

/**
 * IDC (on-prem) provider — exact prototype tokens (SIT Prototype Athena v15).
 *
 * IDC opts into the mockup's hand-tuned Toss palette WITHOUT changing the shared
 * generic components (decision: IDC-scoped exact match — siblings AWS/Azure/GCP
 * stay on the app's generic design system). Raw hexes mirror the prototype's
 * `.idc-*` / `.tag` / `.modal` CSS and live here (not in components) per the
 * no-raw-color rule. See docs/reports/idc-v15/04-design-verification.md.
 */
export const idcStyles = {
  /**
   * Kind badge — `.idc-kind` (11.5px / 600 / 3px 8px / radius 6).
   *
   * 접속 주소의 종류(IP · Domain)는 그 행이 **무엇인가**를 말하는 사실이지 판정이 아니다.
   * 그래서 EC2·RDS Cluster 태그와 같은 층(`tagStyles.resourceKind`)의 보라 면을 그대로
   * 쓴다: 한 행에서 사실을 말하는 표시가 전부 한 색 가족이어야, 옆 칸의 진짜 판정
   * (파랑·주황·빨강)과 섞여 읽히지 않는다. 값은 복사하지 않고 **참조**한다 — 두 벌이 되면
   * 한쪽만 조정되어 갈라지고, 그 순간 두 태그는 같은 층이 아니게 된다.
   *
   * 종류마다 색을 갈랐던 이전 판(파랑 Single · 주황 Multi · 인디고 Domain)은 판정 셋처럼
   * 읽혔다. 주소가 몇 개인지는 색이 할 말이 아니라 주소 칸의 '더보기'가 하는 말이다.
   */
  kindBadge: {
    base: 'inline-flex items-center rounded-md px-2 py-[3px] text-[11.5px] font-semibold',
    // The edge rides the FILL, not `base`: this badge sits in resource rows, and on the
    // hover tint its fill goes equiluminant with the tint (see chipEdge).
    fill: `${tagStyles.resourceKind} ${tableRowLift.chipEdge}`,
  },
  /**
   * 확인 필요 배지 — 같은 데이터베이스를 두 번 등록했을지 모르는 행에 붙는다.
   *
   * 면을 칠하지 않는 유일한 배지다. 바로 옆에 서는 게 kindBadge 이고 그중 `multi` 가
   * 이미 주황 면(#FEF0E1)이라, 경고를 주황 면으로 그리면 두 칩이 한 덩어리로 읽힌다.
   * 흰 면 + stroke 는 행 hover 틴트 위에서도 대비를 잃지 않는다(chipEdge 가 푸는 문제를
   * 애초에 만들지 않는다). 글자색 #B54708 은 --pl-warn-text 와 같은 값 — 상단 알림과
   * 표가 같은 경고 하나를 말한다.
   *
   * 11.5px 은 옆의 kindBadge 와 같은 눈금이다.
   */
  checkBadge:
    'inline-flex items-center gap-1 rounded-md border border-[#F79009] bg-white px-2 py-[3px] text-[11.5px] font-semibold text-[#B54708]', // design-exempt: mirrors idcStyles.kindBadge 11.5px token
  /**
   * 확인 필요 그룹을 잇는 선 (오너, 2026-08-17: RDS Cluster 처럼 가로·세로 선으로 잇자 —
   * 같은 제안을 앞서 기각했던 결정을 오너가 직접 뒤집었다).
   *
   * 4px 레일을 대신한다. 레일은 "이 행들이 같은 성격"까지만 말하고 어디서 시작해 어디서
   * 끝나는지는 두께가 변하지 않으니 읽는 사람이 색이 끊기는 지점을 찾아야 했다. 트렁크와
   * 엘보는 그걸 그린다: 첫 구성원의 엘보에서 시작해 마지막 구성원의 엘보에서 끝나므로,
   * 선 자체가 그룹의 천장과 바닥이다.
   *
   * `group.childCell` 과 같은 어휘를 다시 앵커한 것이다 — 표에 트리 선은 하나다. 다른 점은
   * 부모가 없다는 것: 여기서 묶이는 건 형제들이라 트렁크가 첫 행의 가운데에서 시작한다
   * (부모-자식 트리는 부모 행에서 내려온다).
   *
   * 기하는 `approvalCell` 의 18px 좌패딩 안에서 잡는다:
   *   8       트렁크   (패딩 안, 표 왼쪽 테두리와 떨어져)
   *   8..14   엘보     6px
   *   18      셀 내용  → 4px 여유. 붙이는 건 띄우는 게 아니다.
   *
   * 색은 --pl-warn-text 와 같은 #B54708 — 배지·짝 주소와 한 경고를 말한다. 중립 회색
   * (--rail #C4CEDA)은 부모-자식 트리의 색이고, 이 선이 가리키는 건 구조가 아니라 어느
   * 행들이 문제인가다. `--pl-warn`(#F79009)은 흰 행에서 2.35:1 이라 이 자리에 못 쓴다.
   */
  checkGroup: {
    /** 그룹 안의 행 — 트렁크가 행 높이를 관통하고 엘보가 내용까지 닿는다. */
    cell: "relative before:absolute before:bottom-0 before:left-[8px] before:top-0 before:w-px before:bg-[#B54708] before:content-[''] after:absolute after:left-[8px] after:top-1/2 after:h-px after:w-[6px] after:bg-[#B54708] after:content-['']",
    /** 첫 구성원 — 트렁크가 자기 엘보에서 시작한다. */
    first: 'before:top-1/2',
    /** 마지막 구성원 — 트렁크가 자기 엘보에서 끝난다. 잇는 것을 지나쳐 뻗는 선은 아래로
     *  이어지는 그룹으로 읽힌다. */
    last: 'before:bottom-1/2',
  },
  /** Inline color tag — `.tag` (4px 10px / radius 8 / 12px / 600). */
  /**
   * 상태 태그. `connProgress.state` 와 같은 규칙 — **채도만 낮추고 명도는 고정**, 한 계열에
   * 한 채도(C=0.018).
   *
   * 원래 C 0.0196~0.0250 으로 카드 표면(0.0136~0.0181)보다 진했다. 알약은 한 열에 세로로
   * 쌓여서 표가 색 띠를 하나 갖는 것처럼 읽혔고, 22px 짜리 칩이 795px 짜리 판보다 화소당
   * 더 크게 튀었다. 판보다는 진해야 맞다(작은 표식이라 찾을 수 있어야 한다) — 그 순서는
   * 유지한 채 둘 다 내렸다(처음엔 0.014, 한 단계 되올려 지금 값).
   *
   * 칩이 표면(0.012)보다 1.5배 진한 이 관계가 값 자체보다 중요하다. 되돌려 잡을 일이
   * 생기면 `connByStatus` 계열과 같은 배로 움직여서 순서를 지켜라.
   *
   * ⚠️ L 은 절대 옮기지 말 것. `chipEdge` 의 근거가 "칩 어휘 전체가 L* 88.7~96.2 에 모여
   * 있고 hover 틴트 둘이 그 안에 앉는다"는 관측이라, 명도를 건드리면 그 분석이 통째로
   * 무효가 된다. 실측으로 흰 행 1.11~1.14:1 · hover 1.02~1.05:1 이 그대로이고, 글자 대비도
   * 4.87/5.76/7.38/7.10 으로 전부 보존된다.
   */
  tag: {
    base: 'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold tracking-[-0.01em] whitespace-nowrap',
    blue: `bg-[#E9F1FD] text-[#1747B5] ${tableRowLift.chipEdge}`,
    green: `bg-[#E9F7EF] text-[#197A3F] ${tableRowLift.chipEdge}`,
    red: `bg-[#FDECEC] text-[#B42318] ${tableRowLift.chipEdge}`,
    orange: `bg-[#FBF1E6] text-[#7A3F0E] ${tableRowLift.chipEdge}`,
    /** 중립은 이미 C 0.0029 라 내릴 것이 없다 — 색 없는 태그가 이 열의 바닥이다. */
    gray: `bg-[#F7F8FA] text-[#4E5968] ${tableRowLift.chipEdge}`,
  },
  /** Health/connection status — `.status` (bare text + dot, 12.5px / 500 / dot 8px; NO bg/pad/radius). */
  status: {
    base: 'inline-flex items-center gap-1.5 text-[12.5px] font-medium',
    dot: 'w-2 h-2 rounded-full',
    healthy: { text: 'text-[#2A7D52]', dot: 'bg-[#45CB85]' },
    unhealthy: { text: 'text-[#991B1B]', dot: 'bg-[#991B1B]' },
    /** `.status.partial` — orange pending-approval inline label (03-status-tag-pill §2). */
    partial: { text: 'text-[#9A3412]', dot: 'bg-[#F97316]' },
  },
  /* targetPill 은 `verdictText` 로 대체됐다 — 판정은 태그가 아니라 글자다. 근거는 그 토큰의 주석. */
  /**
   * Exclusion-reason chip — `.reason-chip-inline` (3px 9px / radius 6 / 11.5px / 500 / cursor help).
   *
   * 중립이다. 원래 주황(#FFF7ED / #9A3412)이었는데, 그 계열은 `statusColors.warning` 이 이미
   * 쓰고 있고 판정 열의 <연동 불가>(#B45309)가 바로 그 색이다. 그래서 사람이 뺀 행이
   * 스캔이 막은 행처럼 읽혔다 — 한 행에서 색을 갖는 것은 판정 하나로 족하고, 사유는 내용만 나른다.
   * 행 단위 표시는 `verdictRail` 이 이미 맡고 있어 칩이 존재감을 내려놓아도 잃는 것이 없다.
   *
   * #4E5968 on #F7F8FA = 6.9:1. 아이콘은 #6B7280 (4.5:1) — #98A2B3 는 2.5:1 로 1.4.11 미달이다.
   */
  reasonChip: {
    base: 'inline-flex min-w-0 max-w-full items-center gap-[5px] rounded-[6px] border border-[#E1E5EB] bg-[#F7F8FA] px-[9px] py-[3px] text-[11.5px] font-medium text-[#4E5968] cursor-help transition-[background-color,border-color] duration-[120ms] hover:bg-[#EFF1F5] hover:border-[#C9CFD8]', // design-exempt: 11.5px 는 v16 `.reason-chip-inline` 원문 값 — 이번 변경은 색만 건드린다
    text: 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]',
    icon: 'flex-shrink-0 text-[#6B7280]',
    /** 팁 헤딩(제외 사유 / 안내) + 그 앞 4px 점. 칩과 같은 중립 — 칩만 내리면 같은 정보의
     *  두 표현이 서로 다른 색을 갖는다. */
    tipLabel: 'text-[#4E5968]',
    tipLabelDot: 'bg-[#4E5968]',
    /** 팁 안의 원문 판정 코드 — 본문 문장보다 한 단 아래. #6B7280 on white = 4.8:1. */
    tipCode: 'text-[#6B7280]',
  },
  /** Header status pill (mirrors cloud sibling pill; combine with statusColors.{warning,success}). */
  statusPill: 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  /** Multi-IP endpoint toggle — `.idc-ep-toggle` (11.5px / 600 / gray-500).
   *  Was primary. It sits directly beside the address it belongs to, and blue there
   *  read as loud as the identity it was captioning; the row already spends its one
   *  colour on the kind badge. gray-500, not gray-400 — 11.5px semibold is not WCAG
   *  'large text', and gray-400 measures 2.54:1 on white against gray-500's 4.83:1. */
  epToggle: 'text-[11.5px] font-semibold text-gray-500 hover:underline hover:text-gray-700',
  /** Oracle SID key — `.idc-sid-k` (10px / 700 / fg-4 / ls .02em; bare, no bg/pad/radius). */
  // gray-500, not gray-400: this is text, and 10px bold is NOT WCAG 'large text'
  // (that starts at 18.66px bold). gray-400 measured 2.54:1 on white; gray-500 is 4.83:1.
  sidKey: 'text-[10px] font-bold text-gray-500 tracking-[0.02em]',
  /** Field-level warning under an input — `.idc-field-warn` (#B45309 / 11.5px). */
  fieldWarn: 'mt-1 text-[11.5px] text-[#B45309]',
  /** Field-level error under an input — `.idc-field-err` (#DC2626 / 11.5px). */
  fieldError: 'mt-1 text-[11.5px] text-[#DC2626]',
  /** Add-IP button — `.idc-add-ip` (12.5px / 600 / primary / no border / radius 6 / mt 10). */
  addIp: 'mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-[#0064FF] hover:bg-[#E8F1FF] hover:text-[#0050D6] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent',
  /** Remove-IP icon button — `.rm-ip` (30×30 / radius 7 / fg-3 / red hover). */
  removeIp: 'inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] text-gray-500 transition-colors hover:bg-[#FEECEC] hover:text-[#B42318]',
  /** Row hover action (edit) — `.idc-row-actions button` (26×26 / radius 6 / fg-3). */
  rowAction: 'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#F7F8FA] hover:text-gray-900',
  /** Row hover action (delete) — `.idc-row-actions button.del` (red hover). */
  rowActionDelete: 'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#FEECEC] hover:text-[#B42318]',
  /** Exclusion-reason popover — `.idc-reason-pop`. */
  popover: {
    container: 'fixed z-[120] min-w-[248px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]',
    title: 'px-2.5 pb-2 pt-2 text-[14px] font-semibold text-[#191F28]',
    // 프리셋 값은 칩(태그 피커) — 맨텍스트 행은 휴지 상태에서 선택지로 읽히지
    // 않는다. 표면은 승인 요청 모달 타일과 같은 흰 카드+스트로크+lg 섀도 패턴,
    // 라운드는 "N단계" 태그의 6px. 휴지 gray-200 보더 < hover 브랜드 프리뷰
    // < 선택 브랜드+틴트로, Step1·2 필터 타일과 같은 상호작용 사다리. 색 충돌
    // 방지를 위해 border-color는 rest/selected 어느 한쪽만 소유한다(cn은 단순
    // join — 순서가 승자를 못 정한다).
    chipRow: 'flex flex-wrap gap-1.5 px-2.5 pb-1.5',
    chip: `rounded-[6px] border px-3 py-1.5 text-[13px] transition-colors ${tossShadow.lg}`,
    chipRest: 'border-gray-200 bg-white font-medium text-gray-700 hover:border-[#0064FF] hover:text-[#0064FF]',
    chipSelected: 'border-[#0064FF] bg-[#E8F1FF] font-semibold text-[#0050D6]',
    // 직접 입력은 텍스트 버튼(언더라인) — 칩(값)과 형태를 달리해 행동으로 읽히게.
    // 구분선 없이 여백만으로 칩 구역과 가른다. hover는 색 다크닝만으로는 약해서
    // 브랜드 틴트 필을 깔아 "눌러서 입력/수정한다"는 신호를 준다.
    custom: 'mt-1.5 inline-flex w-full items-center gap-1.5 rounded-[8px] px-2.5 pb-1.5 pt-1.5 text-left text-[13px] font-semibold underline underline-offset-2 transition-colors',
    customRest: 'text-[#0064FF] hover:bg-[#E8F1FF] hover:text-[#0050D6]',
    customActive: 'font-bold text-[#0050D6] hover:bg-[#E8F1FF]',
  },
  /** Amber overwrite/warn banner — `.idc-ip-warn` / `.idc-load-note` (#FFFBEB / #FCD34D / #92400E). */
  warnBanner: 'flex items-start gap-2 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2.5 text-[12px] leading-[1.55] text-[#92400E]',
  /** Toss modal footer buttons (52px) — `.modal-footer .btn.*`. */
  modalBtn: {
    primary: 'inline-flex h-[52px] items-center justify-center rounded-[14px] bg-[#0064FF] px-7 text-[15px] font-bold tracking-[-0.01em] text-white transition-colors hover:bg-[#0050D6] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]',
    outline: 'inline-flex h-[52px] items-center justify-center rounded-[14px] px-[22px] text-[15px] font-semibold tracking-[-0.01em] text-[#4E5968] transition-colors hover:bg-[#EBEEF2]',
    /** Filled gray modal button — v16 `.modal-footer .btn.gray` (cancel). */
    gray: 'inline-flex h-[52px] items-center justify-center rounded-[14px] border-0 bg-[#F7F8FA] px-[22px] text-[15px] font-semibold tracking-[-0.01em] text-[#191F28] transition-colors hover:bg-[#EBEEF2]',
  },
  /** In-card / step CTA buttons — `.btn` base (h40 / radius12 / 14px / 700) + variants. */
  triggerBtn: {
    primary: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0064FF] px-[18px] text-[14px] font-bold tracking-[-0.01em] text-white transition-colors hover:bg-[#0050D6] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]',
    soft: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#E8F1FF] px-[18px] text-[14px] font-bold tracking-[-0.01em] text-[#0050D6] transition-colors hover:bg-[#D6E7FF]',
    warnOutline: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#FEF3C7] px-[18px] text-[14px] font-semibold tracking-[-0.01em] text-[#92400E] transition-colors hover:bg-[#FDE68A]',
    /** Small blue ghost — v16 `.btn.sm.ghost` (the in-table "set" action). Disabled = opacity-45. */
    ghostSm: 'inline-flex h-8 items-center justify-center gap-1 rounded-[10px] px-3 text-[13px] font-bold text-[#0064FF] transition-colors hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
    /** `ghostSm` skeleton with the `primary` face — the Step 5 strip's state CTA slot (시안 A).
     *  In-table action size on purpose: the slot lives inside the summary strip, not the card edge. */
    primarySm: 'inline-flex h-8 items-center justify-center gap-1 rounded-[10px] bg-[#0064FF] px-3 text-[13px] font-bold text-white transition-colors hover:bg-[#0050D6] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]', // design-exempt: recreates the measured ghostSm skeleton (13px)
    /** `ghostSm` skeleton with the `soft` face — the slot while a test runs (always disabled). */
    softSm: 'inline-flex h-8 items-center justify-center gap-1 rounded-[10px] bg-[#E8F1FF] px-3 text-[13px] font-bold text-[#0050D6] disabled:cursor-not-allowed disabled:opacity-45', // design-exempt: recreates the measured ghostSm skeleton (13px)
    /** Underlined blue text action docked in a content group's footer (e.g. the rejected-reason
     *  well). border-b, not text-decoration: the underline must run under the trailing icon too,
     *  and text-decoration stops at a flex container's atomic children. */
    linkPrimary: 'inline-flex cursor-pointer items-center gap-1 border-b border-current pb-0.5 text-[13px] font-semibold text-[#0064FF] transition-colors hover:text-[#0050D6]',
    /** `linkPrimary` in the warning tone — a rewind that resets downstream progress (Step 6
     *  연결 재확인). Text weight rather than a filled block: the step has no primary CTA, so a
     *  filled amber button reads as the thing to do when the user's job is to wait, and the
     *  confirm modal already carries the warning. amber-800 on white is 7.4:1. */
    linkWarn: 'inline-flex cursor-pointer items-center gap-1 border-b border-current pb-0.5 text-[13px] font-semibold text-[#92400E] transition-colors hover:text-[#78350F]',
    /** `linkPrimary` with no hue — an in-cell link that repeats once per row (Step 6 논리 DB
     *  counts). Blue and amber once per row made the two columns the loudest thing on a screen
     *  whose job is to wait; the header already says which column is which, so the underline
     *  carries the affordance and color goes back to meaning state. #4E5968 is 7.5:1 on white. */
    linkNeutral: 'inline-flex cursor-pointer items-center gap-1 border-b border-current pb-0.5 text-[13px] font-semibold text-[#4E5968] transition-colors hover:text-[#191F28]',
    /**
     * `linkNeutral` at 14px — `LogicalDbCountCell` 전용.
     *
     * 그 셀은 한 열 안에서 두 갈래(평문 / 드릴다운 링크)를 그린다. 평문만 14px 로 올리면 같은
     * 열에서 접힌 행은 14, 그 옆 링크는 13 이 되어 열이 두 눈금으로 갈린다. 13 은 v16 에서
     * 넘어온 홀수라 디자인 가드가 지금은 받지 않는 값이기도 하다.
     *
     * `linkNeutral` 자체는 그대로 둔다 — 5·6단계 카드의 `실행 이력`·`다시 실행` 도 그 토큰을
     * 들고 있고, 그 링크들의 크기는 이 열과 상관없다.
     */
    linkNeutralMd: 'inline-flex cursor-pointer items-center gap-1 border-b border-current pb-0.5 text-[14px] font-semibold text-[#4E5968] transition-colors hover:text-[#191F28]',
  },
  /** Toss form input — `.field input/select` (52px / borderless #F7F8FA fill / radius 12 / 15px). */
  input: 'w-full h-[52px] rounded-xl border-0 bg-[#F7F8FA] px-3.5 text-[15px] font-medium text-[#191F28] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF]',
  /** `.idc-cred-select` unselected/placeholder state — non-mono, muted. */
  /** `.conn-progress` step-5 progress strip — v16 2552–2645 (5 data-states). */
  connProgress: {
    base: 'rounded-xl border px-4 pt-[13px] pb-3.5 mb-3.5 transition-colors',
    /**
     * 판정 표면. **채도만 낮추고 명도는 고정한다** — 한 계열에 한 채도.
     *
     * 원래 값은 면 C 0.0136~0.0181, 테두리 C 0.0395~0.0558 (OKLCH, 브라우저 실측)로,
     * 중립면(#F7F8FA, C 0.0029)의 5~6배·7~9배였다. 카드는 판을 통째로 칠하는 자리라
     * 그 채도가 화면에서 가장 큰 색 덩어리가 됐다 — 판정을 말하는 것은 문장·글리프·
     * 바의 채움이고, 면은 그것들을 묶기만 하면 된다.
     *
     * 면 C=0.012 / 테두리 C=0.030 으로 통일했다. 계열마다 달랐던 탓에 success(C 0.0181)가
     * fail(C 0.0140)보다 29% 진해 차분한 상태가 경보 상태보다 색이 셌는데, 한 값으로
     * 맞추면 세기가 아니라 색조만 의미를 나른다.
     *
     * 처음 통일한 값은 0.009 / 0.022 였고, 한 단계 되올린 것이 지금 값이다(둘 다 ×1.33 —
     * 계열 사이 비율은 그대로다). 테두리/면 = 2.5 를 유지하는 것이 요점이다: 원래는
     * 테두리가 제 면보다 3배 진해 1px 선이 판 전체보다 색이 셌고, 면만 만지면 그 역전이
     * 되살아난다. 다시 조절하게 되면 두 값을 같은 배로 움직여라.
     *
     * L 을 건드리지 않은 이유는 둘이다. (1) 이 면들은 이미 흰 판과 1.06~1.10:1 이라
     * 더 밝히면 사라지고, 어둡게 하면 오히려 더 눈에 띈다 — 명도엔 여유가 없다.
     * (2) L 고정이면 그 위 모든 대비비가 그대로 보존된다: 제목 4.75~15.27, counts
     * 4.19~4.36, 바 채움 3.03/3.58~3.16/3.73, 중립 점 2.76~2.88 — 전부 ±0.02 안이다.
     * 명도를 옮기려거든 이 네 줄을 다시 재라.
     */
    state: {
      idle: 'bg-[#F7F8FA] border-[#EBEEF2]',
      running: 'bg-[#F1F6FE] border-[#D9E5F9]',
      pending: 'bg-[#FDF8F0] border-[#F3E8D3]',
      success: 'bg-[#EFF9F3] border-[#D2EADD]',
      fail: 'bg-[#FDF1F1] border-[#F0D5D4]',
    },
    head: 'flex items-center justify-between gap-3 mb-[11px]',
    title: 'flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em]',
    titleColor: {
      idle: 'text-[#191F28]',
      running: 'text-[#191F28]',
      pending: 'text-[#B45309]',
      success: 'text-[#197A3F]',
      fail: 'text-[#B42318]',
    },
    accent: {
      idle: 'text-[#6B7684]',
      running: 'text-[#0064FF]',
      pending: 'text-[#B45309]',
      success: 'text-[#197A3F]',
      fail: 'text-[#B42318]',
    },
    icon: 'inline-grid place-items-center w-[18px] h-[18px] flex-shrink-0',
    meta: 'flex items-center gap-3.5',
    counts: 'text-[12px] font-medium text-[#6B7684] [font-variant-numeric:tabular-nums]',
    /** `counts` on the pending surface — #6B7684 on #FFF8EC is 4.37:1 (AA fail), so the
     *  policy-changed meta/guidance lines take the warning voice (orange-800, 6.3:1). */
    countsWarn: 'text-[12px] font-medium text-orange-800 [font-variant-numeric:tabular-nums]',
    /**
     * 성공 정착 카드의 다음 행동 안내. 제목의 아이콘 슬롯(18px) + `title` 의 gap-2 만큼
     * 들여써서 제목·메타와 한 열에 선다.
     *
     * 14px — 바로 위 시각 메타(`counts`)와 같은 12px 였을 때 두 줄이 한 계층으로 읽혔다.
     * 색만 한 칸 진하게 두는 것(#6B7684 → #4E5968)으로는 갈라지지 않는다: 크기가 같으면
     * 눈은 두 줄을 같은 종족으로 묶는다. 이제 16(제목) / 14(안내) / 12(메타) 로 한 칸씩
     * 내려가고, 무엇을 하면 되는지가 언제 끝났는지보다 위에 선다.
     *
     * 색은 그대로 #4E5968 이다. success 판(#EFF9F3)에서 #6B7684 는 **4.33:1** 로 AA(4.5:1)
     * 에 못 미치고(pending 판의 4.37:1 과 같은 사정 — `countsWarn` 이 존재하는 이유다),
     * #4E5968 은 **6.67:1** 이다. 14px 는 아직 large text 가 아니라 기준은 4.5:1 그대로다.
     */
    guidance: 'pl-[26px] text-[14px] font-medium leading-[1.5] text-[#4E5968] break-keep',
    /** The bucket list inside `counts` — dots replace the 가운뎃점 separators, so the
     *  segments need their own gap (12px between, 6px inside a segment). */
    countList: 'flex items-center gap-3',
    countSeg: 'flex items-center gap-1.5',
    /** The value, two steps above its 12px label — the number is what the row is for. */
    countValue: 'text-[14px] font-bold [font-variant-numeric:tabular-nums]',
    /** 범례 점 — 판정 둘은 `fillColor.success`/`fail` 을 그대로 써서 카운트 줄이 바의 범례를 겸한다
     *  (#21A157 3.07:1, #E5483D 3.63:1 on running).
     *
     *  중립(남음·진행 중·대기)이 가리키는 건 채움이 아니라 바의 빈 트랙(#E4E7EC)인데, 그 색을 8px 점에
     *  쓰면 스트립 네 표면 전부에서 1.13~1.17:1 로 사라진다. 같은 계열의 기존 중립 #8B95A1 로 한 단계
     *  내려 2.76~2.88:1 (브라우저 실측). 3:1 에는 못 미치지만 의도한 선택이다: 점 옆에 언제나 단어와
     *  숫자가 서 있어 이 점은 "내용을 이해하는 데 필요한 그래픽"이 아니고(WCAG 1.4.11 대상 밖),
     *  3:1 을 맞추려 더 어둡게 가면 가장 덜 중요한 버킷이 판정 둘보다 무거운 점을 갖게 되어
     *  계층이 뒤집힌다. 단어를 지우려거든 이 값부터 다시 재라. */
    countDot: 'h-2 w-2 rounded-full flex-shrink-0',
    countDotColor: {
      ok: 'bg-[#21A157]',
      fail: 'bg-[#E5483D]',
      rest: 'bg-[#8B95A1]',
    },
    /** 미보고·미확인 — "값이 없다"는 사실은 색이 아니라 형태(빈 파선 링)가 말한다. */
    countDotMissing: 'h-2.5 w-2.5 rounded-full border-2 border-dashed border-orange-700 flex-shrink-0',
    track: 'relative h-2 overflow-hidden rounded-full bg-[#E4E7EC]',
    /** 시안 A — 아직 판정이 오지 않은 구간의 행진 무늬(진행 중에만).
     *
     *  채움 **아래** 트랙 전체에 깔린다: 불투명한 성공·실패 채움이 그 위를 덮으므로
     *  남은 구간만 저절로 드러나고, 폭을 따로 계산하거나 채움의 250ms transition 과
     *  좌표를 맞출 일이 없다.
     *
     *  ⚠️ "모두 보고되면 채움이 다 덮으니 무늬도 저절로 사라진다"는 성립하지 않는다 —
     *  채움은 ok·fail 뿐인데 `reported` 에는 `unknown` 도 들어서, 계약 밖 값으로만
     *  보고된 구간은 덮이지 않은 채 계속 흐른다. 그래서 무늬를 그리는 쪽(TcSummaryCard)
     *  이 `reported < total` 로 명시적으로 잠근다. 이 토큰만 보고 기하에 기대지 말 것.
     *
     *  #BAC4D1 은 트랙(#E4E7EC) 대비 1.42:1 (브라우저 실측) — 판정 두 색(#21A157
     *  3.07:1 · #E5483D 3.63:1)보다 반드시 약해야 한다. 8px 높이에서 한 단계 위
     *  #8B95A1(중립 점과 같은 값)까지 올리면 남은 구간이 채워진 세 번째 띠로 읽혀
     *  카운트 줄의 점 범례가 가리키는 축이 셋이 되고, 한 단계 아래 #CDD5DE(1.20:1)는
     *  등배에서 질감이 사라져 모션이 보이지 않는다. 넷을 나란히 놓고 1:1 로 고른 값이다.
     *
     *  8px 타일 · 45° 는 Bootstrap `.progress-bar-striped` 의 기하 그대로다(퍼센트
     *  정지점이라 타일 경계에 이음매가 없다). 모션이 꺼지면 무늬만 정지한 채 남아
     *  "미판정" 은 여전히 형태로 읽힌다(Primer: 정보를 애니메이션만으로 전달하지 말 것). */
    trackMarch:
      'absolute inset-0 bg-[length:8px_8px] bg-[linear-gradient(45deg,#BAC4D1_25%,transparent_25%,transparent_50%,#BAC4D1_50%,#BAC4D1_75%,transparent_75%,transparent)] motion-safe:animate-[tc-track-march_1400ms_linear_infinite]',
    /** Skeleton bar for this strip — the shared `skeletonBar` (#F3F4F6) sits on white; on the
     *  idle surface (#F7F8FA) it is brighter than its own ground and vanishes. A step darker,
     *  the same move as the service rail's skeletonBar. */
    skeletonBar: 'animate-pulse bg-[#D6DCE0]',
    fill: 'relative h-full rounded-full transition-[width] duration-500',
    fillColor: {
      idle: 'bg-[#0064FF]',
      running: 'bg-[#0064FF]',
      pending: 'bg-[#E8A03A]',
      success: 'bg-[#21A157]',
      fail: 'bg-[#E5483D]',
    },
  },
  /** Toss textarea — borderless #F7F8FA fill / radius 12. */
  textarea: 'w-full rounded-xl border-0 bg-[#F7F8FA] px-3.5 py-3 text-[15px] font-medium leading-[1.6] text-[#191F28] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF] resize-none',
  /** Skeleton shimmer bar (loading frames) — pair with size/radius utilities. */
  skeletonBar: 'animate-pulse bg-[#F3F4F6]',
  /** Table chrome — `.db-table` (header 13px/700 #4E5968, NO uppercase; 14/16 cells; #EBEEF2 dividers). */
  table: {
    header: 'bg-[#FAFBFC] text-left text-[13px] font-bold text-[#4E5968]',
    headerCell: 'px-4 py-3.5',
    body: 'divide-y divide-[#EBEEF2]',
    // `group/row` so the chips in these rows get `tableRowLift.chipEdge` too. This tint is
    // ABOVE the whole chip band (L* 97.6), so chips stay the darker plate and mostly survive
    // it — except `tag.gray`, whose fill IS #F7F8FA, i.e. 1.00:1 and gone outright.
    row: 'group/row hover:bg-[#F7F8FA] transition-colors',
    cell: 'px-4 py-3.5',
    /** Table wrapper — `.db-list-table` border + radius + shadow (v16 1850–1869). */
    frame:
      'overflow-hidden rounded-xl border border-[#EBEEF2] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04),0_6px_16px_-8px_rgba(17,24,39,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]',
    /**
     * `frame` for a table that a `Pagination` bar closes from underneath. The bar draws its
     * own sides and the 10px bottom radius, so the two read as one box only if the table
     * stops at a straight bottom edge and carries the bar's radius and border colour
     * (#E5E7EB, `Pagination`'s own). `frame` instead closed with its own 12px round and
     * cast a shadow onto the bar, which left the bar hanging under a finished card rather
     * than continuing it. The bar's `border-t-0` still relies on the bottom border here.
     */
    framePaged: 'overflow-hidden rounded-t-[10px] border border-[#E5E7EB] bg-white',
    /** Excluded-row tint — v16 `.approval-table tr.row-excluded`. */
    rowExcluded: 'bg-[#F9FAFB]',
    /**
     * Approval-table header — v16 `.approval-table thead th` (12px/600, bg #F7F8FA; distinct
     * from the db-list-table 13px/700 header). Text is #4E5968 rather than the v16 #8B95A1,
     * which measures 2.86:1 here — see `tableStyles.header` for the full reasoning.
     */
    approvalHeader: 'bg-[#F7F8FA] text-left text-[12px] font-semibold text-[#4E5968]',
    /** Body text of a header (i) tooltip — the value-variant Tooltip's white surface. */
    headerTipBody: 'block text-[12px] leading-[1.6] text-[#4E5968]',
    /**
     * Console-grammar header (confirmed tables, 시안 F round 3) — the rule stays
     * #D1D5DB (DESIGN.md border-strong) now that the interior grid is hairline
     * (round 6): it is the one strong line left — the "table starts here" anchor,
     * which is also the consoles' pattern (only the thead rule outweighs the grid).
     *
     * Round 15 (owner): "리소스 테이블 Header 색상을 약간 파란색으로 … 헤더는 그래도
     * 보여야되는 정보같음". Round 3 argued a header band would reintroduce the frame
     * the redesign removed — that held while the only candidate was a GREY band, which
     * reads as chrome. A blue wash reads as the app's own interaction hue instead, so
     * the band labels the columns rather than boxing them. #F1F6FE is the pipeline
     * running tile's fill (1.09:1 on white); the header text keeps #4E5968 at 6.55:1.
     *
     * ⚠️ A wash costs a ramp step: the #EBEEF2 header rails fall from 1.16 to 1.07 on
     * this fill — invisible. `consoleGrid` moves the TH rail to #D9E5F9 (1.17 here),
     * this fill's own partner border elsewhere in the file. The #D1D5DB rule keeps
     * 1.36 and stays the strongest line in the table.
     */
    approvalHeaderFlat:
      'bg-[#F1F6FE] text-left text-[12px] font-semibold text-[#4E5968] border-b border-[#D1D5DB]',
    /**
     * Approval-table header, chrome variant — admin P3 only (both provider tables).
     *
     * Takes --pl-gray-100 from the filter toolbar directly above it, so the two read
     * as one band of chrome over the data instead of two greys that are close enough
     * to look like a mistake. The shared #F7F8FA is 1.03:1 from it — near enough to
     * be seen as an error, far enough to be seen.
     *
     * Sized down from 3:1 (#7E8FAE) through #C9D4E8 and #E9EEF6: every step that
     * bounded the band better also made it compete with the rows it labels. Column
     * labels are the quietest thing in a table, and contrast bounds a surface rather
     * than ranking it — the section's own border is what carries the edge here.
     *
     * Text stays the shared #4E5968 — 6.45:1 on gray-100.
     */
    approvalHeaderChrome:
      'bg-[var(--pl-gray-100)] text-left text-[12px] font-semibold text-[#4E5968]',
    /**
     * `approvalHeader` inside a confirm dialog — 14px, and the body cells go with it.
     *
     * 페이지의 표는 위아래로 툴바·필터·다른 카드에 둘러싸여 있어 12px 머리글이 제 자리를
     * 지키지만, 확인 모달 안에서는 표가 본문의 전부다. 26px 제목과 24px 타일 아래에서
     * 12px 은 각주처럼 읽혀, 승인의 근거인 표가 곁다리가 된다.
     */
    approvalHeaderDialog: 'bg-[#F7F8FA] text-left text-[14px] font-semibold text-[#4E5968]',
    /** Approval-table header cell padding — v16 12px V / 18px H. */
    approvalHeaderCell: 'px-[18px] py-3',
    /** Approval-table body cell padding — v16 `.approval-table tbody td` 16px V / 18px H. */
    approvalCell: 'px-[18px] py-4',
    /**
     * Round 4 (owner): a permanent stroke on every column boundary, header and body.
     * The confirmed tables clip cell values mid-letter at the cell edge (the Azure
     * "covered by the next column" grammar), and a cut with no visible edge reads as
     * two values running together — "경계선은 Stroke를 줘야 될듯. 안 그러면 구분이
     * 안 될 것 같음". Lives on the `<table>`; the modal resize tables keep the
     * strokeless grammar described on `resizeHandle`.
     *
     * Round 5 (owner): border-strong rails made the grid darker than the consoles it
     * quotes — "Azure나 AWS는 조금 자연스럽던데.. 너무 선이 진한거 아닌가요?". The
     * benchmark's measurements put console interior lines in the hairline band: AWS
     * live-demo row rule 0.8px #EBEBF0 (1.19:1), Fluent colorNeutralStroke2 #E0E0E0
     * (1.32:1). border-default (1.25:1) sits inside that measured band, so the rails
     * drop ONE ramp step. (The ROW dividers kept border-strong one more round; round 6
     * returned them to the shared `body` hairline — see the tbody in
     * WaitingApprovalTable.) Pairs with `tableRowLift.console`: under the
     * approval hover (#EAEEF7) these rails wash to 1.08:1 — the tint would eat the
     * very step the rails just dropped to.
     *
     * Round 7 (owner): "평소에는 구분선 없이도 경계를 표현이 필요. 왼쪽이 오른쪽에
     * 덮인 느낌 … blur나 shadow같은 효과를 줘서 깊이감을 줄 필요는 있어보임". The
     * BODY rails go entirely: the covered-clip cut exists because the next column
     * lies ON TOP of this one, so the boundary is now that sheet's cast shadow — a
     * 10px right-edge gradient inside every non-last cell, darkest AT the cut and
     * fading left.
     *
     * Round 8 (owner): "경계가 너무 눈에 띈다. 한 단계씩만 낮춰봐" — one rung down the
     * round-7 A/B ladder, α 0.09 → 0.06. The peak now composites to ≈#F1F1F2
     * (~1.13:1 on white), UNDER the row hairline (#EBEEF2, 1.16:1) and every measured
     * console band (AWS #EBEBF0 1.19:1, Fluent #E0E0E0 1.32:1). Round 7 graded 0.06
     * "subliminal at a glance", but the owner judged 0.09 too loud at rest — the
     * resting weight for THIS mark sits below the console norm.
     *
     * Round 10 (owner): "비활성 시에 경계면의 shadow나 stroke 등등을 한 단계 약하게" —
     * both resting ingredients drop one more rung. Shadow α 0.06 → 0.03 (peak ≈#F8F8F9,
     * ~1.06:1 — at the edge of perception, which is the point: the cut and the seam
     * tracer carry the boundary now). Header rails #E5E7EB → #EBEEF2, one step down the
     * repo's grey ramp to the shared hairline. The round-7 header exemption ("Header는
     * 진해도 상관없어") expired with this order naming "stroke" — the only resting
     * stroke on a column boundary IS the header rail. The thead bottom rule stays
     * #D1D5DB: it is a horizontal "table starts here" anchor, not a column boundary.
     * A background gradient, not
     * box-shadow: a shadow blurs past each cell's corners and stipples every row
     * seam, while backgrounds tile seamlessly down the column (box-shadow on
     * collapsed-border cells also renders unreliably). Header rails and the thead
     * rule stay — "Header는 진해도 상관없어". The on-demand line for "경계면 근처"
     * hover is `seamTracer` below.
     */
    // Round 15: the TH rail moved #EBEEF2 → #D9E5F9 when the header took its blue wash.
    // #EBEEF2 held 1.16:1 on white but only 1.07:1 on #F1F6FE — a wash costs a ramp step,
    // and #D9E5F9 (this fill's own partner border) restores it at 1.17:1. The BODY ramp is
    // unchanged: it sits on white/hover rows, which the header band does not touch.
    consoleGrid:
      '[&_th+th]:border-l [&_th+th]:border-[#D9E5F9] [&_td:not(:last-child)]:[background:linear-gradient(to_left,rgba(15,23,42,0.03),transparent)_right/10px_100%_no-repeat]',
    /**
     * Body cell of a `ConsoleTable` — the covered-clip grammar (round 4, owner: "왼쪽
     * 부분이 오른쪽에 덮인 느낌"). The CELL clips, so an overlong value runs through its
     * own right padding and cuts mid-letter exactly on the column stroke (overflow clips
     * at the padding box), the Azure grammar where the next column COVERS the value and
     * dragging the divider uncovers it. Children must therefore NOT self-truncate: an
     * ellipsis says "shortened here" instead of "continues underneath". nowrap keeps
     * chips and plain-text cells on the single row line without each child declaring it.
     */
    consoleCell: 'overflow-hidden whitespace-nowrap',
    /**
     * Round 7 (owner): "경계면 근처에 마우스를 올려둘때만 진하게 표현되면 좋겠음" —
     * with the resting rails gone (see consoleGrid), this is the on-demand boundary:
     * ONE absolutely positioned line in the confirmed table's scroll container, moved
     * imperatively to the nearest column seam while the pointer is inside its zone
     * (SEAM_ZONE_PX in ConsoleTable — the header handles' own 8px grammar).
     * Round 8 (owner): "너비 조절시에 잔상이 남는 효과는 삭제해봐" — the 100ms fade-out
     * lingered as an afterimage around resize gestures, so the line now cuts on/off
     * instantly. ConsoleTable additionally keeps it dark while any pointer button is
     * held and, after a width change, until the pointer leaves the seam zone.
     *
     * Round 10 (owner): "경계면 활성화시에 색상만 파란색 계열로 수정하면 딱 좋을듯" —
     * the activated boundary joins the app's one interaction blue (#0064FF, the header
     * guide's own color), so approach and grab read as one grammar. Grey #D1D5DB
     * (rounds 7–9) read as a STRUCTURAL line that was "더욱 강한" than the resting
     * boundary it stood on; blue says "interactive" instead of "wall".
     *
     * Round 12 (owner): "그냥 찐한 색의 선이 갑자기 생기는 hover잖아?? … 본문 부분은
     * 차라리 그림자가 조금 더 짙어지고 색상이 파란색으로 표현되는게 더 좋을듯" — the
     * tracer stops being a line at all. It is now the resting shadow's own hover
     * state: the same 10px right-edge ramp consoleGrid casts (right edge ON the
     * seam — ConsoleTable translates it by seam − SEAM_BAND_PX), in #0064FF at
     * α 0.12 over the resting 0.03 slate (peak ≈#DAE6F9, ~1.25:1 on white — present
     * on approach, nowhere near the solid line's 3.7:1 pop). Body only: the class
     * anchors the bottom and the mousemove pins `top` to the thead's bottom edge,
     * because the header keeps its LINE grammar (rails + the 2px grab guide —
     * "header는 뭐 봐줄만해요") and a shadow crossing it would mix the two. Zone
     * (±8px) and the round-8 latches are unchanged.
     */
    seamTracer:
      'pointer-events-none absolute bottom-0 left-0 z-10 w-[10px] bg-[linear-gradient(to_left,rgba(0,100,255,0.12),transparent)] opacity-0',
    /**
     * Round 11 (owner): "ResourceId가 종류 행에 의해서 더 많이 가려져" — the id column's
     * copy button used to RESERVE its tail (the ARN cut 46px before the boundary: 18px
     * cell padding + 22px button + 6px gap), so under the covered grammar the next
     * column read as lying deeper over the id than over any other cell. The reserve is
     * gone: the id runs to the boundary and cuts mid-letter like every covered cell,
     * and the button OVERLAYS the tail on hover instead.
     *
     * ⛔ Round 15 (owner): "resourceId에 hover로 blur처리를 했니??? 이런거 하지마." Round 11
     * kept that overlay legible with an alpha mask that ramped the tail to transparent
     * under the button — chosen because alpha works on any row surface. It reads as the
     * VALUE degrading on hover, which is exactly what an identifier must never do. The
     * button now carries its own opaque surface instead: the id stays fully inked and
     * the control simply sits on top of it, the way a control should.
     *
     * White + a hairline is what survives all three row surfaces (rest white, console
     * hover #F7F9FB, excluded hover #E3E8F2) — a fill matched to one of them would be a
     * visible patch on the other two, so the chip reads as a floating control rather
     * than as background. Parked 8px off the boundary by the caller, clear of the
     * seam's ±8px tracer zone.
     */
    copyOverlayChip: 'border border-[#E5E7EB] bg-white',
    /**
     * 열 폭 조절 손잡이 (useColumnResize) — 헤더 셀 안쪽 오른쪽 끝 8px. 밖으로 내밀면
     * 마지막 열에서 표가 가로로 넘친다. 선은 평소 보이지 않는다: 표에 세로줄을 하나 더 그으면
     * 열 구분이 두 문법이 된다. 잡을 수 있다는 사실은 커서가 말하고, 잡는 동안에만 선이 그
     * 자리를 확인해 준다. 파랑은 primary — 이 앱에서 "누를 수 있는 것"의 색이다.
     */
    resizeHandle:
      'absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:right-[3px] after:w-px after:bg-transparent hover:after:bg-[#0064FF] focus-visible:after:bg-[#0064FF] focus:outline-none',
    /**
     * `resizeHandle` for the console tables (round 5) — their grid draws a permanent
     * rail ON the boundary, and the 3px-inset guide lit up BESIDE it (guide at
     * edge−4..−3, rail astride the edge): two parallel lines reading as misregistration
     * — "미묘하게 구분선과 hover가 일치하지 않네요". The modal tables stay on
     * `resizeHandle`: no rail there to disagree with.
     *
     * Round 6 (owner): "Header의 구분선은 확실히 가리는게 좋을 것 같아". Flush-INSIDE
     * (right-0) still left the rail showing: the rail is the NEXT th's border-l, one
     * pixel past this th's edge, and the 6px vertical insets left grey stubs above and
     * below the guide. Straddling (-right-px, 2px) and full-height, the guide owns the
     * whole boundary while it shows. Depends on the th not clipping (labels
     * self-truncate instead) — an overflow-hidden th would cut the straddle's outer px.
     */
    resizeHandleOnGrid:
      'absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:-right-px after:w-0.5 after:bg-transparent hover:after:bg-[#0064FF] focus-visible:after:bg-[#0064FF] focus:outline-none',
    /**
     * Two-line identity stack — kind tag ABOVE, resource name below (RDS Cluster · EC2 · a
     * member instance's Reader/Writer chip). Lifts the stack by half its tag line so the
     * **name** lands on the row's middle, the line the one-line cells beside it already sit on
     * (Resource ID, DB Type, Region, 설치 구분).
     *
     * Without it the stack centres as a block and the name reads ~12px below every other cell:
     * an eye crossing the row steps down at the name and back up at the id. The tag is a line
     * that INTRODUCES the name, not a peer of it, so the row's alignment line is the name.
     *
     * 12 = half of the tag line (20px chip) + its 4px gap. `relative` only, never a margin:
     * the row keeps its height, so the tag rises into the cell's own 20px top padding instead
     * of shrinking the row and dragging the whole stack back down with it.
     */
    stackedIdentityLift: 'relative -top-[12px]',
    /**
     * Resource Name column — 12px more left padding than every other cell, on the header cell
     * AND the body cell so the column keeps one edge.
     *
     * The extra 12 is the seat for the hanging fold chevron (`group.toggle`), and it is the
     * sum of four things that each have to fit: the 4px `verdictRail` inset the chevron may
     * not cover, 4px of clearance from it, the 16px chevron box, and 6px between that box and
     * the first letter. At 18 the chevron started inside the rail; at 22 it cleared the rail
     * but sat on the name.
     *
     * The clearance is the fourth term because 26 (rail + box, no gap) put the chevron's box —
     * and the tint it grows on hover — flush against the rail: an excluded RDS cluster read as
     * a blue control stuck to a magenta bar. Touching is not clearing.
     * Add it next to `approvalCell`/`approvalHeaderCell` — `pl` beats their `px`, the same
     * ordering `group.childCell`'s indent already relies on.
     */
    nameCell: 'pl-[30px]',
    /**
     * Seam between adjacent `<tbody>`s — belongs on the `<table>`.
     *
     * `body`'s divide-y only draws BETWEEN the rows of ONE tbody, and a group is three
     * tbodies (rows · parent · children). So the group block lost the hairline above it,
     * the one under its parent and the one under its last child: three rows in a row with
     * no rhythm, which reads as the tree being torn rather than nested. A collapsed
     * (hidden) children tbody is still an element, so `+` lands the seam on the next
     * visible tbody in both fold states. A `<tr>` border paints because these tables inherit
     * preflight's `border-collapse: collapse`; a table that opts into `border-separate` would
     * need the seam on its cells instead.
     */
    tbodySeam:
      '[&_tbody+tbody>tr:first-child]:border-t [&_tbody+tbody>tr:first-child]:border-[#EBEEF2]',
    /**
     * Grouped parent row (Athena × Region) — Cloudscape "nested resources" 시안.
     * Chosen in `docs/ux/athena-group-samples.html` §04 over the v16 orange band.
     *
     * The parent has since moved its identity into ONE spanning cell rather than a value per
     * column (owner, 2026-08-12; recorded in `docs/ux/benchmark/step1-resource-table.md`) — once
     * the type, the region and the counts sat in the identity, the columns keyed on them printed
     * the same two facts twice on the one row that has them. Pagination still groups by unit
     * (`toPaginationUnits`); nothing sorts by column here and there is no group-level checkbox,
     * so the day either arrives it reads the GROUP, not this row.
     *
     * Every value is copied from a metric this table family already uses — the row tint
     * is `table.header`'s #FAFBFC, the chip/connector borders are the #EBEEF2 divider,
     * the label is the db-list-table 13/700 header pair. Nothing new was invented.
     */
    group: {
      /**
       * Parent row — NO tint.
       *
       * Cloudscape's nested-resource pattern specifies indentation and the expand toggle and
       * says nothing about a parent background; grouping by colour reads as "a group exists"
       * where the console's rail reads as "these are connected". Hover/focus still lifts, so
       * the row stays visibly interactive.
       */
      row: 'hover:bg-[#F7F8FA] focus-within:bg-[#F7F8FA] transition-colors duration-150 motion-reduce:transition-none',
      /**
       * Identity cluster inside the parent's first cell — the anchor the chevron hangs off,
       * so it must stay the cell's first content (x = `nameCell`'s 30px padding).
       */
      lead: 'relative flex items-center gap-2',
      /**
       * Chevron toggle — hangs in the name cell's own 30px left padding (x 8..24) instead
       * of standing in the flow.
       *
       * In the flow it cost 28px (20 box + 8 gap), so every row that folds started its name
       * 28px right of every row that does not, and the Resource Name column read as ragged
       * down a mixed list. Out of the flow the name keeps the column's one left edge and the
       * chevron reads as a margin control, which is what it is.
       *
       * 16px box, not the old 20, and the name column's 18px padding grew to 30 to seat it:
       * 4px is the `verdictRail` inset some rows carry, 4px clears it, 16px is the box, 6px
       * separates it from the name. At 18px the box had to start inside the rail; at 22 the
       * arrow read as stuck to the first letter. The pressable target stays 24px via the
       * `after` halo (x 4..28) — shrinking the tint must not shrink the thing a pointer has
       * to hit, and at 26 that halo overlapped the rail it was supposed to clear.
       *
       * ⚠️ PRECONDITION: the host cell carries `nameCell` (30px). `-left-[22px]` is 30 − 8,
       * measured from a `lead` anchor sitting on that padding — in a `childCell` (50px) host
       * the same offset lands the chevron at x 28..44, on top of that cell's own tree elbow
       * (x 12..34). In the flow the old token was indent-independent; this one is not. No row
       * pairs a fold with a group indent today (grouping is Athena-keyed, and Athena rows carry
       * neither members nor RDS instances), and this is the reason it must stay that way.
       */
      toggle:
        "absolute -left-[22px] top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-[5px] transition-[transform,background-color,color] duration-150 after:absolute after:-inset-1 after:content-[''] motion-reduce:transition-none",
      /**
       * Closed — the one state that has to advertise itself. A collapsed row is otherwise
       * indistinguishable from a plain row, so the chevron carries the primary hue, the app's
       * single interactive colour, over its own tint on hover. Both values are the palette's
       * existing primary pair (#0064FF on #E8F1FF) — the selected-chip pair, not a new blue.
       */
      toggleClosed: 'text-[#0064FF] hover:bg-[#E8F1FF] hover:text-[#0050D6]',
      /**
       * Open — chevron-right → chevron-down, and the colour recedes to neutral. The rail
       * below now draws the group; keeping the control blue would say it a second time.
       */
      toggleOpen: 'rotate-90 text-[#6B7684] hover:bg-[#EBEEF2] hover:text-[#4E5968]',
      /**
       * Open, and NOT a control — for when something else owns the open state (a filter that
       * forces every fold open while it narrows the list). Same hanging box so the label beside
       * it does not shift, but no hover and no button: a chevron that answers to nothing must not
       * offer to be pressed.
       */
      toggleStatic: 'rotate-90 text-[#6B7684]',
      /**
       * The group's NAME line — its region. One Athena catalog per region is exactly what a
       * group is, so the region is what tells two of them apart; the service rides above it as
       * the kind tag (`tagStyles.resourceKind`), the tier `RDS Cluster` and `EC2` already wear.
       *
       * One tier BELOW the child rows' name, not above it. The parent is context, not the
       * headline: the rows a user acts on are the databases. Same 14px mono as the Resource
       * Name column so it stays in that column's voice, weight 600 vs the children's 500.
       */
      label: 'whitespace-nowrap font-mono text-[14px] font-semibold text-[#4E5968]',
      /** Aggregate cells — tabular so counts stay aligned down the column. */
      meta: 'whitespace-nowrap text-[12px] tabular-nums text-[#6B7684]',
      /**
       * The counts inside `meta`, one step up from the words beside them (owner, 2026-08-12).
       *
       * "대상"/"제외" are the same two words on every group row; only the numbers differ, and the
       * number is what the row is actually reporting. Size carries the whole difference — same
       * colour, same weight — so the pair keeps reading as one phrase rather than as a value with
       * a caption stuck under it.
       */
      metaValue: 'text-[14px]',
      /**
       * Child row's first cell — the tree rail. A vertical hairline runs the full row height
       * under the parent's chevron and an elbow reaches into the name; `childCellLast` cuts
       * the rail at the elbow so the group's end is drawn, not merely implied.
       *
       * Geometry, all measured off the name cell's own 30px padding (`nameCell`):
       *   8..24   parent chevron   → rail x = 16 (its centre), hung in the padding
       *   30      parent label     (the column's left edge — the same one plain rows use)
       *   54      child name       (30 + 24 indent — the tier gap, and the elbow's length)
       * The 12px the child used to sit from the label was not a tier, it was a nudge.
       *
       * The elbow stays on `top-1/2` even though an RDS instance child is now a two-line stack
       * (role chip over name), which puts the row's centre in the gap between its two lines.
       * `parentCell`'s trunk offset IS re-derived from the chevron because it has one anchor;
       * this cell has two kinds of child — single-line Athena databases and the two-line stack —
       * and any offset that meets the stack's name line misses the single-line child. The row's
       * middle is the only point both share, and it is what the elbow connects to.
       */
      childCell:
        "relative pl-[54px] before:absolute before:bottom-0 before:left-[16px] before:top-0 before:w-px before:bg-[var(--rail,#C4CEDA)] before:content-[''] after:absolute after:left-[16px] after:top-1/2 after:h-px after:w-[22px] after:bg-[var(--rail,#C4CEDA)] after:content-['']",
      /** Last child — the rail stops at its elbow, closing the group. */
      childCellLast: 'before:bottom-1/2',
      /**
       * Parent's own name cell — carries the rail's first segment down to the first child.
       *
       * Apply ONLY while the group is open. A closed group has nothing below it, so the segment
       * dangled off the chevron pointing at an unrelated row and read as a rendering fault. Closed
       * state is the chevron alone.
       *
       * The trunk starts at the chevron BOX's bottom edge, never at the row's centre: a chevron
       * is 16px and sits on the row's middle, so it ends 8px past it and `top-1/2` drew the
       * line's first 8px straight through the glyph — the arrow read as snagged on it. Every
       * parent chevron is vertically centred (including the two-line cluster identity), so
       * `50% + 8px` is the one offset all of them need.
       */
      parentCell:
        "relative after:absolute after:-bottom-px after:left-[16px] after:top-[calc(50%_+_8px)] after:w-px after:bg-[var(--rail,#C4CEDA)] after:content-['']",
      /**
       * Rail lit — put on every `<tr>` of ONE group while its parent row is hovered, so the
       * trunk and each elbow answer together and the group says which rows it owns. The rail
       * reads its colour from `--rail`, inherited through the row, because parent and children
       * are separate rows (and, for a group, separate tbodies): no CSS combinator reaches from
       * one to the others without also catching the rows in between.
       *
       * #0064FF is the app's single interactive hue — the same value the closed chevron uses.
       */
      railActive: '[--rail:#0064FF]',
    },
    /**
     * RDS instance band — the accordion body's tree rail.
     *
     * The band is ONE colspan cell holding its own lines, not a run of child rows, so it cannot
     * reuse `group.childCell`: that token's offsets are measured from a name cell that starts at
     * the checkbox column's right edge, and this cell starts at the table's left edge. The rail
     * it draws is the same rail, re-anchored.
     *
     * Geometry — the band's content box starts at the CLUSTER's own name x (52 + 30 = 82; 30 in a
     * table with no checkbox column), and every offset below is negative from there:
     *   68   trunk        = the cluster chevron's centre, so the parent's segment and the band's
     *                       are one unbroken line (`group.parentCell` carries the first stretch)
     *   68..76  elbow     — 8px, then a 6px gap. `group`'s 22px elbow ends 16px short of its
     *                       child's name; this tier has to fit a radio in the same span, so both
     *                       shrink together rather than the gap closing to a touch
     *   82   radio        (the 16px control the elbow points at)
     *   106  instance name = 82 + 24, the same tier an Athena database hangs at. The name is what
     *                       the eye scans down, so it is the thing that has to land on the tier;
     *                       the radio lives in the gap the tier opens up, the way the group
     *                       chevron lives in the name cell's padding.
     *
     * The trunk rides each line rather than the container so the LAST line can cut it at its own
     * elbow (`lineLast`) — a rail that runs past the last thing it connects reads as a group that
     * continues below, which is exactly what this band does not do.
     */
    instanceBand: {
      /** Column-header strip — trunk only, no elbow: it labels the lines, it is not one of them. */
      headerStrip:
        "relative before:absolute before:-left-[38px] before:bottom-0 before:top-0 before:w-px before:bg-[var(--rail,#C4CEDA)] before:content-['']",
      /** One instance line — trunk through the full height, elbow reaching the radio. */
      line:
        "relative before:absolute before:-left-[38px] before:bottom-0 before:top-0 before:w-px before:bg-[var(--rail,#C4CEDA)] before:content-[''] after:absolute after:-left-[38px] after:top-1/2 after:h-px after:w-[8px] after:bg-[var(--rail,#C4CEDA)] after:content-['']",
      /** Last line — the trunk stops at its elbow, closing the band. */
      lineLast: 'before:bottom-1/2',
      /**
       * The radio, hung in the tier gap instead of standing in the flow.
       *
       * In the flow it pushed every instance name 24px right of the tier, so the one column the
       * eye scans started at a different x from the Athena children directly above it. Out of the
       * flow the name keeps the tier and the control reads as a margin affordance — the same
       * trade `group.toggle` makes with the chevron.
       */
      radio: 'absolute -left-6 top-1/2 h-4 w-4 -translate-y-1/2',
    },
  },
} as const;

/**
 * EC2 인스턴스 연동 대상 추가 — 검색 모달 · 접속 정보 폼 · Step1 행.
 *
 * 크기·간격은 IDC 연동 대상 추가 흐름에서 그대로 가져온다(같은 일을 하는 화면은
 * 같은 수치로). 여기 있는 것은 그 문법에 없던 조각뿐 — 검색창 부속, 결과 행,
 * 수정 불가 필드, 그리고 조금 큰(32px) 행 액션.
 */
export const ec2Styles = {
  /**
   * 검색 입력 — idcStyles.input 을 덮어쓰지 않고 독립 토큰으로 둔다(cn 이 단순 join 이라
   * 같은 속성을 두 번 쓰면 어느 쪽이 이길지 클래스 순서로 정해지지 않는다).
   * 폼 필드(#F7F8FA)보다 밝은 흰 면 + 실선 — 검색은 값을 담는 칸이 아니라 여는 입구다.
   * 형식 안내는 placeholder 로 안에 들어가고, 한글이 섞이므로 mono 는 값에만 건다.
   * 활성 표시는 테두리 색 하나뿐 — 링을 더하면 굵기가 다른 선 두 줄이 겹쳐 보인다.
   */
  searchField:
    'ec2-search-field h-[52px] w-full rounded-xl border border-[#E5E8EB] bg-white pl-12 pr-12 font-mono text-[15px] font-medium text-[#191F28] transition-colors focus:border-[#0064FF]', // design-exempt: mirrors idcStyles.input 15px token
  /** placeholder 는 값이 아니라 형식 예시 — 값과 같은 무게로 읽히면 안 된다. */
  searchPlaceholder: 'placeholder:font-sans placeholder:text-[#B0B8C1]', // design-exempt: placeholder hint, not content
  /**
   * 셀렉트 — OS 기본 화살표는 크기를 지정할 수 없어 11~13px 로 그려지고, 52px 필드
   * 안에서는 눌러서 여는 컨트롤로 읽히지 않는다. 기본 화살표를 끄고 20px 글리프를
   * 직접 세운다. pr-12 는 그 글리프가 값과 겹치지 않을 자리.
   */
  selectField: 'appearance-none pr-12',
  selectChevron:
    'pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4E5968]',
  searchIcon:
    'pointer-events-none absolute left-4 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#8B95A1]', // design-exempt: decorative glyph beside its own input
  /** 입력값이 있을 때만 나오는 원형 ✕ — 질의와 결과를 함께 비운다. */
  searchClear:
    'absolute right-3.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#EBEEF2] text-[#4E5968] transition-colors hover:bg-[#DDE2E8] hover:text-[#191F28]',
  /** 입력 아래 남는 한 줄 — 형식은 placeholder 가 말하므로 여기엔 개수 상한만. */
  helper: 'mt-2 text-[12px] leading-[1.6] text-[#6B7280]',
  /**
   * 두 단계가 함께 서는 고정 높이 틀. 검색 결과 수(0~5건)나 SID 필드 유무로 모달이
   * 커졌다 작아지면 같은 자리의 버튼이 매번 다른 좌표에 서서 화면이 흔들린다 —
   * 가장 큰 상태(결과 5건 / Oracle 설정)에 맞춰 높이를 잠근다.
   * -mt-3.5: 본문 기본 상단 여백 28px 를 14px 로 당겨, 헤더 아래 여백 6px 과 합쳐
   * 부제→검색창 20px 을 만든다.
   * -mx-2 px-2: 고정 높이는 세로만 자르는 것이 아니다 — overflow-y 를 걸면 가로도
   * 함께 클립되어 입력창의 focus ring 과 아웃라인이 잘려 나간다. 본문 좌우 여백
   * 40px 안쪽으로 8px 을 빌려 링이 설 자리를 만든다(내용 위치는 그대로).
   */
  stepFrame: '-mt-3.5 -mx-2 h-[452px] overflow-y-auto px-2',
  /** 검색 결과 한 행. */
  resultRow:
    'flex items-center justify-between gap-3 rounded-xl border border-[#EBEEF2] bg-white px-3.5 py-2.5 transition-colors hover:border-[#D6E7FF] hover:bg-[#F8FAFF]',
  resultId: 'font-mono text-[14px] font-semibold text-[#191F28]',
  /** 질의와 일치한 앞부분 — 어디까지 입력해서 걸린 결과인지 보여준다. */
  resultMatch: 'text-[#0064FF]',
  resultSub: 'mt-1 text-[12px] text-[#6B7280]',
  /** 이미 목록에 있는 결과의 비활성 버튼. */
  addedBtn:
    'inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-[10px] bg-[#F2F4F6] px-3 text-[12px] font-bold text-[#4E5968]',
  /** 안내 블록 — 결과 목록이 쓰는 자리를 끝까지 채운다(h-full). 목록이 있을 때와
   *  없을 때 같은 면적이라야 결과가 오가도 모달 안이 뛰지 않는다. */
  stateBox: 'flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-[#F7F8FA] px-4 text-center',
  stateTitle: 'text-[16px] font-semibold text-[#4E5968]',
  stateDesc: 'text-[12px] text-[#6B7280]',
  /** 폼 필드 라벨 (IDC 폼의 라벨과 같은 자리, 짝수 스케일). */
  fieldLabel: 'mb-1.5 block text-[12px] font-medium text-[#4E5968]',
  /** 수정 불가 필드 — 스캔이 확인한 값이라 입력이 아니라 표기다. */
  lockedInput: 'font-mono read-only:cursor-default read-only:bg-[#F2F4F6] read-only:text-[#4E5968]',
  lockNote: 'mt-2 flex items-center gap-1 text-[12px] font-bold text-[#191F28]',
  /** 잠금 이유 설명 — 배너 카드 대신 보조 텍스트 한 줄. */
  lockDesc: 'mt-1 text-[12px] leading-[1.6] text-[#6B7280]',
  /** 방금 드러난 종속 필드 — 왜 갑자기 나타났는지 보라 링으로 표시한다. */
  revealedField: 'ring-2 ring-[#DDD0FF]',
  /**
   * 방금 담긴 행 — 모션과 글자 두 층. 틴트 스윕(1.1s)이 왼→오로 한 번 훑어 시선을
   * 데려오고, 배지(4s)가 더 남아 늦게 온 시선에게 같은 사실을 읽게 한다. motion-reduce
   * 에서는 애니메이션만 끄고 배지는 그대로 서 있으므로, 움직임을 끈 사용자도 정보를
   * 잃지 않는다.
   */
  rowJustAdded: 'animate-[ec2-row-tint_1100ms_ease-in-out] motion-reduce:animate-none',
  newBadge: `ml-2 inline-flex shrink-0 items-center rounded-full bg-[#E8F1FF] px-2 py-px text-[11.5px] font-bold text-[#1747B5] animate-[ec2-new-badge_4000ms_ease-out_forwards] motion-reduce:animate-none ${tableRowLift.chipEdge}`, // design-exempt: mirrors idcStyles.kindBadge 11.5px token
  /** Step1 행의 정체성 스택 (EC2 태그 → instance id → Private IP). */
  rowStack: 'flex flex-col items-start gap-1',
  rowId: 'font-mono text-[12px] text-[#4E5968]',
  rowSub: 'font-mono text-[12px] text-[#6B7280]',
  /** 행 hover 액션 — idcStyles.rowAction 과 같은 문법의 32px 박스. */
  rowAction:
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#F7F8FA] hover:text-gray-900',
  rowActionDelete:
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#FEECEC] hover:text-[#B42318]',
} as const;

/**
 * 목록 행의 12px 라벨 — `Account` · `Subscription` · `Project` · `Tenant` ·
 * `설치 모드` · `설명`. 한 색이다.
 *
 * 처음엔 id 를 **이름 짓는** 라벨과 산문을 **여는** 라벨을 두 색으로 갈랐는데,
 * 그 구분은 읽는 사람에게 아무 일도 해 주지 않았다. 라벨은 전부 "옆에 오는 것이
 * 무엇인지" 한 마디로 말하는 같은 종류의 물건이고, 계층은 이미 크기(12 vs 14/16)와
 * 굵기가 세우고 있다. 색까지 나누면 없는 구분을 있는 것처럼 만든다.
 *
 * 브랜드 파랑(#0064FF)이 아니라 한 단 죽인 파랑인 이유: 12px 에서 브랜드 파랑은
 * 링크로 읽히고, 카드 hover 시 제목이 파래지는 것과 충돌한다.
 *
 * 대비는 흰 카드와 카드 hover 틴트 양쪽에서 잰다 — 행은 커서 아래에서 배경이 바뀌므로
 * 흰색만 통과하는 값은 hover 에서 AA 를 잃는다. 흰 카드 5.31:1, hover 틴트(#F3EEFF)
 * 4.67:1 로 양쪽 AA. 12px 본문이고 hover 쪽 여유가 0.17 뿐이라, 이 값도 hover 틴트도
 * 더 내릴 수 없다 — 둘 중 하나를 바꾸면 다른 하나를 다시 재야 한다.
 */
export const rowLabelColor = 'text-[#3B6BB5]';

/**
 * 행 우측 ⋮ 드롭다운 — 버튼 크롬 없이 흩뿌린 kebab 이 여는 패널.
 * 행마다 반복되는 보조 동작이라 chrome 은 패널에만 있고 트리거에는 없다.
 */
export const rowMenuStyles = {
  panel:
    'absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg',
  item: 'block w-full rounded-md px-3 py-2 text-left text-[12px] font-medium',
} as const;

/**
 * ServiceListPanel / ServiceSidebar — the target-source left rail.
 *
 * The rail is the page's BACK plane: a tinted, flush surface with full-bleed
 * hairlines between zones, carrying the content column (#F9FAFB ground, white
 * cards) in front of it. Anything that has to read as raised on the rail —
 * row hover, the search field, the current row's code tag — is white; the
 * single blue accent is reserved for the current-service row.
 *
 * Raw hexes live here per the no-raw-color rule; grays reuse the Toss ramp
 * (tossColors SSOT) and tile tints reuse the idcStyles.tag hex family. Every
 * pair below is measured against the RAIL's tint, not against white.
 */
export const serviceSidebarStyles = {
  /**
   * Rail surface — tinted and flush to its own edges. Two things are going on:
   *
   * Desktop nav chrome is a plane with hairlines, not cards floating on a
   * canvas — the card-stack grammar (gap + radius + shadow per group) reads as
   * a mobile screen at this width, so zones here are separated by full-bleed
   * rules instead.
   *
   * And the rail is the page's BACK plane, not its front. White made it the
   * brightest surface on screen while the content column — where the work
   * happens — sat lower at #F9FAFB, so the eye read the rail as the subject and
   * the content as leftover space; the two halves stopped looking like one
   * page. Tinting the rail puts the ladder back in order: rail → content
   * ground → white cards. Everything that must read as raised (row hover, the
   * search field, the current row's code tag) is white against this.
   *
   * The rail separates from the ground by CHROMA as much as by luminance.
   * Near-neutral #F2F4F6 on the old #F9FAFB ground measured ΔE00 1.39 — barely
   * past the just-noticeable threshold, so the 1px border was doing all the
   * work. The ground is now `canvas` (#F4F4FB, the app's own blue-leaning
   * surface) on both pages that mount this rail, so the rail goes the other way
   * — toward neutral — and the pair reads on hue as well as level.
   *
   * At #EFF2F3 the three planes of the page (rail 95.3, ground 96.4, card 100)
   * sat inside 4.7 L* of each other, so none of them read as raised; this drops
   * the BACK plane far enough for the stack to read as a stack.
   *
   *   rail vs ground   ΔE00 3.79 → 4.71
   *   rail vs white    ΔE00 3.10 → 5.71   (rowActive lifts twice as far)
   *   L* 95.3 → 91.4, under the ground's 96.4 — the ladder holds
   *
   * Everything printed ON the rail moves with it, or it disappears into the new
   * surface — that is why `count`/`rowCode`/`divider`/`skeletonBar` carry their
   * own numbers below, and why `sectionLabel` and `footerPage` had to leave
   * #666D7B (4.17:1 here) for #4E5968 (5.71:1). `text-gray-500` is not usable on
   * this surface at all (3.88:1), and neither is `primaryColors.text` (3.95:1) —
   * see `emptyText`/`emptyAction`, which exist so those two pairs are declared
   * next to the surface instead of being discovered on a consumer.
   */
  surface: 'bg-[#E2E7EA]',
  /**
   * The ground this rail sits beside — the app canvas, not gray-50.
   *
   * The two pages mounting the rail had different grounds: /services used
   * gray-50 (#F9FAFB) and /target-sources inherited the body canvas (#F4F4FB).
   * One rail on two grounds cannot be tuned against both. Unifying on the
   * canvas also fixes the weaker of the two: white cards on #F9FAFB measured
   * ΔE00 1.20 — under the JND, so the cards were carried entirely by their
   * borders — and read at 4.12 on the canvas.
   */
  canvas: 'bg-[#F4F4FB]',
  /** Full-bleed hairline between rail zones — darker than the rail, or it inverts. ΔE00 3.45. */
  divider: 'border-[#D2D8DC]',
  /** Rail heading — nav-chrome tier, deliberately under the content column's page title. */
  title: 'text-[14px] font-semibold tracking-[-0.01em] text-[#191F28]',
  /**
   * Total beside the rail title — a pill, so it reads as a count attached to the
   * heading rather than as a second word in it. Round, unlike the square code
   * tags: one is a quantity, the other an identifier.
   *
   * The plate is LIGHTER than the rail, not darker. It used to be #E7EAEE, a step
   * down from a near-white surface; on the deeper rail that same value lands ΔE00
   * 1.44 away and vanishes. Going up instead is also the truer reading — a plate
   * with something printed on it sits on the rail, it is not a hole in it.
   */
  count:
    'inline-flex items-center rounded-full bg-[#F1F4F5] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#4E5968]',
  /**
   * Section label above the rows — desktop nav section header, not a table column
   * head. #4E5968, not #666D7B: the latter reads 4.17:1 on this rail, under AA.
   */
  sectionLabel: 'text-[12px] font-medium tracking-[0.02em] text-[#4E5968]',
  /**
   * Row name — wraps rather than riding off the rail's edge; service names run to ~30 characters.
   * `leading-6` moves with the 16px size: at the old `leading-5` the ratio would drop to 1.25, and
   * this is the one label in the rail that routinely runs to the `line-clamp-3` limit.
   */
  rowName: 'text-[16px] font-medium leading-6 text-[#191F28]',
  /**
   * Row code — a Toss tag in its own right-hand column. Service codes are always
   * three characters, so `min-w` sizes the column to exactly that and every code
   * lands on one x down the list; a longer code would still grow rather than
   * clip. Packed against the name instead, it would sit at a different x on
   * every row, and a 30-character name would push it out of the row.
   */
  rowCode:
    'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-[#F1F4F5] px-1.5 py-0.5 font-mono text-[12px] font-medium leading-5 text-[#4E5968]',
  /**
   * Row fill under pointer hover or keyboard focus — full-bleed and square, the
   * way a web list row highlights. Lighter than the rail, so the row under the
   * cursor lifts toward the reader — but no longer all the way to white.
   *
   * A hover is a pointer echo, not a state, so it stays UNDER the selected row's
   * own step: rail → current tint is ΔL* 3.6, and this is ΔL* 2.7 (1.07:1, ΔE
   * 3.6 — above the ~2.3 at which two surfaces are seen as different at all).
   * White was ΔL* 8.6 (1.25:1), more than twice the state it passed over, and
   * #F6F6F6 was still 5.5.
   *
   * The old note here said gray-50 measured 1.03 on this rail and could not be
   * seen; that number was taken against the LIGHTER rail (#F2F4F6, where it is
   * 1.06). On today's #E2E7EA gray-50 is 1.19 — the constraint it encoded is
   * gone, which is what left room to come down this far.
   *
   * Neutral, not a pale violet: the violet band belongs to "you are here", and a
   * hover that borrowed it would read as selecting the row.
   */
  rowActive: 'hover:bg-[#EEEEEE] focus-visible:bg-[#EEEEEE]',
  /**
   * The row for the service the page is about — tint + 2px accent bar, the way a
   * desktop rail marks "you are here". It replaced a pinned band above the list:
   * the page header already names the service, so the band only repeated it.
   *
   * The bar rides the RIGHT edge, against the content column the row is about —
   * the same edge the admin console rail marks (`serviceListStyles.itemActive`).
   *
   * VIOLET, not the brand blue, and the same violet the target-source card rows
   * hover to (`tableRowLift.card` #F3EEFF) — one family for "this is the row you
   * are on", whichever list you are in.
   *
   * Levels are the blue pair's, byte for byte — every value keeps its
   * counterpart's L*, so contrast is unchanged:
   *
   *   tint vs rail      1.10 → 1.10      ink #191F28 on tint  14.56 → 14.58
   *   bar vs tint       4.33 → 4.42      bar vs rail          4.03 (1.4.11 ≥ 3)
   *
   * The tint lands ON #F3EEFF exactly — the blue tint already shared that L*.
   *
   * CHROMA is NOT carried over from the blue. Violet at blue's chroma reads far
   * hotter than blue does — a UI blue at C90 is ordinary, a violet at C90 is
   * neon — and the rail is a back plane, so the whole set sits under the
   * reference rather than at it: bar C90.5 → 44.7, ink C81.0 → 44.9.
   *
   * And the tint carries NO brightness step: L* 91.4, the rail's own level, so
   * the pair differs on hue alone (chroma 2.3 → 8.0, 3.5×; luminance 1.000:1).
   * Every lighter value tried — the reference #F3EEFF and the toned #F2EFFA both
   * sit ΔL* +3.6 up — read as a lit band on a grey rail, brighter than anything
   * else on the plane including the page's own cards.
   *
   * That also sorts the rail's three signals onto their own channels: hover
   * LIFTS (+2.7 L*, neutral), current is HUE (violet at the rail's level),
   * pressing a current row goes DOWN (−2.5 L*). None of them is competing on
   * brightness with the others.
   *
   * The reference (#F3EEFF) is still what the hue is FROM; it is a card hover on
   * white, where the same colour has a brighter ground to spend it against.
   */
  rowCurrent:
    'relative bg-[#E9E4F3] hover:bg-[#E2DDEE] focus-visible:bg-[#E2DDEE] before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:bg-[#7465B0] before:content-[""]',
  /** Code tag on the current row — the violet at #0050D6's level (6.71:1 on white), at the bar's chroma. */
  rowCodeCurrent:
    'inline-flex shrink-0 min-w-[38px] items-center justify-center rounded-[6px] bg-white px-1.5 py-0.5 font-mono text-[12px] font-semibold leading-5 text-[#5F519A]',
  /** Hairline between rows — rows that stretch to fill the rail need a rule to read as a list instead of as floating text. */
  rowDivide: 'divide-y divide-[#D2D8DC]',
  /** Skeleton bar for the rail — a step darker than the surface, or it vanishes into it. */
  skeletonBar: 'animate-pulse bg-[#D6DCE0]',
  /**
   * The same bar for the CONTENT column, which stands on `canvas` (#F4F4FB) and not
   * on the rail. The rail's #D6DCE0 is ΔE00 6.63 there — more than twice its own
   * 2.55 against the rail, so the two loading frames on one screen would not read as
   * one frame. #E5E7EB measures 3.50: a shade louder than the rail's bar, which is
   * what two shapes on a wide empty column need next to eight stacked rows.
   *
   * `idcStyles.skeletonBar` (#F3F4F6) is the white-plane version and lands on 2.67
   * here — usable, but it belongs to another screen's block.
   */
  canvasSkeletonBar: 'animate-pulse bg-[#E5E7EB]',
  /** 28px square icon tile — the row's scan anchor, sized up for the taller row. */
  tile: 'flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[12px] font-semibold leading-none',
  /** Tinted tile pairs, picked by a stable code hash so a service keeps its color across pages. */
  tilePalette: [
    'bg-[#E8F1FF] text-[#1747B5]',
    'bg-[#E5F8EE] text-[#197A3F]',
    'bg-[#FEF0E1] text-[#7A3F0E]',
    'bg-[#EEF2FF] text-[#4338CA]',
    'bg-[#FEECEC] text-[#B42318]',
    'bg-[#F7F8FA] text-[#4E5968]',
  ],
  /**
   * Page indicator docked to the rail's bottom. No rule above it: a full-bleed
   * border made the bar read as a second section closing the list, when all it
   * carries is "which page". `mt-auto` keeps it on the bottom edge even when a
   * short result leaves the list ending mid-rail. The total moved to the title
   * pill, so nothing here counts rows.
   */
  // 2026-08-11 오너 지시로 이 푸터의 모든 치수를 +2px 했다 (gap 4→6, px 12→14,
  // py 10→12, footerPage 12→14, pagerBtn 24→26 / r4→r6, 화살표 12→14). 하나만
  // 키우면 그 하나가 나머지에서 떨어져 나오므로 세 토큰과 SVG 는 함께 움직인다.
  footer: 'mt-auto flex shrink-0 items-center justify-center gap-1.5 px-3.5 py-3',
  /**
   * The rail's empty result. `textColors.tertiary` reads 3.88:1 here — and this is
   * the one state where the message IS the rail's only content, so it cannot be the
   * quietest tier available.
   */
  emptyText: 'text-[14px] text-[#4E5968]',
  /**
   * Its recovery control. `primaryColors.text` (#0064FF) is 3.95:1 on this surface;
   * #0050D6 is 5.40:1 — the same substitution `rowCodeCurrent` already makes.
   */
  emptyAction: 'text-[12px] cursor-pointer text-[#0050D6] hover:text-[#003FA8]',
  /**
   * The standing hint at the rail's foot. Prose, so it does not borrow
   * `sectionLabel`'s nav tracking. #4E5968 is the rail's body ink at 5.71:1 —
   * `textColors.tertiary` is 3.88:1 on this surface.
   */
  hintText: 'text-[12px] leading-[18px] text-[#4E5968]',
  /** "1 / 2 페이지" — tabular so the digits do not jitter as pages change. */
  footerPage: 'px-1.5 text-[14px] font-medium tabular-nums text-[#4E5968]',
  /**
   * Borderless ghost pager — a bordered button pair floats like a card control on a
   * flush rail. The disabled glyph is #8B95A1, not #B0B8C1: 1.4.11 exempts inactive
   * controls, but at 1.61:1 on this surface the arrow was a smudge rather than a
   * greyed-out arrow. 2.44:1 still reads as unavailable next to the live one at 5.71.
   *
   * Hover turns the arrow brand-blue. #0064FF is only 3.95:1 on the rail itself —
   * unusable — but it never lands there: `hover:bg-white` fires on the same event,
   * so the blue is always read against white (4.92:1). The two hover rules are one
   * effect; splitting them puts the blue back on the rail.
   *
   * `disabled:hover:text-*` restates the disabled ink instead of trusting variant
   * order to resolve it — an arrow that turns blue under the cursor advertises a
   * page that is not there.
   */
  pagerBtn:
    'flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[#4E5968] transition-colors hover:bg-white hover:text-[#0064FF] disabled:cursor-not-allowed disabled:text-[#8B95A1] disabled:hover:bg-transparent disabled:hover:text-[#8B95A1]',
} as const;

// =============================================================================
// 레이아웃 (Layout)
// =============================================================================

/**
 * 간격 (Spacing)
 */
export const spacing = {
  cardPadding: 'p-6',
  sectionGap: 'gap-6',
  formGap: 'space-y-5',
  buttonGap: 'gap-3',
} as const;

/**
 * 테두리 라운딩 (Border Radius)
 */
export const borderRadius = {
  /** v15 Toss big-surface radius (--toss-radius-card 20px). */
  card: 'rounded-[20px]',
  button: 'rounded-lg',
  badge: 'rounded-full',
  input: 'rounded-lg',
} as const;

/**
 * 그림자 (Shadows)
 */
export const shadows = {
  card: 'shadow-sm',
  modal: 'shadow-xl',
  button: 'shadow-sm hover:shadow',
  /** Soft pill shadow for active toolbar button / segmented control item */
  pill: 'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  /** Primer-style hairline lift — 1px offset, no blur. The border does the
   *  separating; the shadow only hints "resting on top" (GitHub Actions panel
   *  grammar, Step 4 grouped card). */
  hair: 'shadow-[0_1px_0_rgba(25,31,40,0.04)]',
  /** Selected rail item — inset hairline ring + hair. An outline would collide
   *  with the focus-visible ring, so the ring is an inset box-shadow.
   *  Ring color = gray-200 (#E5E8EB). */
  hairRing: 'shadow-[inset_0_0_0_1px_rgba(229,232,235,1),0_1px_0_rgba(25,31,40,0.04)]',
} as const;

// =============================================================================
// 헬퍼 함수 (Helper Functions)
// =============================================================================

/**
 * 여러 클래스를 조합합니다.
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

/**
 * 버튼 클래스를 생성합니다.
 */
export const getButtonClass = (
  variant: keyof typeof buttonStyles.variants = 'primary',
  size: keyof typeof buttonStyles.sizes = 'md'
): string => {
  return cn(buttonStyles.base, buttonStyles.variants[variant], buttonStyles.sizes[size]);
};

/**
 * 입력 필드 클래스를 생성합니다.
 */
export const getInputClass = (state?: 'error' | 'success'): string => {
  if (state === 'error') return cn(inputStyles.base, inputStyles.error);
  if (state === 'success') return cn(inputStyles.base, inputStyles.success);
  return inputStyles.base;
};

// =============================================================================
// Motion tokens (RAF wave-front animation — see process-bar-animation.md)
// Slow Version is the production default (3x prototype's normal speed).
// =============================================================================

export const motion = {
  fillMsMin: 1260,
  fillMsMax: 3600,
  circleMs: 540,
  iconCrossfadeMs: 660,

  baseSpeed: 0.53,
  stepBonus: 108,

  visualHandoff: 0.98,
  pulseAmplitude: 0.06,

  fillEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  circleEasing: 'cubic-bezier(0.2, 0, 0, 1)',
  crossfadeEasing: 'cubic-bezier(0.33, 1, 0.68, 1)',

  colors: {
    pendingBg: colorRaw.pendingBg,
    currentBg: colorRaw.primary,
    completedBg: colorRaw.success,
    pendingText: colorRaw.pendingText,
    activeText: colorRaw.white,
  },
} as const;

// =============================================================================
// LIN-25 Admin Pipeline design system (pipelineStyles)
// =============================================================================

/**
 * The pipeline admin design system. ALL color + typography classes for the
 * LIN-25 pipeline components live here — feature code (app/integration/admin/
 * pipelines/**) must carry no raw color classes (repo hard gate). Every color
 * references a `--pl-*` custom property declared in app/globals.css via Tailwind
 * v4 arbitrary-var syntax `…-[var(--pl-*)]` (the form this setup compiles — see
 * existing `identityBarStyles`). Sizes/letter-spacing/line-
 * heights are copied VERBATIM from design-inventory §4/§5 (do NOT snap to the
 * spacing ladder). SSOT: design/pipeline/admin-pipeline.html.
 *
 * No raw hexes live here — even the sidebar-chrome-only grey (#B9C0CC) and white
 * (#FFFFFF) route through `--pl-chrome-item` / `--pl-white` (app/globals.css)
 * so a grep for `#[0-9a-fA-F]{6}` over this section stays clean.
 */

/** Text roles — design-inventory §4 typography table (exact size/weight/lh/ls). */
const pipelineText = {
  /** page h1 — 24 / 700 / 1.2 / -.02em / strong. */
  pageTitle: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** dashboard h1 (page.tsx-exclusive, Figma Make redesign) — 24 / 600 / strong. */
  dashboardPageTitle: 'text-[24px] font-semibold leading-[1.2] text-[var(--pl-text-strong)]',
  /** section-title — 20 / 600 / 1.2 / strong. */
  sectionTitle: 'text-[20px] font-semibold leading-[1.2] text-[var(--pl-text-strong)]',
  /** dashboard "작업 목록" list-header title (Figma Make redesign) — 16 / 600 / strong. */
  dashboardListTitle: 'text-[16px] font-semibold leading-[1.2] text-[var(--pl-text-strong)]',
  /** section-desc — 14 / 400 / 1.4 / weak. Was 12: at that size the sentence under a
   *  20px title read as fine print, and on 연동 요청 조회 it carries the one rule an
   *  admin has to know before approving (NLB Index is editable until 승인). Shared by
   *  every SectionHeader, so the role keeps one size. */
  sectionDesc: 'text-[14px] font-normal leading-[1.4] text-[var(--pl-text-weak)]',
  /** subsection-title — 14 / 600 / medium. */
  subsectionTitle: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
  /** modal h3 — 16 / 700 / 1.2 / strong. */
  modalTitle: 'text-[16px] font-bold leading-[1.2] text-[var(--pl-text-strong)]',
  /** idbar pname — 16 / 700 / 1.2 / -.02em / strong. */
  identityName: 'text-[16px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** body / td / note — 14 / medium. */
  body: 'text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  /** note — 14 / medium (recipe desc, modal note). */
  note: 'text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  /** meta / caption — 12 / 400 / weak. */
  meta: 'text-[12px] font-normal leading-[1.4] text-[var(--pl-text-weak)]',
  /** mono caption — 12 / strong / mono. */
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** faint mono formula — 12 / faint / mono. */
  formula: 'text-[12px] leading-[1.4] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]',
  /** link — primary / 600 / underline on hover. */
  link: 'text-[var(--pl-primary)] font-semibold cursor-pointer hover:underline',
  /** muted inline text — weak. */
  muted: 'text-[var(--pl-text-weak)]',
  /** kv key — 12 / 600 / weak. */
  kvKey: 'text-[12px] font-semibold leading-[1.4] text-[var(--pl-text-weak)]',
  /** kv value — 14 / 500 / strong. */
  kvValue: 'text-[14px] font-medium leading-[1.4] text-[var(--pl-text-strong)]',
  /** kv value (mono variant) — 12 / mono / strong. */
  kvValueMono: 'text-[12px] font-medium leading-[1.4] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** idbar field key — 12 / 600 / faint. */
  fieldKey: 'text-[12px] font-semibold text-[var(--pl-text-faint)]',
  /** idbar field value — 14 / 600 / MONO / strong. */
  fieldValue: 'text-[14px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** meta-group label — 12 / 600 / faint. */
  metaGroupLabel: 'text-[12px] font-semibold text-[var(--pl-text-faint)]',
  /** stat tile label — 12 / 400 / weak. */
  statLabel: 'text-[12px] font-normal text-[var(--pl-text-weak)]',
  /** stat value denominator — 20 / 500 / faint. */
  statDen: 'text-[20px] font-medium text-[var(--pl-text-faint)]',
  /** status-bar current label — 14 / 600 / medium. */
  statusCurrent: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
  /** sidebar caption — 12 / 600 / +.06em / uppercase.
   *  On the gray-900 sidebar the ramp runs the other way: quieter means LIGHTER, so
   *  gray-500 (a page-ground value) landed at 3.57:1 there. gray-400 is 6.89:1 and
   *  still reads below the idle items (--pl-chrome-item, 9.70:1), which is the only
   *  thing the caption has to stay under. */
  sidebarTitle: 'text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pl-gray-400)]', // design-exempt: gray-400 on the gray-900 sidebar (6.89:1), not on white
} as const;

/** 유형 키 — theme 은 도메인 타입을 import 하지 않는다(PipelineStatusToneKey 와 같은
 *  규칙). PipelineType 과 어긋나면 PipelineTypeTag 의 인덱싱에서 컴파일이 깨진다. */
type PipelineTypeToneKey = 'INSTALL' | 'DELETE' | 'CUSTOM';

/** Semantic status → the four status tokens (bg tint, text, solid dot, border). */
type PipelineStatusToneKey =
  | 'PENDING'
  | 'RUNNING'
  | 'IN_PROGRESS'
  | 'READY'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED';

/**
 * Status hue map (owner: "Running -> 파란색, FAILED -> 빨간색, DONE -> 초록색,
 * PENDING -> 회색. 채도비만 맞춰. 아이콘은 빼").
 *
 * This replaces a monochrome weight ladder (quiet tint → settled tint →
 * outlined ink → red) that leaned on the status ICON to say what the hues used
 * to. The icon is gone — an outlined white RUNNING chip with a spinner read as
 * a button on the ops 현재 작업 card — so hue carries the state again.
 *
 * 채도비: all four sit on the SAME rung of their ramp (50 fill / 300 stroke /
 * 700 ink), so they match on saturation and contrast by construction rather
 * than by eye. Measured 5.1:1 (ok) .. 7.0:1 (off), all AA.
 */
const PILL_QUIET =
  'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)] border border-[var(--pl-off-border)]';
/** Reached a terminal, non-failed outcome. */
const PILL_SETTLED =
  'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)] border border-[var(--pl-ok-border)]';
/** Happening now. */
const PILL_ACTIVE =
  'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] border border-[var(--pl-info-border)]';
/** Failed — the one state where reading like its neighbours is a safety bug. */
const PILL_ALERT =
  'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]';

const PIPELINE_PILL_TONE: Record<PipelineStatusToneKey, string> = {
  PENDING: PILL_QUIET,
  RUNNING: PILL_ACTIVE,
  IN_PROGRESS: PILL_ACTIVE,
  READY: PILL_QUIET,
  DONE: PILL_SETTLED,
  FAILED: PILL_ALERT,
  CANCELLED: PILL_QUIET,
  BLOCKED: PILL_QUIET,
};


/** Shared input/select chrome WITHOUT horizontal padding (callers add px so the
 *  search variant's pl-30 never collides with a base px in the join). */
const pipelineInputBase =
  'h-8 rounded-lg border border-[var(--pl-border-strong)] text-[14px] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-weak)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]';

export const pipelineStyles = {
  text: pipelineText,

  /** Section layout chrome (dark sidebar + light content). */
  layout: {
    // Base typography (prototype `html,body`: ls -.014em, lh 1.4, Geist+Korean
    // stack) on the section root so all descendants inherit it — overrides the
    // app body's -.018em and wires --pl-font-sans (the Korean fallback chain).
    // Shell height: the prototype's own `.topnav` is 52px (calc(100vh - 52px)),
    // but this app doesn't use that prototype topnav — it renders inside the
    // REAL app chrome, TopNav (app/components/layout/TopNav.tsx, `h-14` = 56px).
    // 56 here is a deliberate deviation from the prototype's 52 so the shell's
    // min-height matches the actual viewport remainder under the app's TopNav.
    shell: 'flex min-w-[1080px] min-h-[calc(100vh_-_64px)] bg-[var(--pl-bg-page)] tracking-[-0.014em] leading-[1.4] [font-family:var(--pl-font-sans)]',
    sidebar:
      // Sticky under the 56px TopNav so the section nav never scrolls away.
      'w-[216px] flex-none bg-[var(--pl-gray-900)] px-3 py-4 sticky top-[64px] self-start h-[calc(100vh_-_64px)] overflow-y-auto',
    sidebarTitle: cn(pipelineText.sidebarTitle, 'block px-2.5 pt-2 pb-2.5'),
    // Item base carries no text color/weight — idle/active own it (plain `cn` join
    // has no tailwind-merge, so overlapping utilities must never co-occur).
    // Flex row: 16px glyph · label · right-docked count badge (gap 8, like TopNav).
    sidebarItem: 'flex items-center gap-2 px-2.5 py-[7px] mb-0.5 rounded-md text-[14px] cursor-pointer',
    sidebarItemIdle: 'font-medium text-[var(--pl-chrome-item)] hover:bg-[var(--pl-gray-800)]',
    sidebarItemActive:
      'bg-[var(--pl-gray-800)] text-[var(--pl-white)] font-semibold shadow-[inset_2px_0_0_var(--pl-primary)]',
    // R18: 1280 → 1440 — the detail page's flow card needs the width (owner:
    // "margin이 오른쪽으로 너무 크게"); tables are row-scan content and may stretch.
    content: 'flex-1 min-w-0 max-w-[1440px] px-8 pt-6 pb-12',
    // Dashboard-only: no max-width cap, fills the viewport (owner request — see
    // layout.tsx's isDashboard check). Other pipelines pages keep `content`.
    contentFluid: 'flex-1 min-w-0 px-8 pt-6 pb-12',
    // Pipeline-detail-only: fluid width AND a full-height flex column so the
    // Task 흐름 canvas can stretch to the bottom (owner: "하단까지 쭉", "우측
    // 빈 공간 제거"). The detail view's bleed root is flex-1 inside this.
    // The max-height is what makes that "full height" real: `shell` only sets a
    // MIN height, so without the cap the task drawer's content grew this column
    // (and the page) instead of scrolling inside the panel (owner 2026-08-16).
    contentDetail: 'flex-1 min-w-0 min-h-0 max-h-[calc(100vh_-_64px)] flex flex-col px-8 pt-6 pb-12',
  },

  /** Card surfaces (§5). */
  card: {
    base: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[10px] shadow-[var(--pl-shadow-xs)] px-6 pt-5 pb-6',
    /** Stacked below another card in the same section (mt 16). */
    stack: 'mt-4',
    /** KPI stat tile (Figma Make redesign) — white card, r12, border, p-5,
     *  soft shadow; centered badge→label→value column. */
    stat: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[12px] shadow-[var(--pl-shadow-xs)] p-5',
    /** Horizontal-overflow wrapper for a table inside a card (§ .tblwrap). */
    tableWrap: 'overflow-x-auto',
    /** No-padding card (Figma dashboard mock table-card) — children own their
     *  own padding/dividers; overflow-hidden clips the table's square corners
     *  to the card radius. Used by the pipeline detail's section cards
     *  (`TargetPipelineSections`); the dashboard list no longer wears a card. */
    flush: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[12px] shadow-[var(--pl-shadow-xs)] overflow-hidden',
  },

  /** KPI card period badge (Figma Make redesign) — neutral rounded-md chip with
   *  a hairline border, above the label ("현재" / "최근 24시간"). */
  /** Section header (title 64/0/12 margins; desc R22.5: 16 below title — the
   *  R18 8px read cramped to the owner — 16 above content). mt-4 vs the
   *  title's mb-3 collapses to 16px (block siblings). */
  section: {
    title: cn(pipelineText.sectionTitle, 'mt-16 mb-3'),
    titleFirst: cn(pipelineText.sectionTitle, 'mt-0 mb-3'),
    desc: cn(pipelineText.sectionDesc, 'mt-4 mb-4'),
    /** 섹션 머리 바로 아래에 오는 설명 — `cn` 은 단순 join 이라 desc 에 mt-0 을 덧붙여도
     *  CSS 순서상 mt-4 가 이긴다. titleFirst 와 같은 이유로 변형을 따로 둔다. */
    descFirst: cn(pipelineText.sectionDesc, 'mt-0 mb-4'),
  },

  /** StatusPill — h20 pad 0 9 0 8 (lg h28 pad 0 12 0 10), icon 12/14. Size lives
   *  entirely in md/lg (never in base) so the two never collide in a join.
   *  `tone` is icon-less now (see PILL_*), but base/md/lg still carry the gap
   *  and icon-side padding for the other pills built on this grammar
   *  (scanShared, StepPill, TerraformStatusModal, tc/bits …), which do have one. */
  pill: {
    base: 'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-[0.02em]',
    md: 'h-5 pr-[9px] pl-2 text-[12px]',
    lg: 'h-7 pr-3 pl-2.5 text-[14px]',
    tone: PIPELINE_PILL_TONE,
  },

  /**
   * PipelineTypeTag (R18 §1) — bg-less inline tag so it never competes with the
   * status word one column over.
   *
   * 색은 **글리프만** 입는다 (오너 2026-08-15). 2026-08-14 에 유형 틴트를 걷었던
   * 이유는 "DELETE 빨강이 같은 행 실패 빨강과 한 가족"이었는데, 그때는 틴트가
   * 글리프와 라벨을 함께 물들여 유형이 색까지 셋째 채널로 말하고 있었다. 지금은
   * 채널이 갈린다 — **유형은 글리프, 상태는 낱말**. 같은 #B42318 이 한 행에 두 번
   * 나와도 하나는 20px 도형이고 하나는 12px 낱말이라 서로를 덮지 않는다.
   * 라벨은 `--pl-text-medium` 고정: 색을 두 곳에 주면 08-14 의 문제로 되돌아간다.
   *
   * mono 선언은 뺐다 — 라벨이 wire enum(`INSTALL`)에서 한글(`설치`)로 바뀌면서
   * 근거가 사라졌다(`--pl-font-mono` 는 이미 sans 별칭이라 픽셀은 그대로).
   */
  typeTag: {
    base: 'inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-text-medium)]',
    /** 글리프 전용 틴트. 도형(비텍스트)이라 WCAG 1.4.11 의 3:1 이 기준선 —
     *  실측 흰 행 / hover(#F6F3FF): install 5.41/4.94 · delete 6.57/6.01 ·
     *  custom 6.62/6.05. 전부 텍스트 기준(4.5:1)도 넘으므로 라벨과 붙어 서도
     *  둘 중 하나만 흐려 보이는 일은 없다. */
    glyphTone: {
      INSTALL: 'text-[var(--pl-type-install)]',
      DELETE: 'text-[var(--pl-type-delete)]',
      CUSTOM: 'text-[var(--pl-type-custom)]',
    } satisfies Record<PipelineTypeToneKey, string>,
  },

  /** JobKindTag — the terraform action (PLAN/APPLY/DESTROY) on a job node.
   *
   *  This is the ACTION, not a status, so it is exempt from the monochrome
   *  status ramp: rendering it in grey buried it against the node's own grey
   *  text. Tinted fill + matching stroke on two axes:
   *
   *  - HUE says what the action IS. Violet PLAN (--pl-plan, the Terraform
   *    mark's family) = ask what would change; blue APPLY = commit it; red
   *    DESTROY = remove it. PLAN and APPLY used to share the blue and differ
   *    only by stroke weight, which is the weakest channel on a 10px chip —
   *    they read as one tag.
   *  - STROKE says whether infrastructure actually moves: pale ring for PLAN
   *    (a dry run changes nothing), full-strength for APPLY and DESTROY.
   *
   *  Green APPLY was dropped along the way: it marked the ordinary case and
   *  diluted the red. Grey PLAN is out for the same reason grey was: it buries
   *  against the node's own grey text. */
  jobKindTag: {
    base: 'inline-flex items-center rounded border px-1 leading-[15px] text-[10px] font-bold tracking-wide [font-family:var(--pl-font-mono)]',
    tone: {
      PLAN: 'border-[var(--pl-plan-ring)] bg-[var(--pl-plan-bg)] text-[var(--pl-plan)]',
      APPLY: 'border-[var(--pl-primary)] bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
      DESTROY: 'border-[var(--pl-err)] bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
    } as Record<'PLAN' | 'APPLY' | 'DESTROY', string>,
  },

  /** InfraSideTag — 서비스측/BDC측 ownership of a task's infrastructure, next to
   *  the JobKindTag. Same bordered no-fill grammar (subordinate to status pills);
   *  SERVICE reads info-blue so the two sides scan apart at a glance. */
  infraSideTag: {
    base: 'inline-flex items-center rounded border px-1 leading-[15px] text-[10px] font-semibold whitespace-nowrap',
    tone: {
      SERVICE: 'border-[var(--pl-info-border)] text-[var(--pl-info-text)]',
      BDC: 'border-[var(--pl-border-strong)] text-[var(--pl-text-medium)]',
    } as Record<'SERVICE' | 'BDC', string>,
  },

  /** Filter chips (R18 §4, Komiser reference) — scope chips (no ×) + removable
   *  active-filter chips on a 28px pill. Key weak · value strong; the remove
   *  button keeps a ≥20×28 hit area. */
  filterChip: {
    row: 'flex items-center gap-2 flex-wrap mt-2 mb-4',
    base: 'inline-flex items-center h-7 gap-1.5 rounded-full border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[12px]',
    removable: 'pr-1.5',
    key: 'text-[var(--pl-text-weak)]',
    value: 'font-semibold text-[var(--pl-text-strong)]',
    remove:
      'inline-flex items-center justify-center w-5 h-7 -my-px rounded-full text-[var(--pl-text-faint)] hover:text-[var(--pl-text-medium)] cursor-pointer',
    reset:
      'inline-flex items-center h-7 px-2 rounded-md text-[12px] font-semibold text-[var(--pl-text-weak)] hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)] cursor-pointer',
    count: 'ml-auto text-[12px] text-[var(--pl-text-weak)] tabular-nums',
    /** R22.5 — the always-on period scope chip: value only (no 기간 key),
     *  light-blue tint to read as scope, not a removable filter. */
    scope:
      'inline-flex items-center h-7 rounded-full border border-[var(--pl-primary-ring)] bg-[var(--pl-primary-bg)] px-3 text-[12px] font-semibold text-[var(--pl-primary)]',
  },

  /** ProvTag — provider glyph + neutral text; 12/500 medium. */
  provTag: {
    base: 'inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--pl-text-medium)]',
    /** provider 가 라벨이 아니라 그 블록의 제목일 때 (Jira 타일) — 16/600. */
    baseLg: 'inline-flex items-center gap-1.5 text-[16px] font-semibold text-[var(--pl-text-strong)]',
    /** 글리프는 라벨의 대문자 높이에 맞춘다 — 더 키우면 표에서 글자보다 아이콘이 먼저 읽힌다. */
    glyph: 'w-3.5 h-3.5 flex-none',
    glyphLg: 'w-[18px] h-[18px] flex-none',
  },

  /** PipelineProgressBar — track 110 (160 wide), h6; fill by state; N/M 12/600 tabular.
   *  Track width lives in trackNarrow/trackWide (never in the base). */
  progress: {
    wrap: 'inline-flex items-center gap-2',
    track: 'block h-1.5 rounded-full bg-[var(--pl-gray-200)] overflow-hidden',
    trackNarrow: 'w-[110px]',
    trackWide: 'w-[160px]',
    fill: 'block h-full rounded-full',
    /* Same monochrome rule as the status pills: the bar's LENGTH already carries
       progress, so hue only had to separate finished from failed. */
    fillPrimary: 'bg-[var(--pl-text-medium)]',
    fillOk: 'bg-[var(--pl-text-strong)]',
    fillErr: 'bg-[var(--pl-err)]',
    fillOff: 'bg-[var(--pl-gray-400)]',
    label: 'text-[12px] font-semibold text-[var(--pl-text-weak)] tabular-nums',

    /* Segmented variant (PipelineStepStrip) — same 110px width, cut into one span
       per task.

       This strip is the ONE place the monochrome ramp above does not apply
       (owner: "완료된건 초록색, 현재 진행중인건 파란색"). The ramp works because a row
       carries exactly ONE status, so weight can separate it from its neighbours
       in other rows. A segment strip carries several statuses at once — finished,
       running and untouched steps sit side by side inside 110px — and three
       neighbouring 12px blocks cannot be told apart by weight alone. Hue is doing
       work here that it was not doing on the pills. */
    stripWrap: 'inline-block',
    strip: 'flex gap-[2px] w-[110px]',
    stripSeg: 'h-1.5 flex-1 rounded-[2px]',
    /**
     * 오너 판정 뒤집힘 (2026-08-14): 위 문단의 "완료된건 초록색"은 더 이상 적용되지
     * 않는다. 근거였던 "세 상태가 나란히 붙으면 명도만으로 못 가른다"는 실행 중인
     * 행에서만 성립하는데, 3/3 완료 행에는 나란히 붙는 다른 상태가 없어 그 자리에
     * 색만 남았다 — 표 안 채도 면적의 62%가 거기였다(조치가 필요 없는 정보).
     *
     * 끝난 칸은 중립 회색으로 내려간다. `fillOff`(CANCELLED 완료 칸)와 같은 값이라
     * 취소된 실행을 따로 칠할 이유도 함께 사라졌다. 남는 색은 "지금 무슨 일이
     * 일어나는 중"인 칸 하나뿐 — 실행 중은 파랑, 실패는 빨강.
     * 완료 #98A2B3 : 미착수 #E4E7EC = 2.08:1 로, 근거가 요구한 구분은 중립으로도 선다.
     */
    stripOk: 'bg-[var(--pl-gray-400)]',
    /** 원색 `--pl-info` 에서 한 칸 내려온다 — 6px 블록에서는 더 깊은 파랑이 더 조용하다. */
    stripActive: 'bg-[var(--pl-info-text)]',
    /** 실패만 원색을 유지한다: 이 표에서 찾아내야 하는 유일한 칸이다. */
    stripRest: 'bg-[var(--pl-gray-200)]',
    /* The caption is the strip's only literal reading ("2단계 진행 중 · 1/4") — the
       segments carry the shape, this carries the numbers — so it answers to AA like
       any other run of text. `--pl-text-faint` measured 2.58:1 on the white row and
       2.34:1 on the hovered one; `--pl-text-weak` is 4.97:1 and 4.51:1.
       12px, not the 11 it shipped at (오너 2026-08-14): this page now runs on one
       base size, and a caption one pixel under it was a tier nobody could see.
       Colour is what holds it down, which is the lever that was doing the work. */
    stripCaption: 'mt-1 block text-[12px] text-[var(--pl-text-weak)] tabular-nums',
  },

  /** KindChip — mono 12/600 h20 pad 0 6, NO base border; cond = dashed gray-300.
   *  Text color lives in plain/cond (never in base) to avoid a join collision. */
  kindChip: {
    base: 'inline-flex flex-none items-center h-5 px-1.5 rounded-[4px] text-[12px] font-semibold bg-[var(--pl-off-bg)] [font-family:var(--pl-font-mono)]',
    plain: 'text-[var(--pl-text-weak)]',
    cond: 'text-[var(--pl-text-medium)] border border-dashed border-[var(--pl-gray-300)]',
  },

  /** PlEmptyState — icon 40 box + message; centered variant min-h 240. */
  empty: {
    base: 'text-center p-8 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
    center: 'flex flex-col justify-center items-center min-h-[240px]',
    /** 아이콘은 비텍스트 3:1 — faint 는 gray-100 면 위에서 2.34 라 weak(4.51). */
    icon: 'flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]',
    /** 흰 카드가 아니라 회색 바닥 위에 놓일 때 — gray-100 판은 바닥과 같은 값이라
     *  사라진다. 한 단 내려 gray-200(바닥 대비 1.13, 아이콘 4.01 로 비텍스트 3:1 통과). */
    iconOnGround:
      'flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--pl-gray-200)] text-[var(--pl-text-weak)]',
    meta: cn(pipelineText.meta),
  },

  /**
   * Skeleton bar for the admin surface. gray-200, not gray-100: the same bar has to
   * read on the white sheet AND inside the recessed bg-inner block, and gray-100 is
   * close enough to that block's own value that the bar disappears there.
   *
   * 반경은 일부러 빼 뒀다 — `cn` 은 단순 join 이라 호출부가 다른 반경을 얹으면
   * `rounded rounded-full` 처럼 둘 다 남고 어느 쪽이 이길지는 CSS 순서가 정한다.
   * 흉내낼 요소마다 반경이 다르므로 반경은 호출부가 명시한다.
   */
  skeletonBar: 'animate-pulse bg-[var(--pl-gray-200)]',

  /** PlBreadcrumb — 12/weak, sep ›, clickable vs inert vs cur. */
  breadcrumb: {
    base: 'text-[12px] text-[var(--pl-text-weak)] mb-3',
    crumb: 'cursor-pointer hover:text-[var(--pl-text-medium)] hover:underline',
    sep: 'mx-1.5 text-[var(--pl-text-faint)]',
    cur: 'text-[var(--pl-text-medium)] font-semibold',
  },

  /** SegControl (Figma Make redesign) — white bordered container, p-1 gap-1;
   *  active tab = solid dark (slate-900) fill, idle = muted text. */
  seg: {
    container:
      'inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--pl-bg-card)] border border-[var(--pl-border)]',
    button: 'inline-flex items-center px-3 py-1 rounded-md text-[14px] cursor-pointer transition-colors',
    buttonIdle: 'text-[var(--pl-text-weak)] hover:text-[var(--pl-text-medium)]',
    buttonActive: 'bg-[var(--pl-gray-900)] text-[var(--pl-white)] font-medium',
  },

  /** PlToast — bottom-center gray-900 white 14/500 i-check, shadow-lg. */
  toast: {
    base: 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-medium text-[var(--pl-white)] bg-[var(--pl-gray-900)] shadow-[var(--pl-shadow-lg)]',
    icon: 'text-[var(--pl-ok)]',
  },

  /** ModalShell — overlay + centered dialog (task variant 600 / max-h). Width
   *  lives in dialogDefault/dialogTask (never in the shared dialog base). */
  modal: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.5)]',
    dialog: 'max-w-[90vw] px-6 py-[22px] rounded-[12px] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-lg)]',
    dialogDefault: 'w-[480px]',
    dialogTask: 'w-[600px] flex flex-col max-h-[min(720px,86vh)]',
    /** R21.5/R22.5 — the start-pipeline modal (type tiles + mini flow need
     *  room). flex-col + a flex-1 spacer before the foot (PreviewModal) keeps
     *  the actions pinned to the bottom of the taller dialog. */
    dialogWide: 'w-[720px] min-h-[420px] flex flex-col',
    /** Custom builder — the drag canvas + docked catalog panel need more room
     *  than the mini-flow steps (owner: modal too cramped when adding Tasks). */
    dialogXWide: 'w-[960px] max-w-[92vw] min-h-[480px] flex flex-col',
    /** Task Queue app-modal shell (admin-taskqueue.html `.modal.app`) — r20, no
     *  padding (am-header/body/footer own it), inner scroll to 88vh. Width lives
     *  in the caller (TqModal 720 / wide 840) so this base stays width-free and
     *  never collides in the join. Replaces `dialog` entirely for variant='app'. */
    dialogApp:
      'max-w-[92vw] max-h-[88vh] overflow-y-auto rounded-[20px] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-lg)]',
    /** 확정 정보 편집기 — 폭은 `xwide` 와 같은 960. 가장 넓은 내용이 삭제 확인의
     *  리소스 표(원 서식지에서 유동 ~800px)와 mono JSON 한 줄(120자@12px)이라 그 이상은
     *  근거가 없다(첫 판의 1540 은 diff 두 열 + 참조 레일 치수였다). 높이는 고정 —
     *  편집 줄 수를 최대로 벌린다. 패딩 0: 머리·바·본문·바닥이 각자 여백을 갖고
     *  본문만 스크롤한다. `dialog` 를 통째로 대체한다(dialogApp 과 같은 규칙). */
    dialogEditor:
      'w-[min(960px,94vw)] h-[min(920px,92vh)] flex flex-col overflow-hidden rounded-[12px] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-lg)]',
    /** 우측 오버레이 패널 (논리 DB 주간 현황) — scrim 계약은 overlay 와 같고 정렬만
     *  우측 도킹(overlayPanel 이 overlay 를 대체). 폭 960 = dialogXWide 와 같은 등급:
     *  Database/Schema 2줄 정체성 + 7일 스트립 + 이번 주 + 마지막 성공 + DAG 의
     *  5열은 720(콘텐츠 664)에서 가로 스크롤이 났다(실측 747 필요). 도킹면이라
     *  radius 없이 border-l (TaskDrawer 문법), 패딩 0 — 머리(flex-none)와 본문(자기
     *  스크롤)이 각자 여백을 갖는다. `dialog` 를 통째로 대체한다(dialogApp 과 같은 규칙). */
    overlayPanel: 'fixed inset-0 z-50 flex justify-end bg-[rgba(16,24,40,0.5)]',
    dialogPanel:
      'w-[960px] max-w-[92vw] h-full flex flex-col overflow-hidden border-l border-[var(--pl-border)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-lg)]',
    title: cn(pipelineText.modalTitle, 'mb-3'),
    desc: 'text-[14px] leading-[1.4] text-[var(--pl-text-medium)] mb-3.5',
    body: 'overflow-y-auto min-h-0 mt-1',
    foot: 'flex justify-end gap-2 mt-[18px]',
  },

  /** FilterBar. */
  filterBar: 'flex items-center gap-2 flex-wrap',

  /** SearchBox — relative wrapper + inset icon + full input (pl-30 for the icon). */
  searchBox: {
    wrap: 'relative inline-block',
    icon: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--pl-text-weak)] pointer-events-none',
    input: cn(pipelineInputBase, 'w-full pr-2.5 pl-[30px]'),
    /** Dashboard filter-bar variant (Figma Make) — h9, white fill, r8 border,
     *  16px inset icon, blue focus ring. */
    iconLg: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--pl-text-weak)] pointer-events-none',
    inputLg:
      'h-9 rounded-lg border border-[var(--pl-border)] text-[12px] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-weak)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] w-full pr-3 pl-9',
  },

  /** Text input / select — h32, border-strong, focus ring. */
  input: cn(pipelineInputBase, 'px-2.5'),
  select: cn(pipelineInputBase, 'px-2.5'),
  /** Dashboard filter-bar select variant (Figma Make) — h9, white fill, r8
   *  border, medium slate text. Dashboard-exclusive (page.tsx via PlSelect lg). */
  selectLg:
    'h-9 rounded-lg border border-[var(--pl-border)] text-[14px] bg-[var(--pl-bg-card)] text-[var(--pl-text-medium)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] px-3 cursor-pointer',

  /** PlButton — h32 pad 0 14 14/600 (sm h28 pad 0 10 12/600; round 28×28).
   *  Base = interaction only; one geometry (md/sm/round) + one variant compose so
   *  every property is set at most once. Each variant owns its 1px border. */
  button: {
    base: 'inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed',
    md: 'h-8 px-3.5 rounded-lg text-[14px]',
    sm: 'h-7 px-2.5 rounded-lg text-[12px]',
    round: 'h-7 w-7 p-0 rounded-full',
    primary:
      'border border-transparent bg-[var(--pl-primary)] text-[var(--pl-white)] shadow-[var(--pl-shadow-xs)] enabled:hover:bg-[var(--pl-primary-hover)] disabled:bg-[var(--pl-gray-100)] disabled:text-[var(--pl-text-faint)] disabled:shadow-none',
    secondary:
      'border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-medium)] shadow-[var(--pl-shadow-xs)] enabled:hover:bg-[var(--pl-gray-50)] disabled:text-[var(--pl-text-faint)] disabled:border-[var(--pl-border)] disabled:shadow-none',
    /** Outline-primary — brand stroke on white. Tool CTAs (run-scan family):
     *  quieter than primary (filled) yet more actionable than secondary (gray). */
    outline:
      'border border-[var(--pl-primary)] bg-[var(--pl-bg-card)] text-[var(--pl-primary)] shadow-[var(--pl-shadow-xs)] enabled:hover:bg-[var(--pl-primary-bg)] disabled:text-[var(--pl-text-faint)] disabled:border-[var(--pl-border)] disabled:shadow-none',
    ghost:
      'border border-transparent bg-transparent text-[var(--pl-text-weak)] enabled:hover:bg-[var(--pl-gray-100)] enabled:hover:text-[var(--pl-text-medium)] disabled:text-[var(--pl-gray-300)]',
    danger:
      'border border-[var(--pl-err-border)] bg-[var(--pl-bg-card)] text-[var(--pl-err-text)] shadow-[var(--pl-shadow-xs)] enabled:hover:bg-[var(--pl-err-bg)] disabled:text-[var(--pl-text-faint)] disabled:border-[var(--pl-border)] disabled:shadow-none',
    /** R18 §7-1 — solid destructive CTA (상세 [중단]); outline danger stays for
     *  in-context secondary destructive actions. */
    dangerSolid:
      'border border-transparent bg-[var(--pl-err-solid)] text-[var(--pl-white)] shadow-[var(--pl-shadow-xs)] enabled:hover:bg-[var(--pl-err-solid-hover)] disabled:bg-[var(--pl-gray-100)] disabled:text-[var(--pl-text-faint)] disabled:shadow-none',
  },

  /** PlTable — th h34 12/600/.03em; td h44 14 tabular; row hover; chev cell. */
  table: {
    root: 'w-full border-collapse text-[14px]',
    th: 'text-left h-[34px] px-3 text-[12px] font-semibold uppercase tracking-[0.03em] text-[var(--pl-text-weak)] bg-[var(--pl-gray-50)] border-b border-[var(--pl-border)]',
    // td base has NO text color — PlTd picks exactly one of tdColor / mono / muted.
    td: 'h-[44px] px-3 py-2 align-middle tabular-nums border-b border-[var(--pl-gray-100)]',
    tdColor: 'text-[var(--pl-text-medium)]',
    /** tbody — drops the trailing row's bottom border; zebra-tints even rows
     *  (Figma dashboard mock). */
    body: '[&>tr:last-child>td]:border-b-0 [&>tr:nth-child(even)]:bg-[var(--pl-gray-50)]',
    /** Clickable row (role=button). Hover tints the row + primary-izes its .round chev. */
    rowClickable: 'group cursor-pointer hover:bg-[var(--pl-gray-50)]',
    mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
    muted: 'text-[var(--pl-text-weak)]',
    chevCell: 'text-right w-12 whitespace-nowrap',
    /** Chev button inside a clickable row — turns primary on row hover. */
    chevButton: 'group-hover:text-[var(--pl-primary)]',
  },

  /** PlPagination — ghost sm bounds + pager-count 12 weak tabular. */
  pager: {
    bar: 'flex items-center justify-end gap-2 mt-4',
    /** Centered variant (Figma dashboard mock table-card pagination). */
    barCenter: 'flex items-center justify-center gap-5 mt-4',
    count: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums',
  },

  /**
   * Dashboard list (page.tsx-exclusive) — the summary tiles, the list card and
   * the parts of a row this screen draws differently from the detail pages.
   *
   * This used to be a self-contained set that avoided the shared components on
   * purpose, which is how a FAILED row here came to look like a running one.
   * The row now wears the section's ProvTag / PipelineTypeTag / step strip; what
   * is still local is what the owner asked to differ — status as bare coloured
   * text rather than a pill — plus the chrome only this screen has.
   */
  dashboard: {
    /**
     * The screen's ONE surface. There is no list card here any more: the page
     * ground under this route is painted white and the table sits straight on
     * it, because the card was claiming a surface it could not draw. Its fill
     * was #FFFFFF on a #F9FAFB page — 1.05:1 — so the only thing separating the
     * two was a 1px #E4E7EC hairline (1.19:1) and a 5%-alpha shadow. Four more
     * near-white bands were nested inside it, all within the same 0.14 of
     * contrast ratio, which is what "흰 바탕에 흰 카드" was describing.
     *
     * The ground is painted HERE, not on `--pl-bg-page`: that token is the
     * section's, and tinting it moves every sibling screen (the ops-alerts
     * tiles read straight off it). Negative margins undo `layout.contentFluid`'s
     * padding so the white bleeds to the content edges, the same escape hatch
     * `serviceListStyles.split` uses for the recessed treatment on the two
     * service screens.
     */
    bleed:
      '-mx-8 -mt-6 -mb-12 px-8 pt-6 pb-12 min-h-[calc(100vh_-_64px)] bg-[var(--pl-bg-card)]',
    /**
     * The list block, pulled back out by its own cell padding so the table's
     * first column lands on the page grid with the h1 and the tiles. Inside a
     * card the px-5 was measured from the card's edge; with the card gone it
     * would indent the rows 20px past everything above them. The row hover keeps
     * that 20px on each side, so the tint still runs wider than the text.
     */
    listBlock: '-mx-5',
    /**
     * Summary buckets — the tiles ARE the filter, so they wear the section's
     * selectable-tile grammar from 운영 알림 (`AlertsView` summary*): the border
     * is present even when idle so selecting one never resizes it, and idle vs
     * active colours are chosen EXCLUSIVELY (cn is a plain join — put both on and
     * Tailwind's output order decides the winner, which is how a hover once ate
     * the brand stroke on that screen).
     *
     * Left-aligned rather than centred: the four values have different digit
     * counts (3 · 4 · 128 · 137), and centring makes them start at four different
     * x positions, so the row of numbers cannot be read as a column.
     */
    bucketGrid: 'grid grid-cols-4 gap-3 mb-6',
    bucketTile:
      'flex items-center justify-between gap-3 rounded-[8px] border px-4 py-3.5 text-left transition-colors',
    /**
     * On the white ground a gray-100 fill measures 1.05:1 — the tile would be a
     * number floating on the page. The edge carries it instead:
     * `--pl-border-strong` is 1.41:1 against white, the same white-plus-stroke
     * shape `identityCode` uses two blocks down for exactly this reason.
     */
    bucketTileIdle:
      'border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] hover:border-[var(--pl-gray-400)] hover:bg-[var(--pl-gray-100)]',
    /** Selection is a brand stroke; severity is the value's colour. Two signals, two
     *  channels. The shadow is the second lever: idle is now white too, so stroke
     *  colour alone would be the only thing telling selected from not. */
    bucketTileActive:
      'border-[var(--pl-primary)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-sm)]',
    /** 전체 is not a bucket, it is "no filter" — an outline rather than a fill. */
    bucketTileAllIdle:
      'border-dashed border-[var(--pl-gray-300)] bg-transparent hover:bg-[var(--pl-gray-100)]',
    bucketLabel: 'text-[12px] font-semibold leading-[1.3]',
    bucketValue:
      'mt-1 block text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums',
    /** The mark wears no container — 운영 알림 카드 grammar (`AlertStageCard` bare 20px Icon).
     *  A tile behind it would read as a second, smaller button inside the tile. */
    bucketMark: 'flex-none',
    /** Tones: 확인 필요 is the one bucket that is bad news; 전체 is the quiet one. */
    bucketToneDefault: 'text-[var(--pl-text-medium)]',
    bucketValueDefault: 'text-[var(--pl-text-strong)]',
    bucketToneAlert: 'text-[var(--pl-err-text)]',
    bucketToneMuted: 'text-[var(--pl-text-weak)]',
    bucketMarkMuted: 'text-[var(--pl-text-faint)]',
    /** 진행 중 mark — 아래 행들의 진행 세그먼트와 같은 파랑. NOT `--pl-primary`,
     *  which on these tiles already means "this one is selected". */
    bucketMarkActive: 'text-[var(--pl-info-text)]',
    /** 종료 mark 는 초록을 내려놓는다 (오너: "색상이 강하지 않게") — 끝난 일에는
     *  손댈 것이 없고, 초록은 이 화면 색 예산의 가장 큰 몫이었다. faint(2.58:1)가
     *  아니라 weak(4.97:1)인 이유는 이게 버킷이기 때문이다 — 필터가 안 걸린 상태를
     *  뜻하는 `bucketMarkMuted` 만 그 아래 칸을 쓴다. */
    bucketMarkOk: 'text-[var(--pl-text-weak)]',
    /** Page header row (title + period selector). */
    headerRow: 'flex items-center justify-between mb-6',
    /**
     * The period toggle at this page's base size (오너 2026-08-14: 기본 12px).
     * It reaches the buttons as a descendant selector rather than a class handed
     * to SegControl, for two reasons: `seg.button` already declares its own size
     * and `cn` is a plain join, so two size classes would let CSS output order
     * pick the winner; and SegControl is shared with the TC result list, which
     * keeps its own scale.
     */
    periodSeg: '[&_button]:text-[12px]',

    /** Filter bar — h9 controls on the page, no plate of its own. The gray-50 fill
     *  it used to wear was 1.05:1 against both the card above it and the rows
     *  below, so it read as a seam rather than a band; the table's own head rule
     *  is the boundary now, and a hairline directly above a 2px rule is noise. */
    filterBar: 'flex items-center gap-2 px-5 py-3',
    /** Search wrapper — flex-1 up to a max width (SearchBox adds `relative`). */
    searchWrap: 'flex-1 max-w-xs',
    /** The filter trigger rides the bar's right edge — `ResourceToolbar` grammar. */
    filterTrigger: 'ml-auto flex items-center',
    /** Removable-filter chips row (only rendered when a filter is on). */
    chipsWrap: 'px-5',

    /**
     * Table chrome. The -3px that used to live here was the status rail's own
     * width; with the rail gone (오너 2026-08-14) the first cell IS the first
     * column, and `listBlock` giving back px-5 already lands the row text on the
     * same grid line as the h1 and the tiles.
     */
    table: 'w-full',
    /**
     * Column labels — the section's shared header grammar (`pipelineStyles.table.th`:
     * h34, 12/600 uppercase, tracking .03em, text-weak), with px-5 rather than the
     * shared px-3 because this table's cells are px-5 and a th on px-3 would sit a
     * column off from the values it labels.
     *
     * The gray-50 band is gone with the card. Without a card the table needs ONE
     * line that says where it starts, and a 1px #E4E7EC hairline is not it —
     * 1.19:1 on white, the same whisper the card's own edge was. A 2px rule in
     * `--pl-text-strong` is: it reads as the head of a table rather than as one
     * more divider among nine, which is the whole grammar of a list that stands on
     * the page instead of inside a box.
     */
    th: 'h-[34px] px-5 text-left whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.03em] text-[var(--pl-text-weak)] border-b-2 border-[var(--pl-text-strong)]',
    body: 'divide-y divide-[var(--pl-gray-100)]',
    /**
     * Hover는 서비스 목록 행이 쓰는 보라 그대로 (오너 2026-08-14) — `--pl-row-hover`.
     * gray-50 은 흰 행에서 1.03:1 이라 DOM 에만 있었고, gray-100 도 1.10:1 이다.
     * 중립 틴트는 명도로만 갈라져야 해서 더 내려가면 그 위 글자가 AA 아래로 떨어진다.
     * 보라는 채도로 갈라지므로 명도를 거의 내리지 않고도 행이 구별된다.
     */
    row: 'group cursor-pointer transition-colors hover:bg-[var(--pl-row-hover)]',
    cell: 'px-5 py-3.5 align-middle',

    /**
     * Row identity — ONE column, a leading provider mark and two lines beside it
     * (오너 2026-08-14). As four columns (이름 · 코드 · Target · Cloud) the three
     * answers to "which one is this" sat more than 300px apart at 1600px, so
     * reading one row meant reassembling it from three places.
     *
     * The tiers are the owner's: **Target Source 번호가 1행**, 서비스 이름이 2행이다.
     * 이 표에서 행을 여는 키는 Target Source 이고 열리는 화면도 그것이다 — 서비스
     * 이름은 그게 무엇인지 알려주는 설명이지 식별자가 아니다. 이름을 1행에 두었을
     * 때는 같은 이름("PII Agent 설치 - 고객 DB")이 여러 행에 그대로 반복돼, 가장 큰
     * 글자가 행을 구별해 주지 못했다.
     *
     * 마크는 왼쪽에 한 번, 두 줄 전체에 걸쳐 세로 가운데. 2행 안에 섞여 있을 때는
     * 어느 줄에 속한 것인지가 모호했고, 밖으로 나오면 "이 행 전체가 이 CSP" 가 된다.
     */
    identity: 'flex items-center gap-2.5',
    /**
     * 두 줄에 걸치는 선두 마크. 슬롯 폭을 고정하는 이유는 `ProviderGlyph` 가
     * UNKNOWN 에서 null 을 돌려주기 때문이다 — 그대로 두면 마크 없는 행만 글자가
     * 왼쪽으로 당겨져 열이 어긋난다.
     */
    identityGlyph:
      'flex-none w-5 flex items-center justify-center text-[var(--pl-text-medium)]',
    /**
     * 20×20 (오너 2026-08-14). 공용 `provTag.glyph` 는 14px 인데, 그 값은 **라벨 옆에
     * 붙는 글리프**의 크기다 — 대문자 높이에 맞춰야 표에서 아이콘이 글자보다 먼저
     * 읽히지 않기 때문. 여기서는 라벨이 없고 마크가 두 줄 전체를 대표하므로 그 제약이
     * 적용되지 않아, 공용 토큰을 건드리지 않고 이 셀만 따로 잡는다.
     */
    identityGlyphMark: 'w-5 h-5',
    identityStack: 'flex min-w-0 flex-col items-start gap-[3px]',
    /**
     * 1행. `items-baseline` 인 이유는 한 줄 안에 두 크기가 서기 때문이다 — 12px 문맥과
     * 14px 코드 값을 items-center 로 세우면 작은 쪽이 떠서 두 값이 같은 줄로 안 읽힌다.
     */
    identityHead: 'flex items-baseline gap-2',
    /**
     * Target 번호 — 판을 벗고 12px 로 내려온다 (오너: "태그 디자인이 조금 갑갑하다.
     * tag 없애봐" · "target 계층을 낮추자"). 이 줄에서 강조를 갖는 것은 코드 값 하나뿐이라,
     * 번호는 그 값이 어디 속하는지 말하는 문맥이 됐다.
     *
     * 행에 커서가 올라갔을 때만 링크색으로 (오너). `group-hover` 이지 `hover` 가
     * 아니다: 열리는 건 행 전체이므로 행 어디에 커서가 있든 식별자가 반응해야
     * "지금 열리는 게 이것"이라고 말한다. 좁은 번호 위에서만 반응하면 그 폭에
     * 커서를 올린 사람만 응답을 본다.
     *
     * `--pl-info-text` 는 hover 틴트 위 5.47:1, 흰 행 6.28:1 — 두 상태 다 4.5:1 위.
     * 원색 `--pl-info` 는 3:1 대라 이 크기로는 못 쓴다.
     */
    identityTarget:
      'whitespace-nowrap text-[12px] font-medium text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)] transition-colors group-hover:text-[var(--pl-info-text)]',
    /**
     * Target 번호 값 — 14/600 (오너: "1002는 2픽셀 더 키워. 그리고 semi bold").
     * `코드: IRP` 와 같은 문법이 된다: 라벨은 12px 문맥, 값만 올라선다. 한 줄에 라벨·값
     * 쌍이 둘 나란히 서므로, 어느 쪽을 읽어도 같은 규칙으로 읽힌다.
     *
     * hover 링크색을 **여기에도** 얹는 이유: 부모의 `group-hover` 는 자식이 자기 색을
     * 선언하는 순간 거기서 끊긴다. 없으면 "Target #" 만 파래지고 번호는 검게 남아,
     * 정작 식별자인 쪽이 반응하지 않는다.
     */
    identityTargetValue:
      'text-[14px] font-semibold text-[var(--pl-text-strong)] transition-colors group-hover:text-[var(--pl-info-text)]',
    /** "코드:" 라벨 — 계층은 그대로 둔다 (오너). 값이 무엇인지 부르는 말이지 값이 아니다. */
    identityCode: 'whitespace-nowrap text-[12px] font-medium text-[var(--pl-text-weak)]',
    /**
     * 코드 값 — 14/600 (오너: "값 IRP 는 계층 높여"). 셀에서 유일하게 올라선 값이다.
     * 판 없이 크기·무게 두 레버로만 서므로 `--pl-text-strong` 을 쓴다: weak 나 medium
     * 이면 12px 문맥과 색까지 같아져 크기 한 칸 차이만 남는다.
     */
    identityCodeValue: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
    /** 2행 — 서비스 이름 (오너: 12px, 회색). 식별자가 아니라 그것이 무엇인지의 설명. */
    identityName:
      'block max-w-[38ch] truncate text-[12px] text-[var(--pl-text-weak)]',

    /**
     * Status as bare text, no chip (owner: "상태는 그냥 태그없이 텍스트로만 표현하고
     * 텍스트 색상만 남겨"). The pill's fill, border and icon all existed to make one
     * word legible inside a busy row; here the word sits alone in its own column,
     * so that chrome was carrying nothing the column did not already say.
     *
     * 한글 라벨은 공용 `statusKo` 한 벌을 쓴다 — enum 원문은 데이터 표기(정의·계약 탭,
     * 오류 코드)에만 남긴다.
     *
     * 색을 받는 상태는 넷이다 — 실패 빨강, 완료 초록, **실행 중 파랑**
     * (오너 2026-08-14, "실행중 -> 파란색으로"), **중단 노랑**(오너 2026-08-15).
     * 파랑은 스트립의 진행 칸과 같은 `--pl-info-text` 다: 한 행에서 "지금 여기"를
     * 말하는 두 자리가 같은 색을 쓴다. 색이 없는 것은 대기 하나다.
     *
     * 여기의 초록은 세그먼트에서 뺀 초록과 다른 자리다. 세그먼트의 초록은 한 행에
     * 여러 칸을 칠해 표 면적의 62%를 먹었지만, 이 초록은 **행당 낱말 하나**다 —
     * 같은 색을 면적이 다른 두 곳에 쓰는 것이라, 하나를 뺐다고 다른 하나가
     * 따라 빠질 이유는 없다.
     *
     * 중단은 노랑을 받는다(오너 2026-08-15). 예전에는 색 예산을 아끼려고 마크(`stop`)로
     * 채널을 하나 더 여는 쪽이었는데, 네 번째 색을 쓰기로 정해지면서 그 전제가 사라졌다 —
     * 색이 그 일을 하면 마크는 같은 말을 두 번 하는 것이라 함께 뺐다(`statusWrap` 도).
     * 값은 `--pl-warn-text`(#B54708)다. `--pl-warn`(#F79009)은 흰 행에서 2.35:1 이라 못 쓴다.
     *
     * 이로써 회색은 대기 하나만 남는다 — 색이 없다는 것이 이제 "아직 시작하지 않았다"만 뜻한다.
     */
    statusText: 'text-[12px] font-semibold tracking-[0.02em]',
    statusTextTone: {
      PENDING: 'text-[var(--pl-text-weak)]',
      RUNNING: 'text-[var(--pl-info-text)]',
      IN_PROGRESS: 'text-[var(--pl-info-text)]',
      READY: 'text-[var(--pl-text-weak)]',
      DONE: 'text-[var(--pl-ok-text)]',
      FAILED: 'text-[var(--pl-err-text)]',
      CANCELLED: 'text-[var(--pl-warn-text)]',
      BLOCKED: 'text-[var(--pl-text-weak)]',
    } as Record<PipelineStatusToneKey, string>,

    /** 생성시간 — 절대 시각 "YYYY-MM-DD HH:mm" (오너 2026-08-14). 상대시각 + hover 툴팁
     *  (`timeWrap`/`timeTip`) 이 있던 자리이고, 경과 열이 생기면서 그 둘은 나갔다.
     *  12px: 행을 고르는 근거지 식별자가 아니다 — 14px 일 때는 식별자 태그와 같은 단에
     *  서서 두 값이 같은 등급으로 읽혔다. 날짜가 열로 줄서므로 tabular-nums. */
    timeText: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums whitespace-nowrap',

    /** 경과 — 진행도 옆에서 같은 행을 읽는 두 번째 사실이라 진행도보다 조용하다.
     *  숫자가 열로 줄서므로 tabular-nums (`timeText` 를 재쓰지 않는 이유: 저쪽의
     *  cursor-default 는 툴팁이 붙은 자리의 것이다). */
    elapsed: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums',

    /** Row action — hover-reveal dark button (row hover via the unnamed group). */
    actionCell: 'px-5 py-3.5 text-right',
    /** w-8 not w-7: the glyph inside went 14 → 18px (오너), and a 28px button around
     *  it left 5px of padding — the mark stopped reading as sitting IN a button. */
    action:
      'inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--pl-gray-300)] transition-all group-hover:bg-[var(--pl-gray-900)] group-hover:text-[var(--pl-white)] group-hover:shadow-[var(--pl-shadow-xs)]',

    /**
     * Pagination — centred, and nothing but the pager. The row tally and the
     * rule above it are gone (오너); the last row's own bottom border is already
     * the edge the rule was drawing a second time.
     *
     * `relative` is load-bearing: the fetch-window notice is absolutely placed
     * so that the pager stays centred on the CARD, not on what is left beside it.
     */
    pager: 'relative flex items-center justify-center gap-2 px-5 py-3.5',
    /** Fetch-window notice — only rendered when rows were actually left behind. */
    pagerTruncated:
      'absolute left-5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--pl-text-weak)]',
    pagerBtn:
      'inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--pl-text-faint)] transition-colors hover:text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-100)] disabled:opacity-40 disabled:pointer-events-none',
    pagerCount: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums',
    /** The page you are on, in brand — the only moving number in the row. */
    pagerCurrent: 'font-semibold text-[var(--pl-primary)]',

    /** No-results empty state inside the card. */
    empty: 'px-5 py-12 text-center text-[12px] text-[var(--pl-text-weak)]',
    /** Loading / error min-height so the card doesn't collapse. */
    stateBox: 'min-h-[240px] flex flex-col items-center justify-center gap-3 text-[12px] text-[var(--pl-text-weak)]',
  },
} as const;

/**
 * 공지사항 · FAQ (`design/notice-faq/notice-faq-screens.html`).
 *
 * 값의 출처는 전부 그 목업이다. 네 화면(메인 카드 · 전체보기 · Admin · 에디터)이
 * 같은 행 언어를 쓰므로, 숫자를 컴포넌트마다 두면 화면끼리 어긋난다.
 * 여기 없는 값이 필요하면 새로 정하지 말고 목업에서 찾아 이리로 옮긴다.
 */
export const postStyles = {
  /** 카드 — 그림자가 아니라 테두리로 면을 만든다(목업 `.list-card`). */
  card: 'bg-white border border-[#E5E7EB] rounded-xl',
  cardHeader: 'flex items-center gap-2.5 px-[22px] py-[18px] border-b border-[#E5E7EB]',
  cardTitle: 'text-[16px] font-bold tracking-[-0.02em] text-[#191F28]',
  /** 건수 필 — "전체보기"를 누를 이유를 주는 값. */
  cardCount:
    'text-[12px] font-bold text-[#0050D6] bg-[#E8F1FF] rounded-full px-2 py-0.5 tabular-nums',
  /**
   * 전체보기 — 목록 끝에 둔다. 헤더에 있으면 5행을 다 읽고 나서 눈이 위로 되돌아가야
   * 하는데, 더 보고 싶어지는 시점은 목록이 끊긴 자리다
   * (Cloudscape Dashboard items: "View all" element at the end of the list).
   */
  cardMore:
    'flex items-center justify-center px-[22px] py-3 border-t border-[#F3F4F6] text-[12px] font-medium text-[#4E5968] transition-colors hover:bg-[#F9FAFB]',

  /** 행 — `items-stretch` 라야 우측 레일이 행 높이를 다 차지해 날짜↔캐럿이 위아래로 벌어진다. */
  row: 'flex items-stretch gap-4 px-[22px] py-4 border-b border-[#F3F4F6] last:border-b-0',
  rowHover: 'transition-colors hover:bg-[#F9FAFB]',
  rowOpen: 'bg-[#F9FAFB]',
  /** 숨김 행 — 배지 하나로는 스캔에 안 걸려서 면 전체로 말한다. */
  rowHidden: 'bg-[repeating-linear-gradient(135deg,#FAFBFC_0_6px,#F5F6F8_6px_12px)]',

  /**
   * 읽는 쪽 행. Admin 의 `row` 와 갈라 둔다 — 저쪽은 관리 표라 날짜가 열로 있는 게 맞고,
   * 이쪽은 소식 목록이라 날짜가 글의 머리다.
   *
   * 날짜를 오른쪽 끝이 아니라 왼쪽 단으로 뺀다(Vercel Changelog). 제목이 왼쪽 끝이고
   * 날짜가 1400px 건너편이면 눈이 좌우로 왕복하는데, 그게 표를 읽는 동작이라
   * 목록 전체가 게시판으로 읽힌다.
   */
  entryRow:
    'group relative flex w-full items-start gap-5 px-[22px] py-[14px] text-left border-b border-[#F3F4F6] last:border-b-0 transition-colors duration-150 hover:bg-[#FAFBFD] motion-reduce:transition-none',
  entryRowOpen: 'bg-[#F7F9FC]',
  /**
   * 왼쪽 지시바 — hover·펼침에 세로로 자란다. 배경 틴트만으로는 "지금 여기"가
   * 흰 바탕과 1.05:1 이라 거의 안 보인다(`tableRowLift` 에서 받은 같은 지적).
   * 면을 더 칠하는 대신 3px 짜리 획 하나를 움직인다.
   */
  entryRail:
    'absolute left-0 top-0 bottom-0 w-[3px] origin-center scale-y-0 bg-[#0064FF] transition-transform duration-200 ease-out group-hover:scale-y-100 motion-reduce:transition-none',
  entryRailOn: 'scale-y-100',
  /** 고정 글은 상시로 켜 두되 톤을 낮춘다 — 상태지 상호작용이 아니다. */
  entryRailPinned: 'scale-y-100 bg-[#A9C6F8] group-hover:bg-[#0064FF]',
  /** 날짜 단 — 폭이 고정이라야 제목 시작선이 모든 행에서 같다. */
  entryDate:
    'flex-none w-[92px] pt-[7px] text-[16px] text-[#59647A] tabular-nums leading-[1.4] whitespace-nowrap transition-colors duration-150 group-hover:text-[#0064FF] motion-reduce:transition-none',
  entryMain: 'flex-1 min-w-0 flex flex-col gap-1.5',
  /**
   * 16px — 카드 머리(`cardTitle`)와 같은 값이다. 26px 는 레퍼런스 범위(20~32) 안이긴
   * 했지만 저쪽은 제목 하나가 화면을 지배하는 전용 목록 페이지고, 여기는 카드 두 장이
   * 나란한 대시보드라 제목 다섯 줄이 배너와 크기를 다툰다.
   * `max-w` 는 읽기 폭 — 제목이 1600px 를 가로지르면 다시 표가 된다.
   */
  entryTitle:
    'text-[16px] font-bold tracking-[-0.02em] leading-[1.45] text-[#191F28] max-w-[62ch] transition-colors duration-150 group-hover:text-[#0050D6] motion-reduce:transition-none',
  entryTitleOpen: 'text-[#0050D6]',
  /** 캐럿 자리 — hover 에 옅은 원판이 깔려 "누르는 곳"이 손끝보다 먼저 보인다. */
  entryCaretSlot:
    'flex-none mt-0.5 w-7 h-7 grid place-items-center rounded-full transition-colors duration-150 group-hover:bg-[#E8F1FF] motion-reduce:transition-none',

  rowMain: 'flex-1 min-w-0 flex flex-col gap-1.5 text-left',
  rowMeta: 'flex items-center gap-2 flex-wrap',
  rowTitle: 'text-[14px] font-semibold tracking-[-0.01em] leading-[1.45] text-[#191F28]',
  rowTitleOpen: 'text-[#0050D6]',
  rowTitleMuted: 'text-[#6B7280]',
  /** 우측 레일 — 날짜 위, 캐럿/액션 아래. */
  rowSide: 'flex-none flex flex-col items-end justify-between gap-2.5',
  rowDate: 'text-[12px] text-[#6B7280] tabular-nums whitespace-nowrap leading-[1.4]',

  /**
   * 캐럿 — 접힘 ↓ / 펼침 ↑. 지시자는 헤더 끝쪽(Carbon).
   * 목업의 #8B95A1 은 흰 바탕에서 3.04:1 로 비텍스트 최소선(3:1)에 겨우 걸친다.
   * "펼칠 수 있다"를 혼자 말하는 유일한 표시라 같은 레일의 날짜와 같은 톤으로 내렸다.
   */
  caret:
    'w-2 h-2 flex-none mr-[3px] mb-1 border-r-[1.8px] border-b-[1.8px] border-[#6B7280] rotate-45 transition-transform duration-200 motion-reduce:transition-none',
  caretOpen: '-rotate-[135deg] -translate-x-[3px] -translate-y-[3px] border-[#0050D6]',

  /** 0fr → 1fr — 높이를 재지 않고 편다. */
  panelGrid:
    'grid transition-[grid-template-rows] duration-[240ms] ease-out motion-reduce:transition-none',
  panelBg: 'bg-[#F9FAFB]',
  /**
   * 하단이 상단보다 넓다(여백 7원칙 §2). 두 여백이 하는 일이 다르기 때문이다 —
   * 위는 제목과 그 제목의 본문을 띄우는 같은 덩어리 안의 간격이고, 아래는 이 글의
   * 끝과 다음 글 사이의 경계다.
   *
   * 값은 눈에 보이는 간격으로 맞췄다. 위쪽 실측 간격은 패딩 16 이 아니라 38 인데,
   * 행의 아래 여백 14 와 첫 줄의 반행간이 함께 얹히기 때문이다. 그래서 42 로는
   * 아래가 44 밖에 안 돼 둘이 같아 보였다. 64 로 올려 아래를 66 으로 만든다(1.7배).
   */
  panelBody: 'px-[22px] pt-4 pb-16 text-[14px] leading-[1.75] text-[#4E5968]',
  /**
   * 본문은 높이보다 늦게 도착한다. 칸이 열리는 200ms 동안 글자가 같이 늘어나면
   * 늘어나는 것처럼 보여서, 칸이 자리를 잡은 뒤 글이 떠오르게 지연을 준다.
   */
  panelFade:
    'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
  panelFadeOn: 'opacity-100 translate-y-0 delay-[90ms]',
  panelFadeOff: 'opacity-0 -translate-y-1',
  /** 본문 왼쪽 획 — 펼친 칸이 어느 행에 속하는지 눈으로 잇는다. */
  panelEdge: 'border-l-[3px] border-[#0064FF]',

  /** 배지 3종. */
  badge:
    'inline-flex items-center gap-1.5 text-[12px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap',
  /**
   * 빨강. 파랑은 이 화면에서 이미 세 가지 일을 한다 — 좌측 지시바, hover 한 제목,
   * 건수 필. 고정까지 파랑이면 "지금 보는 곳"과 "언제나 맨 위"가 같은 색이 된다.
   * 값은 `idcStyles.tag.red` 와 같은 쌍이다(#FEECEC 위 #B42318 = 5.77:1).
   */
  badgePin: 'bg-[#FEECEC] text-[#B42318]',
  badgeCat: 'bg-white text-[#4E5968] border border-[#E5E7EB] font-semibold',
  badgeHidden: 'bg-[#F3F4F6] text-[#4E5968] border border-dashed border-[#D1D5DB]',
  badgeIcon: 'w-[13px] h-[13px] flex-none',

  /** 필터 아이콘 버튼 + 활성 개수 닷 — 아이콘만으로는 "지금 걸려 있다"를 못 말한다. */
  iconBtn:
    'relative w-[30px] h-[30px] flex-none inline-flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4E5968] transition-colors hover:bg-[#F9FAFB]',
  iconBtnOn: 'bg-[#E8F1FF] border-[#E8F1FF] text-[#0050D6]',
  iconBtnDot:
    'absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#0064FF] text-white text-[10px] font-bold leading-[14px] tabular-nums',
  filterPop:
    'absolute right-[22px] top-[calc(100%-6px)] z-10 w-[236px] p-3.5 bg-white border border-[#E5E7EB] rounded-[10px] shadow-[0_12px_28px_rgba(15,23,42,0.14)] flex flex-col gap-3.5',
  filterChip:
    'text-[12px] font-medium px-2.5 py-[5px] rounded-full border border-[#E5E7EB] bg-white text-[#4E5968] transition-colors hover:bg-[#F9FAFB]',
  filterChipOn: 'bg-[#E8F1FF] border-[#E8F1FF] text-[#0050D6] font-bold hover:bg-[#E8F1FF]',

  /**
   * 전체보기 — **회색 패널이 목록을 감싼다.**
   *
   * 전에는 흰 카드 안에 회색 레일이 한 칸 들어앉은 구조였다. 그런데 그룹 머리도 같은
   * 회색이라 레일과 그룹 머리가 이어 붙어 ㄱ자 덩어리로 읽혔고, 레일이 독립한 패널로
   * 보이지 않았다(받은 지적). 색을 하나 더 만들어 가르는 대신 구조를 뒤집었다 —
   * 회색이 바깥 틀이 되고, 목록은 그 안에 떠 있는 흰 판이 된다.
   * 규칙은 그대로 하나다: 회색은 구조, 흰색은 내용.
   *
   * `flex-1` 이 `pageFill` 의 남은 높이를 전부 받아 온다. 이게 있어야 회색 면이
   * Category 개수와 무관하게 바닥에서 끝난다 — 중간에 끊기면 구조물이 아니라 카드 안에
   * 놓인 상자로 읽힌다. 떼면 751 → 256 으로 돌아간다(확인함).
   *
   * 폭 240 은 GitHub Issues 의 필터 목록(실측 239)에서 가져왔다. 앱 내비(256~320)가
   * 아니라 한 화면 안의 필터라 그쪽이 같은 역할이다.
   */
  grouped:
    'grid grid-cols-[240px_minmax(0,1fr)] gap-3 flex-1 p-3 bg-[#E7ECF5] border border-[#D6DEEC] rounded-xl overflow-hidden',
  /**
   * 레일은 이제 자기 면을 갖지 않는다 — 바깥 패널의 회색 위에 바로 놓인다. 선택 항목의
   * 흰 알약이 그 회색 위로 떠오르는 것도 같은 이유로 그대로 성립한다.
   *
   * 여기에 `min-h-0` 은 필요 없다. grid 자식의 자동 최소 크기는 보통 `auto` 지만
   * **스크롤 컨테이너면 0** 이라, `overflow-y-auto` 자신이 그 일을 이미 한다.
   * 33개까지 넣어 확인했다 — 붙이나 떼나 결과가 같다. (shadcn `SidebarContent` 는
   * 스크롤이 없는 경우까지 감당하느라 `min-h-0` 을 함께 쓴다.)
   */
  /**
   * 면을 중립 회색(#F3F4F6, S 8%)에서 푸른 쪽으로 옮긴다. 대비는 이미 맞았는데
   * 채도가 없어서 바래 보였다 — 회색은 대비를 얻어도 생기를 못 얻는다.
   */
  catNav: 'flex flex-col gap-0.5 overflow-y-auto',
  /**
   * 레일 머리. 없으면 목록이 "전체"부터 냅다 시작해서, 이 칸이 무엇을 고르는 자리인지
   * 말하는 데가 없다. Stripe 문서 사이드바가 같은 자리에 구역 라벨을 쓴다
   * (VERSIONING · ESSENTIALS · TOOLS, 실측). 라틴 문자라 자간을 벌릴 수 있다 —
   * 한글이면 못 하는 처리다.
   */
  catNavHead:
    'px-3 pt-1.5 pb-2.5 text-[14px] font-extrabold tracking-[0.04em] text-[#141A24]',
  /**
   * "전체"와 Category 목록 사이의 선. 전체는 Category 가 아니라 필터를 푸는 자리라
   * 같은 줄에 세워 두면 4개 중 하나로 읽힌다.
   */
  catNavDivide: 'my-1.5 border-t border-[#D6DEEC]',
  /**
   * GitHub Issues 사이드바 실측(항목 32 · radius 6 · 14px)에서 시작했지만 그쪽은
   * 필터가 십수 개인 조밀한 목록이다. 여기는 서너 개가 656px 칸에 놓여 조밀할 이유가
   * 없어 한 칸씩 올렸다 — 16px · 40px 높이는 앱 좌측 내비가 쓰는 크기다.
   */
  catNavItem:
    'flex items-center gap-2 px-3 py-2 leading-6 rounded-lg text-[16px] font-semibold text-[#3E4C63] transition-colors hover:bg-white/70',
  /**
   * 레일이 회색이라 선택 항목은 흰 카드로 떠오른다 — 대비를 반대 방향으로 준다.
   * 글자를 #0050D6(6.73:1) 에서 앱 Primary #0064FF(4.92:1) 로 올린다. 대비는 한 칸
   * 내주지만 AA 는 지키고, 채도가 이 화면에서 유일하게 100% 인 자리라 여기가 밝아야 한다.
   */
  catNavItemOn:
    'bg-white text-[#0064FF] font-bold hover:bg-white ring-1 ring-[#C7D9FA] shadow-[0_1px_2px_rgba(15,23,43,0.06)]',
  catNavCount: 'ml-auto text-[14px] font-normal text-[#54627A] tabular-nums',
  /**
   * 그룹 머리 — 카드 안에서 구역을 가르는 띠다.
   *
   * 예전엔 레일과 같은 회색을 썼는데, 그러면 레일과 그룹 머리가 이어진 ㄱ자 덩어리로
   * 읽혀 레일이 독립한 패널로 안 보인다(받은 지적). 이제 회색은 바깥 패널 하나만
   * 쓴다 — 안쪽은 전부 흰 면이고, 구역은 굵은 글씨와 아래 선이 가른다.
   *
   * 목록 칸 위에 붙어 따라온다. 스크롤해서 그룹 머리가 화면 밖으로 나가면 지금 읽는 글이
   * 어느 Category 인지 사라지는데, 이 목록은 상한이 없어 그 일이 반드시 생긴다.
   * 아래 글이 비쳐야 "떠 있는 띠"로 읽히므로 면을 반투명으로 두고 뒤를 흐린다 —
   * 불투명하면 그냥 목록이 잘린 것처럼 보인다.
   */
  groupHead:
    'sticky top-0 z-[1] flex items-baseline gap-2 px-[22px] py-3 bg-white/90 backdrop-blur-[6px] border-b border-[#E5E7EB]',
  /** 레일 항목(16px)과 같은 이름을 이고 있어 한 칸 위여야 한다 — 저쪽은 고르는 자리고 여기는 구역의 머리다. */
  groupTitle: 'text-[18px] font-bold tracking-[-0.01em] text-[#141A24]',
  groupCount: 'text-[12px] text-[#54627A] tabular-nums',
  /** 그룹 사이의 선 — 첫 그룹은 카드 위 테두리가 대신한다. */
  groupSection: 'border-t border-[#E5E7EB] first:border-t-0',

  /**
   * 페이지 골격. 좌우 44 = 셸의 24 + 20. 셸(TopNav 의 `px-6`, 서비스 화면 본문의
   * `p-6`)에 맞춘 24 로 시작했는데, 이 화면은 카드 두 장이 전폭을 채워서 24 로는
   * 배너와 카드가 창 끝에 붙어 답답하게 읽혔다. 전체보기(`pageBand`·`pageBody`)도
   * 같은 값을 쓴다 — 다르면 "전체보기 →" 한 번에 본문이 옆으로 튄다.
   * 페이지 폭 상한은 여전히 두지 않는다(다른 화면도 상한 없이 전폭이다).
   */
  page: 'w-full px-[44px] pt-8 pb-12 flex flex-col gap-6',
  /**
   * 같은 골격에서 여백만 뺀 것. 관리자 셸(`pipelineStyles.layout.content`) 안에
   * 놓이는 게시판 화면용이다 — 셸이 이미 좌우 32 · 위 24 를 주고 있어서 자기
   * 여백을 또 들고 가면 제목이 옆 메뉴의 화면들보다 8px 왼쪽에 선다.
   */
  sectionPage: 'w-full flex flex-col gap-6',
  /**
   * 전체보기 골격. 2카드 뷰(`page`)와 규칙이 반대다 — 저쪽은 대시보드라 높이를 내용이
   * 정하고, 여기는 목록 브라우저라 높이를 화면이 정한다. 고정 높이인데도 글이 잘리지
   * 않는 건 안쪽 두 칸에 각각 스크롤을 걸기 때문이다(`catNav` · `listPane`).
   * 64 = TopNav — `/pass/services` 가 쓰는 것과 같은 식이다.
   *
   * 여백은 이제 자식이 나눠 갖는다 — 밴드는 전폭이라 부모의 `px-6` 안에 있으면 안 된다.
   */
  pageFill: 'w-full h-[calc(100vh-64px)] overflow-hidden flex flex-col',
  /**
   * 제목 밴드. 홍보 배너가 아니라 제목이 서는 무대다 — 잰 10곳 중 8곳이 120~270px
   * 짜리 면 위에 제목을 올린다(NHN 200 중앙 · NCP 130 중앙 · 채널톡 270 그라데이션 ·
   * GitHub 170 다크 · 네이버웍스 230). 목록이 흰 면 위 흰 면이면 대비할 상대가 없다.
   *
   * 면 색은 레일과 같은 값을 쓴다. 이 화면의 규칙이 "회색은 구조, 흰색은 내용" 하나라,
   * 밴드에 새 회색을 들이면 규칙이 둘이 된다.
   */
  pageBand: 'flex-none px-[44px] py-7 bg-[#E7ECF5] border-b border-[#D6DEEC]',
  /**
   * 목록 칸. 긴 글을 펼쳐도 페이지가 아니라 이 칸이 흐른다.
   * 회색 패널 위에 떠 있는 흰 판이다 — 테두리 대신 그림자로 띄운다. 패널 회색과
   * 카드 테두리는 서로 너무 가까워 선을 그으면 경계가 오히려 흐려진다.
   */
  listPane:
    'overflow-y-auto bg-white rounded-lg shadow-[0_1px_3px_rgba(15,23,43,0.08)]',
  pageTitle: 'text-[30px] font-extrabold tracking-[-0.03em] leading-[1.2] text-[#191F28]',
  pageSub: 'text-[14px] text-[#4E5968] mt-1.5',
  /**
   * 밴드 위의 제목은 `pageTitle`(30px) 보다 한 칸 크다. 30 은 잰 13곳 중 가장 작았고
   * (중앙값 48), Admin 화면이 `pageTitle` 을 함께 쓰고 있어 그쪽 값을 건드리는 대신
   * 이 화면 전용으로 갈랐다.
   */
  bandTitle: 'text-[40px] font-extrabold tracking-[-0.03em] leading-[1.15] text-[#191F28]',
  bandSub: 'text-[14px] text-[#4E5968] mt-2',
  /**
   * 밴드 아래 본문 칸. 남은 높이를 전부 받아 `grouped` 에 넘긴다.
   *
   * `min-h-0` 은 여기서 반드시 필요하다 — `catNav`·`listPane` 과 달리 이 칸은
   * 스크롤 컨테이너가 아니라서 자동 최소 크기가 내용 높이다. 떼고 94행을 넣어
   * 확인했다: 목록 칸이 `656 → 7416px` 로 부풀고, `pageFill` 의 `overflow-hidden`
   * 이 그걸 잘라 **6760px 가 스크롤로 닿지 않는다.** 글이 몇 건 없을 때는 넘칠 일이
   * 없어 붙이나 떼나 같아 보인다.
   */
  pageBody: 'flex-1 min-h-0 px-[44px] py-6 flex flex-col',
  /**
   * 카드 높이는 내용이 정한다 — 화면 아래까지 늘리지 않는다. 테두리는 "여기까지가
   * 내용"이라는 약속이라, 늘린 카드는 빈 곳을 테두리로 강조하는 셈이 된다
   * (Cloudscape: "the height of dashboard items are defined by its content").
   * 남는 자리를 메워야 할 때 늘릴 것은 카드가 아니라 카드 수다.
   */
  dual: 'grid grid-cols-2 gap-6 items-start',
} as const;

/**
 * 게시글 등록 · 수정 폼 (`design/notice-faq/notice-faq-screens.html` 화면 4).
 *
 * 라벨을 200px 열로 세우는 이유: placeholder 는 한 글자 치는 순간 사라지므로
 * 언어 탭이 있는 화면에서 "지금 어느 언어의 무슨 필드인지"를 말해 줄 수 없다.
 */
export const postFormStyles = {
  card: 'bg-white border border-[#E5E7EB] rounded-xl flex flex-col',
  section: 'p-[22px] border-b border-[#F3F4F6] last:border-b-0',
  grid: 'grid grid-cols-[200px_1fr] gap-x-6 gap-y-5 items-start',
  label: 'text-[12px] font-bold tracking-[0.02em] text-[#4E5968]',
  required: 'text-[#0064FF] ml-[3px]',
  input:
    'w-full border border-[#E5E7EB] rounded-md px-3 py-2.5 text-[14px] text-[#191F28] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0064FF] focus:border-transparent',
  /** 언어별 작성 상태 — 저장을 눌러야 알 수 있으면 이미 늦다. */
  langState: 'text-[12px] font-bold rounded-full px-2.5 py-[3px]',
  langDone: 'bg-[#E7F6ED] text-[#2A7D52]',
  langTodo: 'bg-[#FFF4EC] text-[#9A3412]',
  hint: 'text-[12px] text-[#6B7280] mt-2 leading-[1.6]',
  foot: 'flex items-center gap-3 justify-end px-[22px] py-[18px] border-t border-[#E5E7EB]',
  footWarn: 'mr-auto text-[12px] text-[#9A3412]',
} as const;

/**
 * Pass 소개 배너. 계약 범위 밖의 고정 콘텐츠라 API가 없다 —
 * 문구를 바꾸려면 배너 컴포넌트를 고친다.
 */
export const passBannerStyles = {
  /**
   * 넓은 화면에서 그라데이션만으로는 띠 하나로 읽혀서 세 겹으로 면을 세운다:
   * 안쪽 흰 실선(면의 경계), 보라로 물든 그림자(바닥에서 띄우기), 오른쪽 점 격자
   * (글이 없는 절반을 채우는 것). 그림자 색을 중립 검정이 아니라 그라데이션의
   * 어두운 끝(#4C1D95)에서 뽑는다 — 회색 그림자는 보라 면 아래에서 때처럼 읽힌다.
   */
  root:
    'relative isolate overflow-hidden rounded-xl px-12 py-14 text-white flex items-center justify-between gap-10 bg-[linear-gradient(101deg,#6D28D9_0%,#7C3AED_46%,#4F46E5_100%)] ring-1 ring-inset ring-white/20 shadow-[0_20px_44px_-20px_rgba(76,29,149,0.75)]',
  /** 우상단 광원 — 그라데이션만으로는 면이 평평하게 읽힌다. */
  glow: 'pointer-events-none absolute -right-[70px] -top-[90px] w-[280px] h-[280px] rounded-full bg-white/10',
  /** 두 번째 광원. 하나뿐이면 빛의 방향이 아니라 "원이 하나 있다"로 읽힌다. */
  glowSoft:
    'pointer-events-none absolute right-[170px] -bottom-[150px] w-[260px] h-[260px] rounded-full bg-[#A78BFA]/25',
  /**
   * 점 격자 — 글이 끝나는 지점부터 오른쪽 끝까지. 왼쪽으로 갈수록 사라지는 마스크를
   * 걸어 본문 대비는 건드리지 않는다(글자 뒤에는 점이 오지 않는다).
   */
  dots:
    'pointer-events-none absolute inset-y-0 right-0 w-[58%] bg-[radial-gradient(circle,rgba(255,255,255,0.20)_1px,transparent_1px)] bg-[length:18px_18px] [mask-image:linear-gradient(to_right,transparent,#000_60%)]',
  /** 장식이 절대 배치라 본문은 새 층으로 올려야 점 격자 위에 온다. */
  content: 'relative z-[1] min-w-0',
  eyebrow: 'text-[12px] font-bold tracking-[0.1em] uppercase text-white/[0.78]',
  /**
   * 40 은 이 앱이 이미 쓰는 최대 크기다(다른 5곳). 32 로는 페이지 제목 30 과 두 칸
   * 차이라 배너가 목록을 이기지 못했다 — 1584px 면 안에서 32px 은 띠에 얹은 글이지
   * 히어로가 아니다.
   */
  title: 'text-[40px] font-extrabold tracking-[-0.03em] leading-[1.2] mt-2',
  /**
   * 16 은 읽기 크기이기도 하지만, 여기서는 글 블록의 폭을 정하는 값이다 —
   * `max-w` 단위가 `ch` 라서 본문 크기가 곧 컬럼 폭이다(14px·60ch 일 때 500px 로
   * 쪼그라들어 면의 32% 만 썼다).
   */
  body: 'text-[16px] text-white/[0.86] leading-[1.7] mt-4 max-w-[58ch]',
  cta:
    'relative z-[1] whitespace-nowrap bg-white text-[#5B21B6] text-[16px] font-bold px-7 py-4 rounded-lg shadow-[0_8px_20px_-8px_rgba(23,10,60,0.55)]',
} as const;

// =============================================================================
// 타입 내보내기 (Type Exports)
// =============================================================================

export type StatusType = keyof typeof statusColors;
export type ButtonVariant = keyof typeof buttonStyles.variants;
export type ButtonSize = keyof typeof buttonStyles.sizes;
export type CardPadding = keyof typeof cardStyles.padding;
export type ModalSize = keyof typeof modalStyles.sizes;
