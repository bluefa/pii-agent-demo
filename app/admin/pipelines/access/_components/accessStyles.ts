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
  /** 판정 수치 — 연동 요청(queue/requests)의 `contextTotal` 과 같은 크기. 화면에서
   *  가장 큰 타입이 곧 화면이 먼저 말하는 사실이고, 이 페이지의 그 사실은 "내 요청이
   *  지금 어떤 상태인가"다.
   *
   *  색은 여기 없다 — 세는 대상에 따라 갈린다. queue/requests 는 언제나 "확인이 필요한
   *  건"이라 primary 한 색으로 충분하지만, 이 수치는 반려일 수도 승인일 수도 있다.
   *  반려 건수를 파랑으로 쓰면 수치와 문장이 서로 다른 말을 한다. */
  pageTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none',
  /** 판정 수치의 색 — 표 안의 상태 pill 과 같은 잉크를 쓴다. */
  pageTotalTone: {
    REJECTED: 'text-[var(--pl-err-text)]',
    PENDING: 'text-[var(--pl-warn-text)]',
    APPROVED: 'text-[var(--pl-ok-text)]',
  },
  /** 판정 문장이 다루지 않은 나머지 상태 — 문장이 말한 수는 여기 다시 쓰지 않는다. */
  pageMeta: 'mt-2 flex items-center gap-4 text-[14px] text-[var(--pl-text-weak)]',
  pageMetaVal: 'font-semibold text-[var(--pl-text-medium)]',
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
  /** 바닥에 직접 놓인 기록 구역의 제목 — 면을 가진 카드보다 한 단 아래여야 순위가
   *  생긴다. 이 한 칸이 없으면 카드와 기록이 같은 18/600 으로 "둘 다 1등"이 된다. */
  titleQuiet: 'text-[14px] font-semibold leading-[1.5] text-[var(--pl-text-medium)]',
  badge:
    'inline-flex flex-none items-center rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums',
  desc: 'mt-1.5 text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',
  /** 제목 줄 우측 액션(사용자 추가 등) — 배지 자리를 대신 쓴다. */
  headAction: 'flex flex-none items-center gap-2',

  /** 목록 조작(검색) — 설명과 목록 사이. 컬럼 머리가 없는 카드에서는 이 여백이
   *  목록의 첫 경계선을 검색창에서 떼어 놓는 유일한 것이다. */
  search: 'mt-3 mb-2',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-weak)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',
  /** 서비스 패널 행 — 타일 · 이름 · 코드 태그. `/services` 레일과 같은 문법을 카드
   *  안에서 쓴다(폭·색·타일 해시는 `serviceListStyles` 에서 그대로 온다). 서비스는
   *  이 제품 어디서나 같은 모양으로 읽혀야 하므로 여기서 다시 그리지 않는다.
   *  gap 은 레일의 2.5, py 는 28px 타일에 맞춘 값. */
  svcRow: 'flex items-center gap-2.5 border-t border-[var(--pl-border)] py-2',
  /** 서비스 행은 2열로 흐른다 — 1200px 폭에서 한 행이 594px 이라 타일·이름·코드·버튼에
   *  적정하고, 한 장에 10개가 들어와 검색 없이도 훑을 수 있다. */
  svcGrid: 'grid grid-cols-2 gap-x-6',
  /** 행 끝 CTA 셀 — "권한 요청"(12px/600, sm 패딩 10)이 줄바꿈 없이 들어가는 폭. */
  svcAction: 'w-[84px] flex-none text-right',

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
