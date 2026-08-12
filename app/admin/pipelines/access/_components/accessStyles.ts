/**
 * 접근 권한 화면들의 로컬 스타일 토큰.
 *
 * 카드 문법은 연동 요청 목록(queue/requests)의 것을 그대로 따른다 — 제목 + 건수
 * 배지, 한 줄 설명, 고정 높이 본문, 카드 바닥에 고정된 페이저. 같은 어드민 안에서
 * 승인 화면이 두 종류로 읽히면 안 된다.
 *
 * 레일은 스타일을 새로 만들지 않고 `serviceListStyles` 를 그대로 가져다 쓴다
 * (서비스·대상 검색과 같은 부품). 여기서 다시 선언하면 두 화면이 조용히 갈라진다.
 */
export const accessStyles = {
  pageTitle: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  pageDesc: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  grid: 'mt-6 grid grid-cols-2 gap-6',

  /** 카드 — min-h 로 2단에 나란히 선 카드가 담긴 양과 무관하게 같은 높이를 지킨다. */
  card: 'flex min-h-[360px] flex-col rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] p-4 shadow-[var(--pl-shadow-md)]',
  /** 크롬 없는 같은 카드 — 이미 시트 한 장 위에 있을 때. 시트 위에 또 카드를 얹으면
   *  표면이 두 겹이 되고, 그러면 한 화면이 여러 섬으로 갈라진다. */
  section: 'flex flex-col',
  head: 'flex items-center justify-between gap-3',
  titleWrap: 'flex items-center gap-2',
  titleIcon: 'text-[var(--pl-text-medium)]',
  title: 'text-[18px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  badge:
    'inline-flex flex-none items-center rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums',
  desc: 'mt-1.5 text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',
  /** 제목 줄 우측 액션(사용자 추가 등) — 배지 자리를 대신 쓴다. */
  headAction: 'flex flex-none items-center gap-2',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-weak)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',

  /** 컬럼 폭 — 같은 골격을 쓰는 카드끼리 격자 간격 너머로 열이 맞도록 공유한다. */
  name: 'min-w-0 flex-1 truncate',
  nameStrong: 'font-medium text-[var(--pl-text-strong)]',
  /** 이메일도 늘어나는 열이다 — 한 열만 flex-1 이면 그 열이 남는 폭을 전부 먹고
   *  나머지는 고정 폭 안에서 잘린다. 둘로 나눠야 실제 값 길이에 맞게 갈린다. */
  email: 'min-w-0 flex-1 truncate text-[var(--pl-text-weak)]',
  /** Knox ID — 사람 이름이 아니라 식별자다. 서비스 코드와 같이 mono 로 찍는다. */
  knox:
    'min-w-0 flex-1 truncate font-medium text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  code: 'w-[72px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  note: 'min-w-0 flex-1 truncate pointer-events-none',
  path: 'w-[84px] min-w-0 shrink truncate',
  status: 'w-[96px] min-w-0 shrink truncate',
  actor: 'w-[92px] min-w-0 shrink truncate',
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  /** 행 끝 액션 셀 — 해제/회수 버튼이 들어간다. */
  tail: 'w-[56px] flex-none text-right',
  chev: 'w-3.5 flex-none text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',

  skeletonBar: 'h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  state: 'flex items-center gap-2 py-2.5 text-[14px] text-[var(--pl-text-weak)]',
  empty: 'flex flex-col items-center justify-center gap-0.5 py-9 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyCaption: 'text-[12px] text-[var(--pl-text-weak)]',
  footer: 'mt-auto',

  /** 서비스별 권한 시트 안의 정체 블록 — 서비스·대상 검색의 것과 같은 문법. */
  identity: 'flex flex-col gap-4',
  eyebrow: 'text-[14px] font-medium text-[var(--pl-text-weak)]',
  titleRow: 'flex items-center gap-3 flex-wrap',
  svcTitle:
    'text-[26px] font-extrabold tracking-[-0.03em] leading-[1.2] text-[var(--pl-text-strong)]',
  svcCodeChip:
    'inline-flex items-center gap-1.5 rounded-full bg-[var(--pl-gray-100)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pl-text-medium)]',
  svcCodeChipLabel: 'font-medium text-[var(--pl-text-weak)]',
  statRow: 'flex items-center gap-10',
  stat: 'flex flex-col gap-1.5',
  statLabel: 'text-[12px] font-medium text-[var(--pl-text-weak)]',
  statVal: 'text-[18px] font-semibold text-[var(--pl-text-strong)] tabular-nums',

  /** 모달 안 사용자 피커. */
  pickerSearch: 'mb-3',
  pickerList:
    'max-h-[280px] overflow-y-auto rounded-[8px] border border-[var(--pl-border)] divide-y divide-[var(--pl-border)]',
  pickerRow:
    'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--pl-gray-50)]',
  /** 피커의 사람 — Knox ID 다(이름은 계약에 없다). 식별자라 mono. */
  pickerName:
    'flex-1 min-w-0 truncate text-[14px] font-medium text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  pickerEmail: 'w-[180px] min-w-0 truncate text-[12px] text-[var(--pl-text-weak)]',
  pickerEmpty: 'px-3 py-8 text-center text-[14px] text-[var(--pl-text-weak)]',
  pickerCount: 'mt-3 text-[12px] font-medium text-[var(--pl-text-weak)]',
  /** 체크박스 — accent-color 로 primary 를 입힌다(커스텀 SVG 없이). */
  checkbox: 'h-4 w-4 flex-none accent-[var(--pl-primary)]',

  /** 확인 모달 본문의 한 줄 사실. */
  factRow: 'flex items-center gap-2 py-1.5 text-[14px] text-[var(--pl-text-medium)]',
  factLabel: 'w-[84px] flex-none text-[12px] font-medium text-[var(--pl-text-weak)]',
  /** 요청 사유·반려 사유 전문 — 접힘 없이 그대로 읽는 자리. */
  quote:
    'whitespace-pre-wrap rounded-[8px] bg-[var(--pl-gray-50)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--pl-text-medium)]',
} as const;
