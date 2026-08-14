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
  badge:
    'inline-flex flex-none items-center rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums',
  desc: 'mt-1.5 text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',
  /** 제목 줄 우측 액션(사용자 추가 등) — 배지 자리를 대신 쓴다. */
  headAction: 'flex flex-none items-center gap-2',

  /** 목록 조작(검색) — 설명과 목록 사이. 컬럼 머리가 없는 카드에서는 이 여백이
   *  목록의 첫 경계선을 검색창에서 떼어 놓는 유일한 것이다. */
  search: 'mt-3 mb-2',

  /** 탭 레일 — 한 카드 안에서 목록 둘을 가른다(운영 화면의 line tab 과 같은 문법).
   *
   *  카드 패딩(p-4) 밖으로 빼내 밑줄이 카드 양 끝까지 닿게 한다. 레일이 본문보다
   *  좁으면 탭이 카드 위에 얹힌 또 하나의 부품처럼 보이고, 그러면 표면을 하나로
   *  줄이려고 합친 의미가 없어진다. */
  tabStrip: '-mx-4 -mt-1 mb-1 flex items-center gap-1 border-b border-[var(--pl-border)] px-4',
  tab: 'flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] transition-colors -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)]',
  tabIdle:
    'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-strong)] hover:border-[var(--pl-border-strong)]',
  /** 탭이 세는 수 — 탭이 곧 제목이므로 건수 배지도 여기로 온다(카드 머리엔 없다). */
  tabCount: 'text-[12px] font-semibold tabular-nums',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-weak)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',
  /** 서비스 패널 행 — 타일 · 이름 · 코드 태그. `/services` 레일과 같은 문법을 카드
   *  안에서 쓴다(폭·색·타일 해시는 `serviceListStyles` 에서 그대로 온다). 서비스는
   *  이 제품 어디서나 같은 모양으로 읽혀야 하므로 여기서 다시 그리지 않는다.
   *  gap 은 레일의 2.5, py 는 28px 타일에 맞춘 값.
   *
   *  `max-w` 는 목록이 카드만큼 넓을 이유가 없어서다 — 1710px 화면에서 이름 칸이
   *  735px 인데 그 안에 든 글자는 41px 이었다(94% 가 빈 폭). 가장 긴 서비스명 실폭
   *  340 + 코드 태그 + 액션이 640 안에 들어가므로, 남는 폭은 열을 늘리는 대신
   *  오른쪽 여백으로 둔다. 폭이 넓다고 정보가 늘지는 않는다. */
  svcRow: 'flex max-w-[640px] items-center gap-2.5 border-t border-[var(--pl-border)] py-2',
  /** 목록과 같은 폭을 쓰는 것들(검색창) — 목록보다 넓으면 조작이 목록에서 떨어진다. */
  svcColumn: 'max-w-[640px]',
  /** 행 안의 두 단 — 윗단 이름·코드, 아랫단 설명. 등급이 카드 사이가 아니라 행 안에서
   *  생기는 자리다(Carbon structured list, NN/g "굵은 줄만 따라 읽기"). */
  svcStack: 'flex min-w-0 flex-1 flex-col gap-0.5',
  /** 이름과 코드는 붙는다(gap 6). 레일에서 코드가 오른쪽 끝에 서 있는 건 폭이 좁아
   *  코드들을 한 x 에 맞추려는 것이고, 여기선 반대가 필요하다 — 사이가 벌어지면
   *  이름과 코드가 한 서비스의 두 표기가 아니라 두 열로 읽힌다. `self-start` 라야
   *  덩어리가 글자만큼만 넓어지고, 그래야 코드가 이름을 따라온다. */
  svcIdent: 'flex min-w-0 max-w-full items-center gap-1.5 self-start',
  /** 설명 줄 — 12/weak. 같은 2단 문법을 쓰는 연동 요청 행의 설명 열과 같은 급이다. */
  svcDesc: 'min-w-0 truncate text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',
  /** 행 끝 액션 셀 — "권한 요청"이 줄바꿈 없이 들어가는 폭. */
  svcAction: 'w-[68px] flex-none text-right',
  /** 열이 있는 표(내 요청 내역) 안의 서비스 셀 — `svcRow` 와 같은 타일·이름·코드를
   *  한 칸 안에 담는다. 같은 서비스가 탭 하나 건너 다른 모양으로 보이면 같은 것으로
   *  읽히지 않는다. flex-[1.4] 는 사유 두 열보다 조금 넓게 두려는 것(타일이 먼저 폭을
   *  가져가서, 1 이면 이름이 사유보다 먼저 잘린다). */
  svcCell: 'flex min-w-0 flex-[1.4] items-center gap-2.5',
  /** 행마다 반복되는 행위는 글자로 쓴다.
   *
   *  면을 가진 CTA 로 두면 한 장에 파란 버튼이 다섯 개가 되고, 다섯 개가 되면 강조가
   *  아니라 배경이 된다. 목록에서 고르는 일 자체가 이미 이 화면의 행동이라 버튼이
   *  그 사실을 한 번 더 말할 필요가 없다. */
  svcLink:
    'cursor-pointer whitespace-nowrap text-[14px] font-medium text-[var(--pl-primary)] underline-offset-2 transition-colors hover:text-[var(--pl-primary-hover)] hover:underline',

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
  /** 사유 열 — 자르지 않고 접는다. 문장이라 잘라 놓으면 있으나 마나이고, 내 요청
   *  내역은 훑는 표가 아니라 읽는 기록이다(행 높이는 행마다 달라도 된다). */
  reason: 'min-w-0 flex-1 whitespace-pre-wrap break-words',
  status: 'w-[96px] min-w-0 shrink truncate',
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
  /** 검색이 실패했을 때 — 빈 결과와 같은 자리지만 재시도가 붙어 가로로 놓인다. */
  pickerError:
    'flex items-center justify-center gap-2 px-3 py-8 text-center text-[14px] text-[var(--pl-text-weak)]',
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
