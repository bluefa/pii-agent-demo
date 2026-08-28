/**
 * Step 1 정의 화면의 표면 어휘. 전부 `lib/theme` 토큰의 조합이고, 이 파일 밖에서
 * 클래스 문자열을 다시 짓지 않는다 — 같은 모양(칩·행·알약)이 네 파일에 흩어지면
 * 한 곳만 고쳐지는 날이 온다.
 *
 * 권역은 대상소스가 가진 값이라 이 파일에 표면이 없다 — 목록 위 한 줄(`scopeNote`)이
 * 전부이고, 고르는 값인 Region 만 칩을 입는다.
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

export const listStyles = {
  /** 목록 머리줄과 같은 톤 — 정해져 있는 권역을 말할 뿐 고르게 하지 않는다. */
  scopeNote: cn('mb-3 text-[12px]', textColors.tertiary),
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

/**
 * 대상 추가 마법사의 표면. 「인프라 등록」 마법사(`ProjectCreateModal`)와 같은 문법이다 —
 * 회색 바닥 위에 레일이 그대로 앉고, 내용만 흰 카드가 된다.
 *
 * `ground` 의 음수 마진은 공용 `Modal` 본문의 `p-6` 을 되돌리는 자리다. 회색 바닥이 모서리까지
 * 닿지 않으면 카드 둘레에 흰 테가 남아 바닥이 또 하나의 상자로 읽힌다. 공용 푸터 슬롯은 쓰지
 * 않는다 — 참조 마법사처럼 버튼은 흰 판 안, 스크롤러 바깥에 선다. 회색 바닥 위에 놓인 버튼은
 * 어느 판에 속한 것인지 말하지 못한다.
 *
 * 높이를 고정하는 이유는 참조 마법사와 같다 — 네 단계의 내용 높이가 다른데 상자가 따라
 * 늘었다 줄었다 하면 「다음」 버튼이 클릭 사이에 움직인다. 값은 가장 긴 단계가 정한다:
 * 3단계(타일 두 줄 + 칩 한 줄 + 열린 입력칸)가 459px 로 가장 길고, 1단계가 426px 이다.
 */
export const addWizardStyles = {
  ground: cn('-m-6 flex h-[464px] gap-4 p-4', bgColors.panel, textColors.primary),
  card: cn(
    'flex min-h-0 flex-1 flex-col rounded-lg border',
    borderColors.card,
    bgColors.surface,
    textColors.primary,
  ),
  /** 카드 안의 스크롤러. pt-6 은 레일의 것과 같다 — 단계 제목과 모달 제목이 같은 줄에서 시작한다. */
  cardBody: 'min-h-0 flex-1 overflow-y-auto px-[30px] pt-6 pb-4',
  /** 스크롤러 바깥, 흰 판의 오른쪽 아래. 참조 마법사와 같은 px-[30px] pb-[26px] 다. */
  cardFoot: 'flex flex-none items-center justify-end gap-2 px-[30px] pb-[26px]',
  /**
   * 판 높이를 그대로 쓰는 단계. 목록 길이가 클라우드마다 다른 3단계가 이것을 쓴다 —
   * 넘치는 몫은 타일 판이 자기 안에서 굴리고, 그 아래 줄들은 자리를 잃지 않는다.
   */
  stepFill: 'flex h-full min-h-0 flex-col',
  stepTitle: cn('text-[18px] font-bold', textColors.primary),
  stepLead: cn('mt-1 mb-5 text-[14px]', textColors.tertiary),
  /** 확인 단계 — 고치는 자리가 아니므로 네 값을 라벨과 함께 읽어 주기만 한다. */
  summary: 'grid grid-cols-[112px_1fr] items-baseline gap-x-4 gap-y-3.5',
  summaryTerm: cn('text-[14px] font-bold', textColors.primary),
  summaryValue: cn('text-[14px]', textColors.secondary),
  summaryIp: cn('text-[14px]', numericFeatures.tabular, textColors.secondary),
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

/**
 * 자주 쓰는 타입을 타일 판으로 고르는 자리 — 「인프라 등록」 마법사의 Database 단계와 같은
 * 어휘다(`Step3Databases`). 거기는 열거형이라 판이 곧 전부지만, 여기 Database Type 은 자유
 * 입력이라 판 아래에 직접 입력하는 길(점선 줄)이 함께 서야 한다.
 */
export const dbGridStyles = {
  /**
   * 이 컴포넌트는 세로 flex 안에서 판만 늘고 주는 것을 전제한다 — 라벨과 안내는 위에,
   * 직접 입력·칩·상한 줄은 아래에 붙박이고, 가운데 판만 남는 자리를 가진다.
   */
  root: 'flex min-h-0 flex-1 flex-col',
  head: 'flex flex-none items-center gap-2',
  /**
   * 판은 자기 안에서 굴린다. 상한 204 = 타일 네 줄(45 × 4 + 8 × 3) — AWS 14개까지가
   * 네 줄이고, 다섯 줄이 되는 것은 기타(17개)뿐이다. `min-h-0` 이 있어야 좁은 판에서
   * 이 상자가 먼저 줄고, 아래 줄들이 밀려 잘리지 않는다.
   */
  grid: 'mt-2.5 grid min-h-0 max-h-[204px] grid-cols-4 gap-2 overflow-y-auto',
  /** 판 아래 붙박이 — 자유 입력으로 나가는 길은 어떤 목록 길이에서도 사라지면 안 된다. */
  foot: 'flex-none',
  tile: 'flex items-center justify-center gap-2 rounded-[10px] border-2 px-2 py-2.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  tileOn: cn(primaryColors.border, primaryColors.bgLight, primaryColors.textOnLight),
  tileOff: cn(
    borderColors.default,
    bgColors.surface,
    textColors.secondary,
    interactiveColors.unselectedBorder,
  ),
  /** 15px 체크칸. 타일 전체가 눌리는 자리이므로 이 칸은 상태 표시일 뿐 aria 에 노출하지 않는다. */
  box: 'inline-flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded border-2',
  boxOn: cn(primaryColors.border, primaryColors.bg, textColors.inverse),
  boxOff: borderColors.strong,
  /** 판에 없는 이름으로 나가는 길. 점선은 "여기서 끝이 아니다"는 뜻이다. */
  customRow: cn(
    'mt-2.5 w-full rounded-[10px] border-2 border-dashed px-3.5 py-2.5 text-left text-[14px] transition-colors',
    borderColors.strong,
    textColors.secondary,
    bgColors.mutedHover,
  ),
  customOpen: 'mt-2.5 flex items-center gap-2',
} as const;

const pillBase = 'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold';

/** 돌아온 1단계의 행 상태 알약. 한 계열이 전 상태를 갖는다 — 색만으로 읽히면 안 된다. */
export const rowDiffPill: Record<SduRowDiff, string> = {
  same: cn(pillBase, statusColors.pending.bg, statusColors.pending.textDark),
  changed: cn(pillBase, statusColors.info.bgLight, statusColors.info.textDark),
  added: cn(pillBase, statusColors.success.bg, statusColors.success.textDark),
  removed: cn(pillBase, statusColors.error.bg, statusColors.error.textDark),
};
