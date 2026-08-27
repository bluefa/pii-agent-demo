/**
 * Step 1 정의 화면의 표면 어휘. 전부 `lib/theme` 토큰의 조합이고, 이 파일 밖에서
 * 클래스 문자열을 다시 짓지 않는다 — 같은 모양(칩·행·알약)이 네 파일에 흩어지면
 * 한 곳만 고쳐지는 날이 온다.
 *
 * 권역 밴드와 Region 칩이 **다른 모양**인 것은 계층이다: 권역은 대상소스에 하나인 값
 * (회색 세그먼트), Region 은 행마다 고르는 값(파란 아웃라인 칩). 같은 모양이면 담당자가
 * 둘을 같은 층위로 읽는다.
 */
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  numericFeatures,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { SduRowDiff } from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';

/** 필드 라벨과 그 아래 한 줄 설명 — 편집 행 안의 네 묶음이 공유한다. */
export const fieldStyles = {
  label: cn('text-[14px] font-bold', textColors.primary),
  counter: cn('text-[12px] font-semibold', numericFeatures.tabular, textColors.tertiary),
  counterFull: cn('text-[12px] font-semibold', numericFeatures.tabular, statusColors.error.textDark),
  hint: cn('mt-1 text-[12px] leading-[1.5]', textColors.tertiary),
  /** 규칙을 어겼다고 말하는 줄. 조용히 자르지 않는다는 약속의 실행부. */
  message: cn('mt-1.5 text-[12px] font-medium', statusColors.error.textDark),
} as const;

/** 고르는 값 — 클라우드·Region 이 같은 칩을 쓴다. */
export const choiceChipStyles = {
  base: 'inline-flex h-8 items-center rounded-[10px] border px-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  on: cn(primaryColors.border, primaryColors.bgLight, primaryColors.textOnLight),
  off: cn(
    borderColors.default,
    bgColors.surface,
    textColors.secondary,
    interactiveColors.unselectedBorder,
  ),
} as const;

export const bandStyles = {
  frame: cn(
    'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border px-4 py-3',
    borderColors.default,
    bgColors.surface,
  ),
  label: cn('text-[14px] font-bold', textColors.primary),
  sub: cn('text-[12px]', textColors.tertiary),
  /** 잠긴 이유 — 밴드 옆에서 말한다. 못 누르는 것과 왜 못 누르는지는 다른 정보다. */
  lockHint: cn('inline-flex items-center gap-1 text-[12px] font-medium', statusColors.warning.textDark),
} as const;

export const listStyles = {
  bar: 'flex flex-wrap items-center gap-x-3 gap-y-1',
  barTitle: cn('text-[16px] font-bold', textColors.primary),
  barCount: cn('text-[14px] font-bold', primaryColors.text),
  barStat: cn('text-[12px]', textColors.tertiary),
  /**
   * ⚠️ 바탕색이 없다. `cn` 은 단순 join 이라 한 문자열 안에 `bg-white` 와 `bg-gray-50` 을
   * 함께 넣으면 어느 쪽이 이길지 클래스 순서가 아니라 Tailwind 가 CSS 에 찍는 순서로
   * 정해진다 — 그래서 면은 아래 두 짝 중 하나를 호출자가 **골라서** 붙인다.
   */
  row: 'flex items-center gap-3 rounded-[12px] border px-4 py-3 ' + borderColors.default,
  rowSurface: bgColors.surface,
  /** 삭제 표시된 행은 목록에 남아 있되 물러나 있다. */
  rowRemoved: cn('opacity-60', bgColors.muted),
  /** 폭 없는 번호 — 접힌 행은 열을 맞추려 `index` 를, 편집 행은 이것을 쓴다. */
  indexBare: cn('shrink-0 text-[12px] font-bold', numericFeatures.tabular, textColors.tertiary),
  index: cn('w-6 shrink-0 text-[12px] font-bold', numericFeatures.tabular, textColors.tertiary),
  cloud: cn('w-16 shrink-0 text-[14px] font-bold', textColors.primary),
  region: cn(
    'inline-flex h-6 shrink-0 items-center rounded-[6px] px-2 text-[12px] font-bold',
    primaryColors.bgLight,
    primaryColors.textOnLight,
  ),
  ip: cn('w-36 shrink-0 text-[14px] font-medium', numericFeatures.tabular, textColors.secondary),
  types: cn('min-w-0 flex-1 truncate text-[12px]', textColors.tertiary),
  actions: 'ml-auto flex shrink-0 items-center gap-2',
  editorFrame: cn(
    'rounded-[12px] border-2 p-4',
    primaryColors.border,
    bgColors.surface,
  ),
  editorHead: 'flex items-center gap-2',
  editorTag: cn(
    'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold',
    primaryColors.bgLight,
    primaryColors.textOnLight,
  ),
  editorFoot: cn('mt-5 flex justify-end gap-2 border-t pt-4', borderColors.light),
  addButton: cn(
    'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed text-[14px] font-bold transition-colors',
    borderColors.strong,
    primaryColors.text,
    bgColors.mutedHover,
  ),
} as const;

/** Database Type 토큰 — 목록에서 고른 것과 직접 친 것을 구분하지 않는다(전부 자유 입력). */
export const tokenStyles = {
  chip: cn(
    'inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-[12px] font-semibold',
    primaryColors.bgLight,
    primaryColors.textOnLight,
  ),
  remove: cn('grid h-4 w-4 place-items-center rounded-full transition-colors', bgColors.surfaceHover),
  quickLabel: cn('text-[12px] font-medium', textColors.tertiary),
  quickChip: cn(
    'inline-flex h-7 items-center rounded-[8px] border px-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    borderColors.default,
    textColors.secondary,
    interactiveColors.unselectedBorder,
  ),
} as const;

const pillBase = 'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold';

/** 돌아온 1단계의 행 상태 알약. 한 계열이 전 상태를 갖는다 — 색만으로 읽히면 안 된다. */
export const rowDiffPill: Record<SduRowDiff, string> = {
  same: cn(pillBase, statusColors.pending.bg, statusColors.pending.textDark),
  changed: cn(pillBase, statusColors.info.bgLight, statusColors.info.textDark),
  added: cn(pillBase, statusColors.success.bg, statusColors.success.textDark),
  removed: cn(pillBase, statusColors.error.bg, statusColors.error.textDark),
};
