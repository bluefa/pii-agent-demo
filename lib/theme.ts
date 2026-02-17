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
 * 기본 색상
 * - primary: 주요 액션, 링크, 강조
 * - secondary: 보조 액션
 */
export const colors = {
  primary: {
    base: '[#0064FF]',
    hover: '[#0050D6]',
    light: '[#E8F1FF]',
    text: '[#0064FF]',
  },
  secondary: {
    base: 'gray-100',
    hover: 'gray-200',
    text: 'gray-700',
  },
} as const;

/**
 * 상태 색상 (CLAUDE.md 규칙 준수)
 * - success (green-500): 연결됨, 완료
 * - error (red-500): 끊김, 에러
 * - warning (orange-500): 진행중, AWS
 * - pending (gray-400): 대기중
 * - info (blue-500): 신규
 */
export const statusColors = {
  success: {
    bg: 'bg-green-100',
    text: 'text-green-500',
    textDark: 'text-green-800',
    border: 'border-green-300',
    dot: 'bg-green-500',
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
    text: 'text-blue-500',
    textDark: 'text-blue-800',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
} as const;

/**
 * Cloud Provider 브랜드 색상
 */
export const providerColors = {
  AWS: { border: 'border-[#FF9900]', bg: 'bg-[#FF9900]/5', text: 'text-[#FF9900]' },
  Azure: { border: 'border-[#0078D4]', bg: 'bg-[#0078D4]/5', text: 'text-[#0078D4]' },
  GCP: { border: 'border-[#4285F4]', bg: 'bg-[#4285F4]/5', text: 'text-[#4285F4]' },
  IDC: { border: 'border-gray-700', bg: 'bg-gray-50', text: 'text-gray-700' },
  SDU: { border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-600' },
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
  primary: 'bg-[#0064FF]',
} as const;

/**
 * 보더 색상
 */
export const borderColors = {
  default: 'border-gray-200',
} as const;

/**
 * 인터랙티브 요소 색상
 */
export const interactiveColors = {
  closeButton: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
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
    success: 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow',
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
} as const;

/**
 * 입력 필드 스타일
 */
export const inputStyles = {
  base: 'w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0064FF] focus:border-transparent transition-shadow',
  error: 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500',
  success: 'border-green-300 bg-green-50',
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
