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

/** 캔버스 위에 서는 카드 한 장의 면 — 세로 정렬만 갈린다(`svcRow` / `svcRowTop`). */
const CARD_FACE =
  'gap-2.5 rounded-[9px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-3 py-2.5';

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
  /**
   * 요청자 화면(내 권한 요청)의 카드 더미 — 헤어라인이 아니라 간격으로 끊는다.
   * 표가 아니라 요청할 것들의 더미로 읽히게 하는 것이 목적이다.
   *
   * 승인 워크벤치처럼 캔버스 면을 따로 깔지 **않는다**. `/access-requests` 는
   * `/admin/**` 밖이라 어드민 셸(`--pl-bg-page` #F9FAFB)을 안 쓰고 body 의 캔버스
   * (#F4F4FB)를 그대로 물려받는다 — 바닥이 이미 내려가 있어서 흰 카드가 4.12 로
   * 읽힌다. 여기에 캔버스를 한 겹 더 깔면 같은 색을 같은 색 위에 얹는 것이라 표면만
   * 하나 는다(브라우저 실측 2026-08-14).
   */
  deckRows: 'flex flex-col gap-1.5',
  /** 서비스 한 건의 카드 — 타일 · 이름 · 코드 태그. `/services` 레일과 같은 문법이라
   *  서비스는 이 제품 어디서나 같은 모양으로 읽힌다(색·타일 해시는 `serviceListStyles`
   *  에서 그대로 온다). gap 은 레일의 2.5.
   *
   *  폭은 카드가 아니라 화면이 잡는다 — 레이아웃 열이 곧 이 목록의 폭이다. 예전에는
   *  여기서 640 으로 묶었는데, 그러면 1000 열 안의 828 카드 안에 640 목록이 되어
   *  폭이 세 겹이었다. */
  svcRow: `flex items-center ${CARD_FACE}`,
  /** 둘째 단이 접히는 카드(내 요청 사유) — 타일이 이름 줄과 맞도록 위 정렬. `cn` 으로
   *  items-center 를 덧씌우지 않고 따로 선언한다 — 단순 join 이라 출력 순서가 이긴다. */
  svcRowTop: `flex items-start ${CARD_FACE}`,
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
  /** 카드 안의 서비스 칸 — 타일 · [이름 코드] · 둘째 단을 한 덩어리로 담는다. 같은
   *  서비스가 탭 하나 건너 다른 모양으로 보이면 같은 것으로 읽히지 않는다. */
  svcCell: 'flex min-w-0 flex-1 items-center gap-2.5',
  svcCellTop: 'flex min-w-0 flex-1 items-start gap-2.5',
  /** 행마다 반복되는 행위는 글자로 쓴다.
   *
   *  면을 가진 CTA 로 두면 한 장에 파란 버튼이 다섯 개가 되고, 다섯 개가 되면 강조가
   *  아니라 배경이 된다. 목록에서 고르는 일 자체가 이미 이 화면의 행동이라 버튼이
   *  그 사실을 한 번 더 말할 필요가 없다. */
  svcLink:
    'cursor-pointer whitespace-nowrap text-[14px] font-medium text-[var(--pl-primary)] underline-offset-2 transition-colors hover:text-[var(--pl-primary-hover)] hover:underline',
  /** 내 요청 카드의 꼬리 — 상태 · 요청 일시 · (반려면) 다시 요청. 서비스 카드의 액션
   *  칸과 같은 오른쪽 끝이라 탭을 옮겨도 눌 자리가 그대로다. */
  reqTail: 'flex flex-none items-center gap-3',
  reqWhen: 'text-[12px] tabular-nums text-[var(--pl-text-weak)]',
  /** 내가 쓴 요청 사유 — 자르지 않고 접는다. 문장이라 잘라 놓으면 있으나 마나다. */
  reqReason: 'whitespace-pre-wrap break-words text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',

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
  /** 서비스 열 — 이름과 코드가 한 칸 안에서 붙어 선다(`svcIdent` 와 같은 이유: 사이가
   *  벌어지면 한 서비스의 두 표기가 아니라 두 열로 읽힌다). */
  svcCol: 'flex min-w-0 flex-[1.4] items-center gap-1.5',
  /** 사유 열 — 문장이라 한 칸을 더 받는다. `note` 와 달리 포인터를 죽이지 않는다:
   *  행이 링크가 아니라 가릴 오버레이가 없고, 죽이면 잘린 전문을 줄 title 도 안 뜬다. */
  noteWide: 'min-w-0 flex-[1.6] truncate',
  /** 사유 열 — 자르지 않고 접는다. 문장이라 잘라 놓으면 있으나 마나이고, 내 요청
   *  내역은 훑는 표가 아니라 읽는 기록이다(행 높이는 행마다 달라도 된다). */
  reason: 'min-w-0 flex-1 whitespace-pre-wrap break-words',
  status: 'w-[96px] min-w-0 shrink truncate',
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  /** 행 끝 액션 셀 — 해제/회수 버튼이 들어간다. */
  tail: 'w-[56px] flex-none text-right',
  chev: 'w-3.5 flex-none text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',

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
  /** 목록은 헤어라인이 아니라 간격으로 끊는다 — 그래야 표가 아니라 요청 더미로 읽힌다.
   *  캔버스 여백은 26px 다(오너 지시 2026-08-14: 10 → 16 → 26). 10px 이던 때는 카드가
   *  바닥에 얹힌 게 아니라 바닥을 꽉 채운 것처럼 보였다. 시트 쪽 `m-[26px]` 와 같은
   *  값이라야 네 변이 같고, 레일과 시트 사이도 여기 오른쪽 패딩이 혼자 만든다. */
  benchList: 'flex flex-col p-[26px]',
  benchRows: 'flex flex-col gap-1.5',
  benchFooter: 'mt-auto pt-2',
  /** 목록 자리의 스켈레톤 조각 — `skeletonBar` 는 h-3.5 라 타일 자리에 못 쓴다
   *  (`cn` 은 단순 join 이라 h-3.5 와 h-7 을 같이 주면 Tailwind 출력 순서가 이긴다). */
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
  benchWaitHot:
    'flex-none rounded-full bg-[var(--pl-warn-bg)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-warn-text)]',
  /** 오른쪽 시트 — 왼쪽 여백이 없다. 목록과 시트 사이는 캔버스가 직접 만든다. */
  benchPane:
    'm-[26px] ml-0 overflow-y-auto rounded-[9px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-6',
  benchHead: 'flex items-start gap-3',
  /** 시트의 주어는 서비스가 아니라 **요청**이다 — 서비스 이름을 제목으로 쓰면 이 시트가
   *  서비스 상세로 읽히고, 결정할 것(승인·반려)이 무엇에 대한 결정인지 제목이 말하지
   *  않는다(오너 지시 2026-08-14). 서비스는 아래 사실 격자의 한 칸으로 내려간다. */
  benchTitle: 'text-[20px] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 사실은 나열 문장이 아니라 격자로 — 라벨과 값이 같은 x 에 서야 훑힌다.
   *  머리 바로 밑에 붙는다(20px): 요청자는 이 시트의 첫 사실이지 한 구역 아래가 아니다.
   *
   *  셋이 한 행이다(오너 지시 2026-08-14) — 2열이면 요청 일시 혼자 둘째 줄로 내려가
   *  같은 급의 사실이 두 덩어리로 갈리고, 오른쪽 절반은 그대로 빈다. */
  benchGrid: 'mt-5 grid grid-cols-3 gap-x-8',
  benchKey: 'text-[12px] font-medium text-[var(--pl-text-weak)]',
  benchVal: 'mt-0.5 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  /** 서비스 코드 라벨 — 면이 아니라 선으로 만든다(오너 지시 2026-08-14). 이 시트엔 회색
   *  면이 이미 둘(사유 인용·승인 결정)이라 코드까지 면을 가지면 표면만 늘고, 이름 옆에
   *  붙는 짧은 식별자에는 테두리만으로 라벨이라는 게 충분히 읽힌다. */
  codeTag:
    'inline-flex flex-none items-center rounded-[5px] border border-[var(--pl-border-strong)] px-1.5 text-[12px] font-medium leading-[18px] text-[var(--pl-text-medium)]',
  /** 구역 사이는 선이 아니라 간격이다(오너 지시 2026-08-14). 시트 하나에 구역이 셋인데
   *  선을 그으면 한 장이 카드 셋으로 갈라지고, 폭도 안 바뀌는 선이라 나누는 일 말고는
   *  하는 게 없다. 24px 이면 구역 안(4~8px)과 충분히 갈린다. */
  benchSection: 'mt-6',
  /** 시트 안 구역의 머리 — 승인 결정 블록의 제목과 같은 급이다(14/semibold/strong).
   *  12px weak 이던 때는 라벨이 자기가 이끄는 본문보다 작고 옅어서 구역이 안 보였다. */
  benchLabel: 'mb-2 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  /** 구역 머리에 딸린 사실(누가·언제) — 머리는 강해지되 꼬리는 따라 강해지지 않는다. */
  benchLabelMeta: 'ml-2 text-[12px] font-medium text-[var(--pl-text-weak)]',
  /** 결정은 시트의 마지막 구역이다 — 회색 면은 없다(오너 지시 2026-08-14). 자기 면을
   *  가진 블록이던 때는 시트에 카드가 한 겹 더 있는 셈이었고, 사유 인용까지 치면 회색
   *  면이 둘이라 어느 쪽이 읽을 것이고 어느 쪽이 할 것인지 면이 구분해 주지 못했다.
   *  구역 제목은 `benchLabel` 을 함께 쓴다 — 요청 사유와 같은 급이다. */
  benchDecideDesc: 'text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',
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
  /** 요청자가 한 말 — 파란 면에 담는다(오너 지시 2026-08-14). 회색 `quote` 는 처리
   *  결과처럼 **우리가** 남긴 말의 자리로 남는다: 두 인용이 같은 회색이면 누구 말인지
   *  면이 구분해 주지 못하고, 승인 화면에서 읽어야 할 쪽은 요청자 쪽이다. */
  quoteAsk:
    'whitespace-pre-wrap rounded-[8px] bg-[var(--pl-primary-bg)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--pl-text-medium)]',
} as const;
