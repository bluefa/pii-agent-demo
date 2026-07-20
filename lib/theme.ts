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
    text: 'text-[#45CB85]',
    textDark: 'text-[#2A7D52]',
    border: 'border-[#45CB85]/30',
    dot: 'bg-[#45CB85]',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-500',
    textDark: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-orange-100',
    text: 'text-orange-500',
    textDark: 'text-orange-800',
    border: 'border-orange-300',
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
    text: 'text-[#FF9900]',
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
    text: 'text-[#4285F4]',
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
  tertiary: 'text-gray-500',
  quaternary: 'text-gray-400',
  inverse: 'text-white',
} as const;

/**
 * 배경 색상
 */
export const bgColors = {
  muted: 'bg-gray-50',
  mutedHover: 'hover:bg-gray-50',
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
    soft: 'bg-blue-50 text-[#0064FF] hover:bg-blue-100',
    /** Warn outline — amber outline for overwrite/reload actions (결정 #42). */
    warnOutline: 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100',
    /** v15 danger-outline — soft red fill, no border (#FEF2F2 / #991B1B / 600). */
    dangerOutline: 'bg-[#FEF2F2] text-[#991B1B] font-semibold border-0 hover:bg-[#FEE2E2]',
  },
  sizes: {
    /** v15 .btn.sm — radius 10, h32, 13px. */
    sm: 'px-3 h-8 rounded-[10px] text-[13px]',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  },
} as const;

/**
 * 카드 스타일
 */
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
  cardTitle: 'text-[26px] font-extrabold tracking-[-0.045em] leading-[1.2] text-[#191F28]',
  /** Paragraph beneath a display title (ADR-014 card-subtitle) — v15 13.5/500/#8B95A1. */
  subtitle: 'text-[13.5px] font-medium text-[#8B95A1] leading-[1.55]',
  /** Inline "Provider: X" indicator in a card header — weak label + strong name. */
  providerTag: 'text-[11.5px] text-[#8B95A1]',
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
  base: 'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold',
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

/**
 * Page-meta horizontal kv strip (Toss display variant).
 * See ADR-014 D1; consumer rollout starts in Wave 1.
 */
/**
 * Per-provider brand accent for the v15 `.identity-bar` `--ib-accent` local var
 * (00-tokens.md `--color-provider-*`). Consumed via inline `style` so the
 * accent-derived `color-mix(...)` backgrounds + stripe recolor per provider.
 * Keyed by lowercased CloudProvider; falls back to the Azure default (v15 line 753).
 */
export const providerAccent: Record<string, string> = {
  aws: '#FF9900',
  azure: '#0078D4',
  gcp: '#4285F4',
  idc: '#374151',
  sdu: '#9333EA',
};
export const providerAccentDefault = providerAccent.azure;

/**
 * v15 `.identity-bar` provider/ID/agent strip (01-chrome.md 752–855). Structural
 * + accent classes only; the per-provider accent is injected as the `--ib-accent`
 * CSS var via inline `style` on the bar (see IdentityBar.tsx). All `color-mix`
 * backgrounds + stripe reference that var, so no raw provider hex lives here.
 */
export const identityBarStyles = {
  bar: 'relative flex items-center gap-8 flex-wrap overflow-hidden rounded-[14px] bg-white py-4 pr-[22px] pl-7 mt-4 mb-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_1px_3px_rgba(17,24,39,0.04)] before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--ib-accent)]',
  /** `bare` variant — identity row nested inside a host surface (unified project header card): no chrome/margins of its own. */
  barBare: 'flex items-center gap-8 flex-wrap px-[28px] pb-[18px]',
  /** Provider accent stripe for the host card that absorbs the bare identity row. */
  hostStripe:
    'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--ib-accent)]',
  provider: 'flex items-center gap-3 flex-shrink-0',
  providerIcon:
    'grid place-items-center w-[38px] h-[38px] rounded-[10px] flex-shrink-0 bg-[color-mix(in_srgb,var(--ib-accent)_12%,transparent)] text-[var(--ib-accent)]',
  providerName: 'text-[17px] font-bold tracking-[-0.025em] leading-[1.2] text-[#191F28]',
  providerSub: 'mt-[3px] text-[12px] font-semibold tracking-normal text-[#8B95A1]',
  divider: 'self-stretch w-px my-1 flex-shrink-0 bg-[#EBEEF2]',
  field: 'flex flex-col gap-1 min-w-0',
  key: 'text-[12px] font-semibold tracking-normal text-[#8B95A1]',
  idRow: 'inline-flex items-center gap-1.5',
  mono: 'font-mono text-[13px] font-semibold tracking-normal leading-[1.3] text-[#191F28]',
  copyBase:
    'inline-grid place-items-center w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer transition-[background-color,color] duration-[120ms]',
  copyIdle: 'text-[#8B95A1] hover:bg-[#F7F8FA] hover:text-[#191F28]',
  copyCopied: 'text-[#14B96E]',
  spacer: 'flex-1',
  agent:
    'inline-flex items-center gap-[7px] flex-shrink-0 px-[13px] py-[7px] rounded-full leading-none text-[13px] font-bold tracking-[-0.005em] bg-[color-mix(in_srgb,var(--ib-accent)_10%,transparent)] text-[var(--ib-accent)]',
  agentIcon: 'w-[13px] h-[13px]',
} as const;

/**
 * OpenType numeric features — tabular alignment for step numbers, etc.
 */
export const numericFeatures = {
  tabular: 'tabular-nums',
} as const;

/**
 * 입력 필드 스타일
 */
export const inputStyles = {
  base: 'w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF] focus:border-transparent transition-shadow',
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
    subtitle: 'text-[14px] font-medium leading-[1.6] text-[#8B95A1]',
    body: 'px-10 pt-7 pb-2',
    footer: 'px-10 pt-5 pb-6 border-t border-[#EBEEF2] bg-white flex justify-end gap-2.5',
    iconBase: 'w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0',
    iconInfo: 'bg-[#E8F1FF] text-[#0064FF]',
    iconWarn: 'bg-[#FEF3C7] text-[#B45309]',
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
  /** v15 thead — #F7F8FA bg, 600, #8B95A1; NO uppercase / NO tracking-wider. */
  header: 'bg-[#F7F8FA] text-left text-xs font-semibold text-[#8B95A1]',
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
 * brand 의 raw hex (#C5C6C7 워드마크 / #66FCF1 태그라인) 는 브랜드 색으로 예외 허용.
 * 소비 측에서 이 상수만 참조하고 문자열을 중복 정의하지 말 것.
 */
export const navStyles = {
  bg: 'bg-slate-900',
  brand: {
    wordmark: 'text-[#C5C6C7]',
    tagline: 'text-[#66FCF1]',
  },
  link: {
    inactive: 'text-slate-300 hover:bg-white/5 hover:text-white',
    active: 'text-white bg-white/10',
  },
  user: {
    avatar: 'bg-slate-600 text-white',
    email: 'text-slate-300',
    /** Google account-chip pattern: 32px initial circle, click opens account card. */
    chip: 'w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-white/25 transition-shadow',
    menu: {
      container:
        'absolute right-0 top-full mt-2 z-50 min-w-[240px] max-w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.14)] flex items-center gap-3 text-left',
      avatar:
        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-slate-600 text-white shrink-0',
      name: 'text-sm font-semibold text-gray-900 truncate',
      email: 'text-xs text-gray-500 truncate',
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
  /** Kind badge — `.idc-kind` (11.5px / 600 / 3px 8px / radius 6). */
  kindBadge: {
    base: 'inline-flex items-center rounded-md px-2 py-[3px] text-[11.5px] font-semibold',
    single: 'bg-[#E8F1FF] text-[#1747B5]',
    multi: 'bg-[#FEF0E1] text-[#7A3F0E]',
    domain: 'bg-[#EEF2FF] text-[#4338CA]',
  },
  /** Inline color tag — `.tag` (4px 10px / radius 8 / 12px / 600). */
  tag: {
    base: 'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold tracking-[-0.01em] whitespace-nowrap',
    blue: 'bg-[#E8F1FF] text-[#1747B5]',
    green: 'bg-[#E5F8EE] text-[#197A3F]',
    red: 'bg-[#FEECEC] text-[#B42318]',
    orange: 'bg-[#FEF0E1] text-[#7A3F0E]',
    gray: 'bg-[#F7F8FA] text-[#4E5968]',
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
  /** Target yes/no pill — `.target-pill` (3px 9px / radius 999 / 11.5px / 600 / dot 6px). */
  targetPill: {
    base: 'inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap',
    dot: 'w-1.5 h-1.5 rounded-full',
    yes: { box: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', dot: 'bg-[#10B981]' },
    no: { box: 'bg-white text-[#6B7280] border-[#E5E7EB]', dot: 'bg-[#9CA3AF]' },
  },
  /** Exclusion-reason chip — `.reason-chip-inline` (3px 9px / radius 6 / 11.5px / 500 / cursor help). */
  reasonChip: {
    base: 'inline-flex min-w-0 max-w-full items-center gap-[5px] rounded-[6px] border border-[#FED7AA] bg-[#FFF7ED] px-[9px] py-[3px] text-[11.5px] font-medium text-[#9A3412] cursor-help transition-[background-color,border-color] duration-[120ms] hover:bg-[#FFEDD5] hover:border-[#FDBA74]',
    text: 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]',
    icon: 'flex-shrink-0 text-[#C2410C] opacity-80',
  },
  /** Header status pill (mirrors cloud sibling pill; combine with statusColors.{warning,success}). */
  statusPill: 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  /** Multi-IP endpoint toggle — `.idc-ep-toggle` (11.5px / 600 / primary). */
  epToggle: 'text-[11.5px] font-semibold text-[#0064FF] hover:underline',
  /** Oracle SID key — `.idc-sid-k` (10px / 700 / fg-4 / ls .02em; bare, no bg/pad/radius). */
  sidKey: 'text-[10px] font-bold text-gray-400 tracking-[0.02em]',
  /** Field-level warning under an input — `.idc-field-warn` (#B45309 / 11.5px). */
  fieldWarn: 'mt-1 text-[11.5px] text-[#B45309]',
  /** Field-level error under an input — `.idc-field-err` (#DC2626 / 11.5px). */
  fieldError: 'mt-1 text-[11.5px] text-[#DC2626]',
  /** Add-IP button — `.idc-add-ip` (12.5px / 600 / primary / no border / radius 6 / mt 10). */
  addIp: 'mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-[#0064FF] hover:bg-[#E8F1FF] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent',
  /** Remove-IP icon button — `.rm-ip` (30×30 / radius 7 / fg-3 / red hover). */
  removeIp: 'inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] text-gray-500 transition-colors hover:bg-[#FEECEC] hover:text-[#B42318]',
  /** Row hover action (edit) — `.idc-row-actions button` (26×26 / radius 6 / fg-3). */
  rowAction: 'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#F7F8FA] hover:text-gray-900',
  /** Row hover action (delete) — `.idc-row-actions button.del` (red hover). */
  rowActionDelete: 'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#FEECEC] hover:text-[#B42318]',
  /** Exclusion-reason popover — `.idc-reason-pop`. */
  popover: {
    container: 'fixed z-[120] min-w-[180px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]',
    title: 'px-2.5 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.01em] text-gray-500',
    opt: 'flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-gray-900 transition-colors hover:bg-[#F7F8FA]',
    optSelected: 'bg-[#E8F1FF] font-bold text-[#0064FF]',
    custom: 'mt-1 border-t border-gray-200 pt-2.5 font-semibold text-[#0064FF]',
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
    soft: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#E8F1FF] px-[18px] text-[14px] font-bold tracking-[-0.01em] text-[#0064FF] transition-colors hover:bg-[#D6E7FF]',
    warnOutline: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#FEF3C7] px-[18px] text-[14px] font-semibold tracking-[-0.01em] text-[#92400E] transition-colors hover:bg-[#FDE68A]',
    /** Small blue ghost — v16 `.btn.sm.ghost` (the in-table "set" action). Disabled = opacity-45. */
    ghostSm: 'inline-flex h-8 items-center justify-center gap-1 rounded-[10px] px-3 text-[13px] font-bold text-[#0064FF] transition-colors hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
  },
  /** Toss form input — `.field input/select` (52px / borderless #F7F8FA fill / radius 12 / 15px). */
  input: 'w-full h-[52px] rounded-xl border-0 bg-[#F7F8FA] px-3.5 text-[15px] font-medium text-[#191F28] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF]',
  /** In-cell DB Credential select — v16 `.idc-cred-select` (h32 / #E5E7EB / mono 12 / chevron via style prop). */
  credSelect: 'h-8 max-w-[150px] cursor-pointer appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-[11px] pr-7 font-mono text-[12px] font-semibold text-[#111827] transition-colors hover:border-[#0064FF] focus:border-[#0064FF] focus:outline-none',
  /** `.idc-cred-select` unselected/placeholder state — non-mono, muted. */
  credSelectEmpty: 'font-sans font-medium text-[#6B7280]',
  /** Completion-approval modal (`.req-modal`) header + warn — v16 2647–2698 / 8202. */
  reqModal: {
    eyebrow: 'inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#0064FF]',
    eyebrowDot: 'h-1.5 w-1.5 rounded-full bg-[#0064FF]',
    title: 'mt-2 text-[23px] font-extrabold leading-[1.25] tracking-[-0.03em] text-[#191F28]',
    sub: 'mt-1.5 max-w-[60ch] text-[13px] font-medium leading-[1.6] text-[#6B7280]',
    warn: 'mt-3 rounded-[10px] border border-[#F8D2D0] bg-[#FEF1F1] px-3.5 py-[11px] text-[12.5px] leading-[1.5] text-[#B42318]',
    /** `.req-modal .db-list-table th` override — 11px uppercase #9CA3AF (v16 2682). */
    thHeader: 'bg-[#FAFBFC] text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#9CA3AF]',
    /** `.req-modal .approval-stat .lbl` — 11.5px (v16 req override). */
    statLabel: 'text-[11.5px]',
    /** `.rm-num` excluded logical-DB count — amber (v16 raRender exclCell #B45309). */
    exclNum: 'font-semibold text-[#B45309]',
  },
  /** `.conn-progress` step-5 progress strip — v16 2552–2645 (5 data-states). */
  connProgress: {
    base: 'rounded-xl border px-4 pt-[13px] pb-3.5 mb-3.5 transition-colors',
    state: {
      idle: 'bg-[#F7F8FA] border-[#EBEEF2]',
      running: 'bg-[#F0F6FF] border-[#D5E5FF]',
      pending: 'bg-[#FFF8EC] border-[#FBE6BF]',
      success: 'bg-[#ECFAF2] border-[#C7EED9]',
      fail: 'bg-[#FEF1F1] border-[#F8D2D0]',
    },
    head: 'flex items-center justify-between gap-3 mb-[11px]',
    title: 'flex items-center gap-2 text-[13.5px] font-bold tracking-[-0.01em]',
    titleColor: {
      idle: 'text-[#191F28]',
      running: 'text-[#191F28]',
      pending: 'text-[#B45309]',
      success: 'text-[#197A3F]',
      fail: 'text-[#B42318]',
    },
    accent: {
      idle: 'text-[#8B95A1]',
      running: 'text-[#0064FF]',
      pending: 'text-[#B45309]',
      success: 'text-[#197A3F]',
      fail: 'text-[#B42318]',
    },
    icon: 'inline-grid place-items-center w-[18px] h-[18px] flex-shrink-0',
    meta: 'flex items-center gap-3.5',
    counts: 'text-[12px] font-medium text-[#8B95A1] [font-variant-numeric:tabular-nums]',
    pct: 'min-w-[46px] text-right text-[16px] font-extrabold tracking-[-0.02em] [font-variant-numeric:tabular-nums]',
    track: 'relative h-2 overflow-hidden rounded-full bg-[#E4E7EC]',
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
    row: 'hover:bg-[#F7F8FA] transition-colors',
    cell: 'px-4 py-3.5',
    /** Table wrapper — `.db-list-table` border + radius + shadow (v16 1850–1869). */
    frame:
      'overflow-hidden rounded-xl border border-[#EBEEF2] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04),0_6px_16px_-8px_rgba(17,24,39,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]',
    /** Excluded-row tint — v16 `.approval-table tr.row-excluded`. */
    rowExcluded: 'bg-[#F9FAFB]',
    /** Approval-table header — v16 `.approval-table thead th` (12px/600 #8B95A1, bg #F7F8FA; distinct from the db-list-table 13px/700 header). */
    approvalHeader: 'bg-[#F7F8FA] text-left text-[12px] font-semibold text-[#8B95A1]',
    /** Approval-table header cell padding — v16 12px V / 18px H. */
    approvalHeaderCell: 'px-[18px] py-3',
    /** Approval-table body cell padding — v16 `.approval-table tbody td` 16px V / 18px H. */
    approvalCell: 'px-[18px] py-4',
  },
} as const;

/**
 * "관리" split 버튼 — primary 색상 CSS 변수 경유 (--color-primary)
 */
export const mgmtGroupStyles = {
  primary: 'bg-[var(--color-primary)] text-white rounded-l-md',
  more: 'bg-[var(--color-primary)] text-white rounded-r-md border-l border-white/20',
  menu: 'absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px]',
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
 * existing `mgmtGroupStyles`/`identityBarStyles`). Sizes/letter-spacing/line-
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
  /** section-desc — 12 / 400 / 1.4 / weak. */
  sectionDesc: 'text-[12px] font-normal leading-[1.4] text-[var(--pl-text-weak)]',
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
  /** stat tile main label (Figma Make) — 16 / 600 / medium, below the badge. */
  statLabelMain: 'text-[16px] font-semibold leading-[1.2] text-[var(--pl-text-medium)]',
  /** stat tile value (Figma Make) — 48 / 700 / tabular. */
  statValue: 'text-[48px] font-bold leading-[1.1] tabular-nums',
  statValueDefault: 'text-[var(--pl-text-strong)]',
  /** stat value error tint (failed count > 0) — Figma Make red-500. */
  statValueError: 'text-[var(--pl-err)]',
  /** stat value denominator — 20 / 500 / faint. */
  statDen: 'text-[20px] font-medium text-[var(--pl-text-faint)]',
  /** status-bar current label — 14 / 600 / medium. */
  statusCurrent: 'text-[14px] font-semibold text-[var(--pl-text-medium)]',
  /** sidebar caption — 12 / 600 / +.06em / uppercase. */
  sidebarTitle: 'text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pl-gray-500)]',
} as const;

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

/** Pill background+text+border per wire status (Figma dashboard mock — soft
 *  tint + hairline border + status icon, replacing the old filled dot). */
const PIPELINE_PILL_TONE: Record<PipelineStatusToneKey, string> = {
  PENDING: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)] border border-[var(--pl-warn-border)]',
  RUNNING: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] border border-[var(--pl-info-border)]',
  IN_PROGRESS:
    'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)] border border-[var(--pl-info-border)]',
  // NOTE: prototype `.pill.s-READY` is PRIMARY (blue), not warn — HTML wins over
  // the inventory's "READY=warn" parenthetical (see report).
  READY: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)] border border-[var(--pl-primary-ring)]',
  DONE: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)] border border-[var(--pl-ok-border)]',
  FAILED: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)] border border-[var(--pl-err-border)]',
  CANCELLED: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)] border border-[var(--pl-off-border)]',
  BLOCKED: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)] border border-[var(--pl-off-border)]',
};

/** Status icon name per wire status (RUNNING/IN_PROGRESS spin via
 *  `animate-spin`) — plain string, not `IconName`: theme.ts stays
 *  dependency-free of app/ components; the consumer casts on read. */
const PIPELINE_PILL_ICON: Record<PipelineStatusToneKey, string> = {
  PENDING: 'clock',
  RUNNING: 'loader',
  IN_PROGRESS: 'loader',
  READY: 'check',
  DONE: 'check',
  FAILED: 'x-circle',
  CANCELLED: 'ban',
  BLOCKED: 'ban',
};

/** Dashboard status dot+text tone (Figma Make) — colored text + matching dot,
 *  no pill background. Keyed by wire status (task-level keys included for safety;
 *  the dashboard list only surfaces pipeline statuses). */
const DASHBOARD_STATUS_TONE: Record<PipelineStatusToneKey, { text: string; dot: string }> = {
  PENDING: { text: 'text-[var(--pl-warn)]', dot: 'bg-[var(--pl-warn)]' },
  RUNNING: { text: 'text-[var(--pl-info)]', dot: 'bg-[var(--pl-info)]' },
  IN_PROGRESS: { text: 'text-[var(--pl-info)]', dot: 'bg-[var(--pl-info)]' },
  READY: { text: 'text-[var(--pl-warn)]', dot: 'bg-[var(--pl-warn)]' },
  DONE: { text: 'text-[var(--pl-ok)]', dot: 'bg-[var(--pl-ok)]' },
  FAILED: { text: 'text-[var(--pl-err)]', dot: 'bg-[var(--pl-err)]' },
  CANCELLED: { text: 'text-[var(--pl-text-faint)]', dot: 'bg-[var(--pl-gray-300)]' },
  BLOCKED: { text: 'text-[var(--pl-text-faint)]', dot: 'bg-[var(--pl-gray-300)]' },
};

/** Provider dot fill per lowercased provider key. */
const PIPELINE_PROVIDER_DOT: Record<string, string> = {
  aws: 'bg-[var(--pl-pv-aws)]',
  azure: 'bg-[var(--pl-pv-azure)]',
  gcp: 'bg-[var(--pl-pv-gcp)]',
  idc: 'bg-[var(--pl-pv-idc)]',
  sdu: 'bg-[var(--pl-pv-sdu)]',
};

/** Shared input/select chrome WITHOUT horizontal padding (callers add px so the
 *  search variant's pl-30 never collides with a base px in the join). */
const pipelineInputBase =
  'h-8 rounded-lg border border-[var(--pl-border-strong)] text-[14px] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-faint)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]';

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
    shell: 'flex min-w-[1080px] min-h-[calc(100vh_-_56px)] bg-[var(--pl-bg-page)] tracking-[-0.014em] leading-[1.4] [font-family:var(--pl-font-sans)]',
    sidebar: 'w-[216px] flex-none bg-[var(--pl-gray-900)] px-3 py-4',
    sidebarTitle: cn(pipelineText.sidebarTitle, 'block px-2.5 pt-2 pb-2.5'),
    // Item base carries no text color/weight — idle/active own it (plain `cn` join
    // has no tailwind-merge, so overlapping utilities must never co-occur).
    sidebarItem: 'block px-2.5 py-[7px] mb-0.5 rounded-md text-[14px] cursor-pointer',
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
    contentDetail: 'flex-1 min-w-0 flex flex-col px-8 pt-6 pb-12',
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
     *  to the card radius. Dashboard-exclusive (page.tsx). */
    flush: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[12px] shadow-[var(--pl-shadow-xs)] overflow-hidden',
  },

  /** KPI card period badge (Figma Make redesign) — neutral rounded-md chip with
   *  a hairline border, above the label ("현재" / "최근 24시간"). */
  statBadge: {
    base: 'inline-flex items-center rounded-md border border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--pl-text-weak)]',
  },

  /** Section header (title 64/0/12 margins; desc R22.5: 16 below title — the
   *  R18 8px read cramped to the owner — 16 above content). mt-4 vs the
   *  title's mb-3 collapses to 16px (block siblings). */
  section: {
    title: cn(pipelineText.sectionTitle, 'mt-16 mb-3'),
    titleFirst: cn(pipelineText.sectionTitle, 'mt-0 mb-3'),
    desc: cn(pipelineText.sectionDesc, 'mt-4 mb-4'),
  },

  /** StatusPill — h20 pad 0 9 0 8 (lg h28 pad 0 12 0 10), icon 12/14. Size lives
   *  entirely in md/lg (never in base) so the two never collide in a join. */
  pill: {
    base: 'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-[0.02em]',
    md: 'h-5 pr-[9px] pl-2 text-[12px]',
    lg: 'h-7 pr-3 pl-2.5 text-[14px]',
    tone: PIPELINE_PILL_TONE,
    icon: PIPELINE_PILL_ICON,
  },

  /** PipelineTypeTag (R18 §1) — icon+color+enum triple encoding; bg-less inline
   *  tag so it never competes with the filled status pills. Icon carries the
   *  hue (tone), text stays medium mono. */
  typeTag: {
    base: 'inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
    tone: {
      INSTALL: 'text-[var(--pl-type-install)]',
      DELETE: 'text-[var(--pl-type-delete)]',
      CUSTOM: 'text-[var(--pl-type-custom)]',
    } as Record<'INSTALL' | 'DELETE' | 'CUSTOM', string>,
  },

  /** JobKindTag — the terraform action (PLAN/APPLY/DESTROY) as a small bordered
   *  pill on a job node. Bordered + colored text (no fill) so it stays below the
   *  filled status badge; DESTROY reads red, APPLY green, PLAN neutral. */
  jobKindTag: {
    base: 'inline-flex items-center rounded border px-1 leading-[15px] text-[10px] font-bold tracking-wide [font-family:var(--pl-font-mono)]',
    tone: {
      PLAN: 'border-[var(--pl-border-strong)] text-[var(--pl-text-medium)]',
      APPLY: 'border-[var(--pl-ok)] text-[var(--pl-ok)]',
      DESTROY: 'border-[var(--pl-err)] text-[var(--pl-err)]',
    } as Record<'PLAN' | 'APPLY' | 'DESTROY', string>,
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

  /** ProvTag — neutral text + 8×8 r2.5 brand dot; 12/500 medium. */
  provTag: {
    base: 'inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--pl-text-medium)]',
    dot: 'w-2 h-2 rounded-[2.5px]',
    dotTone: PIPELINE_PROVIDER_DOT,
  },

  /** PipelineProgressBar — track 110 (160 wide), h6; fill by state; N/M 12/600 tabular.
   *  Track width lives in trackNarrow/trackWide (never in the base). */
  progress: {
    wrap: 'inline-flex items-center gap-2',
    track: 'block h-1.5 rounded-full bg-[var(--pl-gray-200)] overflow-hidden',
    trackNarrow: 'w-[110px]',
    trackWide: 'w-[160px]',
    fill: 'block h-full rounded-full',
    fillPrimary: 'bg-[var(--pl-primary)]',
    fillOk: 'bg-[var(--pl-ok)]',
    fillErr: 'bg-[var(--pl-err)]',
    fillOff: 'bg-[var(--pl-off)]',
    label: 'text-[12px] font-semibold text-[var(--pl-text-weak)] tabular-nums',
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
    icon: 'inline-flex items-center justify-center w-10 h-10 mb-2.5 rounded-full bg-[var(--pl-gray-100)] text-[var(--pl-text-faint)]',
    meta: cn(pipelineText.meta),
  },

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
    icon: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--pl-text-faint)] pointer-events-none',
    input: cn(pipelineInputBase, 'w-full pr-2.5 pl-[30px]'),
    /** Dashboard filter-bar variant (Figma Make) — h9, white fill, r8 border,
     *  16px inset icon, blue focus ring. */
    iconLg: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--pl-text-faint)] pointer-events-none',
    inputLg:
      'h-9 rounded-lg border border-[var(--pl-border)] text-[14px] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] placeholder:text-[var(--pl-text-faint)] focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] w-full pr-3 pl-9',
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
   * Dashboard list (Figma Make redesign, page.tsx-exclusive). A self-contained
   * token set so the shared StatusPill / PipelineProgressBar / ProvTag / PlTable
   * (used by the detail pages) stay untouched. Cells: #id chip, dot+text status,
   * gray progress, plain cloud text, relative-time cell with hover tooltip, and
   * a hover-reveal dark action button.
   */
  dashboard: {
    /** KPI grid — 4 equal columns, then a gap before the list card. */
    kpiGrid: 'grid grid-cols-4 gap-4 mb-8',
    /** KPI card inner column — centered badge → label → value. */
    kpiCard: 'flex flex-col items-center text-center gap-3',
    /** Page header row (title + period selector). */
    headerRow: 'flex items-center justify-between mb-6',

    /** List-card header (title + timestamp), first row inside the flush card. */
    listBar: 'flex items-center justify-between px-5 py-4 border-b border-[var(--pl-gray-100)]',
    listStamp: 'inline-flex items-center gap-1 text-[12px] text-[var(--pl-text-faint)]',

    /** Filter bar inside the card — tinted, bordered, h9 controls. */
    filterBar: 'flex items-center gap-2 px-5 py-3 border-b border-[var(--pl-gray-100)] bg-[var(--pl-gray-50)]',
    /** Search wrapper — flex-1 up to a max width (SearchBox adds `relative`). */
    searchWrap: 'flex-1 max-w-xs',
    /** Removable-filter chips row inside the card (only rendered when a filter is on). */
    chipsWrap: 'px-5',

    /** Table chrome. */
    table: 'w-full',
    headRow: 'border-b border-[var(--pl-gray-100)]',
    th: 'px-5 py-3 text-left whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--pl-text-faint)]',
    body: 'divide-y divide-[var(--pl-gray-100)]',
    row: 'group cursor-pointer transition-colors hover:bg-[var(--pl-gray-50)]',
    cell: 'px-5 py-3.5 align-middle',

    /** 서비스 이름/코드/대상 — separate columns (이름 ≤20자, 코드 3자). */
    serviceName: 'block max-w-[28ch] truncate text-[14px] font-semibold text-[var(--pl-text-strong)]',
    serviceCode:
      'whitespace-nowrap text-[14px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
    targetId: 'text-[14px] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]',
    /** Cloud — plain medium text (no brand dot). */
    cloudText: 'text-[14px] font-medium text-[var(--pl-text-medium)]',
    /** Pipeline type — icon + text. */
    typeCell: 'inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--pl-text-medium)]',

    /** Status — colored dot + text (no pill). */
    status: 'inline-flex items-center gap-1.5 text-[12px] font-semibold',
    statusDot: 'w-1.5 h-1.5 rounded-full flex-shrink-0',
    statusTone: DASHBOARD_STATUS_TONE,

    /** Progress — gray track + gray fill + N/M count. The fill is `block` so its
     *  `h-full` resolves against the track height (an inline span would collapse). */
    progressWrap: 'flex items-center gap-2 min-w-[120px]',
    progressTrack: 'block flex-1 h-1 rounded-full bg-[var(--pl-gray-100)] overflow-hidden',
    progressFill: 'block h-full rounded-full bg-[var(--pl-gray-400)] transition-all duration-500',
    progressCount: 'text-[12px] text-[var(--pl-text-faint)] tabular-nums whitespace-nowrap',

    /** Relative-time cell + hover tooltip (named group so only the cell triggers it). */
    timeWrap: 'group/time relative inline-block',
    timeText: 'text-[14px] text-[var(--pl-text-weak)] cursor-default',
    timeTip:
      'absolute bottom-full left-0 mb-1.5 hidden group-hover/time:block z-10 whitespace-nowrap rounded-lg bg-[var(--pl-gray-800)] px-2.5 py-1.5 text-[12px] text-[var(--pl-white)] shadow-[var(--pl-shadow-lg)]',

    /** Row action — hover-reveal dark button (row hover via the unnamed group). */
    actionCell: 'px-5 py-3.5 text-right',
    action:
      'inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--pl-gray-300)] transition-all group-hover:bg-[var(--pl-gray-900)] group-hover:text-[var(--pl-white)] group-hover:shadow-[var(--pl-shadow-xs)]',

    /** Pagination — centered icon buttons + count. */
    pager: 'flex items-center justify-center gap-2 px-5 py-3.5 border-t border-[var(--pl-gray-100)]',
    pagerBtn:
      'inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--pl-text-faint)] transition-colors hover:text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-100)] disabled:opacity-40 disabled:pointer-events-none',
    pagerCount: 'text-[14px] text-[var(--pl-text-weak)] tabular-nums',

    /** No-results empty state inside the card. */
    empty: 'px-5 py-12 text-center text-[14px] text-[var(--pl-text-faint)]',
    /** Loading / error min-height so the card doesn't collapse. */
    stateBox: 'min-h-[240px] flex flex-col items-center justify-center gap-3 text-[14px] text-[var(--pl-text-faint)]',
  },
} as const;

// =============================================================================
// 타입 내보내기 (Type Exports)
// =============================================================================

export type StatusType = keyof typeof statusColors;
export type ButtonVariant = keyof typeof buttonStyles.variants;
export type ButtonSize = keyof typeof buttonStyles.sizes;
export type CardPadding = keyof typeof cardStyles.padding;
export type ModalSize = keyof typeof modalStyles.sizes;
