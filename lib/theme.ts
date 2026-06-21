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
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-500 rounded-md transition-colors hover:text-gray-700',
  itemActive: 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
} as const;

/**
 * Page chrome — breadcrumb / title / subtitle stack above ProviderTabs.
 * Values track DESIGN.md page-title / page-breadcrumb / page-subtitle (ADR-014).
 */
export const pageChromeStyles = {
  breadcrumb: 'text-[13px] text-gray-500 px-6 pt-5 font-medium',
  title: 'text-[30px] font-extrabold tracking-[-0.03em] text-gray-900 px-6 mt-1 leading-[1.2]',
  subtitle: 'text-[13.5px] text-gray-500 px-6 mt-1 mb-5',
} as const;

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
 * TopNav 스타일 — SIT 프로토타입 전용 (slate-900 shell + 브랜드 그라디언트)
 *
 * brandGradient 의 raw hex (#0064FF / #4F46E5) 는 브랜드 색으로 예외 허용.
 * 소비 측에서 이 상수만 참조하고 문자열을 중복 정의하지 말 것.
 */
export const navStyles = {
  bg: 'bg-slate-900',
  brandGradient: 'bg-gradient-to-br from-[#0064FF] to-[#4F46E5]',
  link: {
    inactive: 'text-slate-300 hover:bg-white/5 hover:text-white',
    active: 'text-white bg-white/10',
  },
  user: {
    avatar: 'bg-slate-600 text-white',
    email: 'text-slate-300',
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
  /** v15 StepBanner — radius 12, 18/22 padding, no border, 500, font 14. */
  base: 'flex items-center gap-3 px-[22px] py-[18px] mb-4 rounded-[12px] font-medium text-[14px]',
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
    base: 'inline-flex max-w-full items-center gap-[5px] rounded-[6px] border border-[#FED7AA] bg-[#FFF7ED] px-[9px] py-[3px] text-[11.5px] font-medium text-[#9A3412] cursor-help transition-[background-color,border-color] duration-[120ms] hover:bg-[#FFEDD5] hover:border-[#FDBA74]',
    text: 'overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]',
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
  },
  /** In-card / step CTA buttons — `.btn` base (h40 / radius12 / 14px / 700) + variants. */
  triggerBtn: {
    primary: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0064FF] px-[18px] text-[14px] font-bold tracking-[-0.01em] text-white transition-colors hover:bg-[#0050D6] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]',
    soft: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#E8F1FF] px-[18px] text-[14px] font-bold tracking-[-0.01em] text-[#0064FF] transition-colors hover:bg-[#D6E7FF]',
    warnOutline: 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#FEF3C7] px-[18px] text-[14px] font-semibold tracking-[-0.01em] text-[#92400E] transition-colors hover:bg-[#FDE68A]',
  },
  /** Toss form input — `.field input/select` (52px / borderless #F7F8FA fill / radius 12 / 15px). */
  input: 'w-full h-[52px] rounded-xl border-0 bg-[#F7F8FA] px-3.5 text-[15px] font-medium text-[#191F28] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF]',
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
// 타입 내보내기 (Type Exports)
// =============================================================================

export type StatusType = keyof typeof statusColors;
export type ButtonVariant = keyof typeof buttonStyles.variants;
export type ButtonSize = keyof typeof buttonStyles.sizes;
export type CardPadding = keyof typeof cardStyles.padding;
export type ModalSize = keyof typeof modalStyles.sizes;
