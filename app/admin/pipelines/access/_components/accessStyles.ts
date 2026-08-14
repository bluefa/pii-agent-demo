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
import { serviceSidebarStyles } from '@/lib/theme';

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
  /** 페이지 레벨 탭 레일 — 카드 안이 아니라 화면 자체를 가르는 자리라 음수 마진이 없다. */
  pageTabStrip: 'mt-5 flex items-center gap-1 border-b border-[var(--pl-border)]',
  /** 화면을 가르는 탭은 카드 안의 탭보다 한 칸 크다 — 이게 이 화면의 목차다. */
  tabLg: 'text-[16px]',

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

  /** 이력 피드 — 열이 아니라 줄로 읽는 기록.
   *
   *  전체 이력은 사실이 일곱이다(구분·서비스·코드·대상·수행자·사유·일시). 전체 폭에서는
   *  표가 맞지만 요청 카드와 나란히 서면 고정 폭만 364px 이라 늘어나는 네 열에 38px 씩
   *  밖에 안 남는다. 열을 지워 사실을 버리는 대신 한 행을 줄로 편다 — 훑는 표가 아니라
   *  읽는 기록이 되고, 사실은 하나도 안 빠진다. */
  feedRow: 'flex flex-col gap-1 border-t border-[var(--pl-border)] py-2.5',
  /** 윗줄 — 무슨 일이(pill) 어느 서비스에(이름·코드), 언제(오른쪽 끝). */
  feedHead: 'flex items-center gap-2',
  /** 이름과 코드는 붙는다 — `svcIdent` 와 같은 이유다. 남는 폭은 이 덩어리가 먹고,
   *  그래야 코드가 일시 옆이 아니라 이름 옆에 선다. */
  feedIdent: 'flex min-w-0 flex-1 items-center gap-1.5',
  feedSvc: 'min-w-0 truncate text-[14px] font-medium text-[var(--pl-text-strong)]',
  feedWhen: 'flex-none text-[12px] tabular-nums text-[var(--pl-text-weak)]',
  /** 아랫줄 — 누구에게·누가. 라벨을 붙인다: "haneul.kang ← admin.pass" 는 화살표
   *  방향을 이미 아는 사람만 읽을 수 있다. */
  feedFacts: 'flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]',
  feedLabel: 'mr-1.5 text-[12px] font-medium text-[var(--pl-text-weak)]',
  feedWho: 'font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  /** 사유 — 있을 때만 그린다. 없는 값에 '—' 를 찍으면 줄만 늘고 뜻은 안 는다.
   *  그래서 반려처럼 할 말이 있는 행만 세 줄이 되고, 그게 읽을 행을 먼저 보이게 한다. */
  feedNote: 'min-w-0 truncate text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',

  /** 이력 구역이 쓰는 폭 — 전체 폭 탭으로 옮겨 와도 줄은 넓어지지 않는다.
   *  줄로 읽는 기록에 1376px 을 주면 `svcRow` 가 640 으로 묶은 것과 같은 죽은 폭이
   *  생긴다(폭이 넓다고 사실이 늘지는 않는다). 사실 일곱이 다시 열로 설 값어치가
   *  있는지는 별개 결정이라 여기서는 폭만 묶는다. */
  feedColumn: 'max-w-[880px]',

  /**
   * 승인 워크벤치 — 왼쪽 대기 목록, 오른쪽 고른 요청 하나.
   *
   * 바닥이 `serviceSidebarStyles.canvas`(#F4F4FB)인 것이 이 블록의 전부다. 흰 카드는
   * 이 제품의 기본 바닥(#F9FAFB) 위에서 ΔE00 1.20 — JND 아래라 테두리 혼자 버티고,
   * 그게 "흰 바탕에 흰 카드"의 실제 정체다. 같은 흰 면이 캔버스 위에서는 4.12 로
   * 읽힌다(theme.ts `serviceSidebarStyles.canvas` 주석에 측정값이 있다). 카드를 덜
   * 희게 만들 수 없으면 바닥을 내린다.
   */
  /* 높이는 뷰포트까지 — 워크벤치는 카드가 아니라 이 화면의 작업면이다. 내용 높이에
   * 맡기면 사유가 짧은 날엔 화면 아래 200px 이 그냥 비고, 그러면 다시 "떠 있는 카드"로
   * 읽힌다. 282 = 상단 내비 64 + main 상단 여백 24 + 제목·판정 문장·탭 146 + 바닥 48
   * (서비스별 권한 split 이 같은 방식으로 높이를 잡는다). */
  bench: `mt-4 grid min-h-[calc(100vh-282px)] grid-cols-[320px_1fr] overflow-hidden rounded-[12px] ${serviceSidebarStyles.canvas}`,
  /** 목록은 헤어라인이 아니라 간격으로 끊는다 — 그래야 표가 아니라 요청 더미로 읽힌다. */
  benchList: 'flex flex-col p-2.5',
  benchRows: 'flex flex-col gap-1.5',
  benchFooter: 'mt-auto pt-2',
  /** 시트 머리의 40px 타일. `serviceSidebarStyles.tile` 에 크기를 덧씌우지 않고 따로
   *  선언한다 — `cn` 은 단순 join 이라 h-7 과 h-10 을 같이 주면 Tailwind 출력 순서가
   *  이긴다. 색만 `serviceTileClass` 에서 가져온다. */
  benchTile:
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] text-[16px] font-semibold leading-none',
  /** 목록 자리의 스켈레톤 조각 — `skeletonBar` 는 h-3.5 라 타일 자리에 못 쓴다(같은 이유). */
  benchSkelTile: 'h-7 w-7 flex-none animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  benchItem:
    'flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border bg-[var(--pl-bg-card)] px-2.5 py-2 text-left transition-colors',
  benchItemIdle: 'border-[var(--pl-border)] hover:border-[var(--pl-border-strong)]',
  /** 고른 항목은 테두리와 안쪽 막대 둘 다 — 테두리만으로는 캔버스 위에서 약하다. */
  benchItemActive:
    'border-[var(--pl-primary)] shadow-[inset_3px_0_0_var(--pl-primary)] bg-[var(--pl-primary-bg)]',
  benchItemStack: 'flex min-w-0 flex-1 flex-col',
  benchItemName: 'truncate text-[14px] font-semibold text-[var(--pl-text-strong)]',
  benchItemNameActive: 'truncate text-[14px] font-semibold text-[var(--pl-primary)]',
  benchItemWho: 'truncate text-[12px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  /** 대기 경과 — 기록이 못 하는 말이라 큐만 쓴다. 임계를 넘으면 잉크가 바뀐다. */
  benchWait:
    'flex-none rounded-full bg-[var(--pl-gray-100)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]',
  benchWaitHot: 'flex-none rounded-full bg-[var(--pl-warn-bg)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-warn-text)]',
  /** 오른쪽 시트 — 왼쪽 여백이 없다. 목록과 시트 사이는 캔버스가 직접 만든다. */
  benchPane:
    'm-2.5 ml-0 overflow-y-auto rounded-[9px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-5',
  benchHead: 'flex items-start gap-3',
  benchTitle:
    'mt-0.5 text-[20px] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 사실은 나열 문장이 아니라 격자로 — 라벨과 값이 같은 x 에 서야 훑힌다. */
  benchGrid: 'grid grid-cols-2 gap-x-8 gap-y-4',
  benchKey: 'text-[12px] font-medium text-[var(--pl-text-weak)]',
  benchVal: 'mt-0.5 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  benchRule: 'my-4 border-t border-[var(--pl-border)]',
  benchLabel: 'mb-1.5 text-[12px] font-semibold text-[var(--pl-text-weak)]',
  /** 결정은 구석의 버튼 두 개가 아니라 자기 자리를 가진 블록이다. */
  benchDecide: 'rounded-[9px] bg-[var(--pl-gray-50)] p-4',
  benchDecideTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  benchDecideDesc: 'mt-0.5 text-[12px] text-[var(--pl-text-weak)]',
  benchDecideActions: 'mt-3 flex gap-2',

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
