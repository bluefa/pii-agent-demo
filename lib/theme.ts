/**
 * 디자인 토큰 시스템
 *
 * 이 파일은 UI 스타일을 중앙에서 관리합니다.
 * Look & Feel 변경 시 이 파일만 수정하면 됩니다.
 */

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
  base: 'px-4 py-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  variants: {
    primary: 'bg-[#0064FF] text-white hover:bg-[#0050D6] shadow-sm hover:shadow',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow',
    success: 'bg-[#45CB85] text-white hover:bg-[#3AB574] shadow-sm hover:shadow',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  },
  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  },
} as const;

/**
 * 카드 스타일
 */
export const cardStyles = {
  base: 'bg-white rounded-xl shadow-sm',
  padding: {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  },
  header: 'px-6 py-4 border-b border-gray-100',
  title: 'text-sm font-semibold text-gray-500 uppercase tracking-wide',
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
 */
export const pageChromeStyles = {
  breadcrumb: 'text-[12.5px] text-gray-500 px-6 pt-5',
  title: 'text-[24px] font-semibold tracking-[-0.02em] text-gray-900 px-6 mt-1',
  subtitle: 'text-[13.5px] text-gray-500 px-6 mt-1 mb-5',
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
  header: 'bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
  headerCell: 'px-6 py-3',
  body: 'divide-y divide-gray-100',
  row: 'hover:bg-gray-50 transition-colors',
  cell: 'px-6 py-4',
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
 * Confirm step modal — 시안 SIT Prototype v3 line 2563–2587 의 단계 되돌리기 confirm
 */
export const confirmModalStyles = {
  iconCircle: {
    warn: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
  },
  note: {
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
  },
  dangerOutlineButton:
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  outlineButton:
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
} as const;

/**
 * Step banner — 단계 본문 위 안내 배너 (시안 SIT Prototype v3 line 1832)
 */
export const bannerStyles = {
  base: 'flex items-center gap-3 px-4 py-3 mb-4 rounded-[10px] border text-[13px]',
  variants: {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-amber-50 border-amber-300 text-amber-900',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  },
} as const;

/**
 * 인라인 색상 태그 — DB Type, 연동 대상/비대상 등 6종
 */
export const tagStyles = {
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
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
  card: 'rounded-xl',
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
// 타입 내보내기 (Type Exports)
// =============================================================================

export type StatusType = keyof typeof statusColors;
export type ButtonVariant = keyof typeof buttonStyles.variants;
export type ButtonSize = keyof typeof buttonStyles.sizes;
export type CardPadding = keyof typeof cardStyles.padding;
export type ModalSize = keyof typeof modalStyles.sizes;
