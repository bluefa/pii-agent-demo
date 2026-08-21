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

/** 승인 시트의 사실 격자 — 요청 반쪽과 처리 반쪽이 같은 열에 서야 요청자↔처리자,
 *  요청 일시↔처리 일시가 세로로 짝지어 읽힌다. 위 여백만 둘이 다르다. */
const BENCH_GRID = 'grid grid-cols-3 gap-x-8';

/** 표의 행이 공유하는 것 — 세로 정렬·여백·구분선만 갈린다(`row`/`rowMid`/`rowTop`).
 *  셋을 각각 완결로 선언하는 이유는 `cn` 이 단순 join 이라서다: 기본 위에 items-* 나
 *  py-* 를 덧씌우면 이기는 쪽은 호출 순서가 아니라 Tailwind 출력 순서다. */
const ROW = 'flex gap-3 text-[14px] text-[var(--pl-text-medium)] transition-colors';

export const accessStyles = {
  pageTitle: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  pageDesc: 'mt-1 text-[16px] leading-[1.4] text-[var(--pl-text-weak)]',
  /** 판정 수치 — 연동 요청(queue/requests)의 `contextTotal` 과 같은 크기. 화면에서
   *  가장 큰 타입이 곧 화면이 먼저 말하는 사실이다. 승인 워크벤치가 쓴다(요청자 화면은
   *  2026-08-17 에 판정 문장을 걷어 내면서 `pageMeta` 한 줄만 남겼다).
   *
   *  색은 여기 없다 — 세는 대상에 따라 갈린다. */
  pageTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none',
  /** 판정 수치의 색. 대기만 파랑이다(오너 지시 2026-08-14) — 대기는 나쁜 소식이 아니라
   *  **할 일**이고, 주황은 늦었다는 뜻이라 0건이든 6건이든 늘 경고처럼 읽혔다.
   *
   *  세는 자리가 하나 남아서(승인 대기) 값도 하나다. 반려·승인 잉크는 요청자 화면이
   *  판정 문장을 건수 줄로 바꾸면서 쓸 자리가 없어졌다. */
  pageTotalTone: 'text-[var(--pl-primary)]',
  /** 상태별 건수 줄 — 요청자 화면이 먼저 말하는 사실 전부다(오너 지시 2026-08-17).
   *
   *  판정 문장이 사라지면서 이 줄이 그 자리를 물려받았다. 그래서 라벨이 14 → 16 이다:
   *  제목 밑에서 화면을 대신 여는 줄이 본문보다 작을 이유가 없다. */
  pageMeta: 'mt-2 flex items-baseline gap-4 text-[16px] text-[var(--pl-text-weak)]',
  /** 그 줄의 수 — 20(오너 지시 2026-08-17). 라벨보다 한 급 위라 훑을 때 수가 먼저 잡히고,
   *  잉크도 한 단 진하다. 정렬은 `items-baseline` 이 잡는다 — 크기가 다른 둘을 가운데로
   *  맞추면 숫자가 라벨보다 살짝 떠 보인다. */
  pageMetaVal: 'text-[20px] font-semibold tabular-nums text-[var(--pl-text-medium)]',

  /** 카드 — min-h 로 담긴 양과 무관하게 같은 높이를 지킨다. 나란히 선 카드 둘의 키를
   *  맞추려던 것이었는데 2단 배치는 없어졌고, 남은 이유가 더 자주 온다: 마지막 장은
   *  줄이 모자라고(5줄 표의 2장이 3줄) 그때마다 카드가 줄어들면 페이저가 위로 뛴다. */
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

  /** 컬럼 머리 — 값 행과 같은 14/medium 이다(오너 지시 2026-08-17). 12 였을 때는 한 표
   *  안에 12(머리)·12(코드)·14(이름) 세 급이 섞여서, 급이 뜻을 나누는 게 아니라 그냥
   *  들쭉날쭉했다. 크기와 굵기를 맞추고 나면 머리와 값을 가르는 건 잉크 하나다. */
  headRow: 'mt-3 flex items-center gap-3 py-2 text-[14px] font-medium text-[var(--pl-text-weak)]',
  row: `${ROW} items-center border-t border-[var(--pl-border)] py-2.5`,
  /** 구분선을 `tableBody` 가 긋는 표의 행 — 한 줄짜리 값들이라 가운데 정렬. 선이 없는
   *  것 말고는 `row` 와 같다(두 군데서 선을 그으면 줄이 겹쳐 두 배로 진해진다). */
  rowMid: `${ROW} items-center py-2.5`,
  /** 접히는 칸이 있는 표의 본문 — 구분선을 행이 아니라 **여기서** 긋는다(오너 지시
   *  2026-08-17, 리소스 표와 같은 문법: `tableStyles.body`).
   *
   *  행마다 `border-t` 를 주면 선이 행의 소유물이 되어 마지막 행 밑이 열린 채로 끝난다.
   *  `divide-y` 는 행과 행 **사이**에만 긋고, 위아래는 이 상자가 닫는다 — 그래야 다섯
   *  줄이 각자 자기 띠 안에 들어앉고, 두 줄짜리 사유가 아래 행 자리를 넘보지 않는다. */
  tableBody: 'divide-y divide-[var(--pl-border)] border-y border-[var(--pl-border)]',
  /** 그 표의 행 — 사유가 두 줄이 되면 나머지 칸은 첫 줄에 맞춰 선다. `cn` 으로
   *  items-start 를 덧씌우지 않고 따로 선언한다(단순 join 이라 출력 순서가 이긴다).
   *
   *  위아래 16px 은 리소스 표의 셀 값(`tableStyles.cell` 의 py-[16px])을 그대로 쓴다.
   *  10px 이던 때는 두 줄로 접힌 사유의 아랫줄이 구분선에 거의 닿아서, 선은 그어져 있는데
   *  글이 다음 띠로 넘어가는 것처럼 읽혔다. */
  rowTop: `${ROW} items-start py-4`,
  /** 행 끝 액션 셀 — "권한 요청"이 줄바꿈 없이 들어가는 폭. */
  svcAction: 'w-[68px] flex-none text-right',
  /** 서비스 행의 액션 셀 — 버튼 그룹 한 덩어리가 들어가는 폭. 두 서비스 탭이 같은 폭을
   *  쓴다: 접근 가능 탭은 이 자리가 비어 있는데, 그때만 좁히면 탭을 옮길 때마다 이름과
   *  코드가 이 폭만큼 튄다. */
  svcActionCell: 'flex w-[140px] flex-none justify-end',
  /** 행 끝 버튼 그룹 — 담당자 보기와 권한 요청을 한 덩어리로 묶는다(오너 지시 2026-08-17).
   *  둘 다 이 행 하나에 대한 행위라, 하나는 둘째 단의 글줄이고 하나는 오른쪽 끝 링크로
   *  떨어져 있으면 같은 서비스의 두 행위로 읽히지 않는다. 테두리 하나를 둘이 나눠 쓰고
   *  사이는 같은 선으로 가른다 — 면을 가진 CTA 를 둘씩 놓으면 한 장에 버튼이 열 개가 되고,
   *  그러면 강조가 아니라 배경이 된다. */
  svcActions:
    'inline-flex items-stretch divide-x divide-[var(--pl-border)] overflow-hidden rounded-[7px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)]',
  /** 그룹 안의 버튼. 세 잉크를 각각 **완결로** 선언한다 — `cn` 은 단순 join 이라 기본
   *  토큰 위에 색만 덧씌우면 Tailwind 출력 순서가 이긴다.
   *
   *  담당자가 없는 서비스는 누를 것이 없지만 그 사실을 감추지 않는다(신청해도 볼 사람이
   *  없다는 뜻이다) — 라벨을 바꿔 그대로 두고 `disabled:` 로 잉크만 내린다. */
  svcActionBtn:
    'cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-[12px] font-medium text-[var(--pl-text-medium)] transition-colors hover:bg-[var(--pl-gray-50)] hover:text-[var(--pl-text-strong)] disabled:cursor-default disabled:text-[var(--pl-text-weak)] disabled:hover:bg-[var(--pl-bg-card)] disabled:hover:text-[var(--pl-text-weak)]',
  /** 이 행의 본 행위 — 그룹 안에서 잉크로만 갈린다. */
  svcActionBtnGo:
    'cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-[12px] font-semibold text-[var(--pl-primary)] transition-colors hover:bg-[var(--pl-primary-bg)]',
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
  /** 코드 열 — 폭은 값이 아니라 **머리**가 잡는다. 값('azure')은 14 mono 로 44px 이지만
   *  머리가 '서비스 코드'(오너 지시 2026-08-17)라 14 에서 76px 이고, 72 였을 때는 머리만
   *  잘려 "서비스 코…"가 됐다. 열 이름이 잘리면 그 열이 무엇인지 말해 줄 것이 없다. */
  code: 'w-[88px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** 표 안의 코드 — 값 행이 한 급으로 읽히도록 이름과 같은 14/medium 을 쓴다(오너 지시
   *  2026-08-17). 식별자라는 것은 크기가 아니라 mono 가 말한다. */
  monoMd:
    'text-[14px] font-medium text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  note: 'min-w-0 flex-1 truncate pointer-events-none',
  /** 서비스 이름 열 — 코드는 왼쪽 `code` 열이 따로 받는다. 한 칸에 둘을 넣으면 코드가
   *  이름 길이만큼 밀려 행마다 다른 x 에 서고, 코드로 훑을 수가 없다. */
  svcCol: 'min-w-0 flex-[1.4] truncate',
  /** 사유 열 — 문장이라 한 칸을 더 받는다. `note` 와 달리 포인터를 죽이지 않는다:
   *  행이 링크가 아니라 가릴 오버레이가 없고, 죽이면 잘린 전문을 줄 title 도 안 뜬다. */
  noteWide: 'min-w-0 flex-[1.6] truncate',
  /** 사유 열 — 자르지 않고 접되 한 칸을 더 받는다(`noteWide` 와 같은 1.6). 문장이라
   *  잘라 놓으면 있으나 마나인데, 관리자 화면과 달리 요청자에게는 전문을 볼 상세 화면이
   *  없다 — 여기서 자르면 자기가 쓴 사유를 아무 데서도 다시 읽을 수 없다. 표 안에서도
   *  행 높이는 행마다 달라도 된다(`rowTop` 이 나머지 칸을 첫 줄에 맞춘다). */
  reason: 'min-w-0 flex-[1.6] whitespace-pre-wrap break-words',
  status: 'w-[96px] min-w-0 shrink truncate',
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  /** 행 끝 액션 셀 — 해제/회수 버튼이 들어간다. */
  tail: 'w-[56px] flex-none text-right',

  /**
   * 승인 워크벤치 — 왼쪽 대기 목록, 오른쪽 고른 요청 하나.
   *
   * 바닥이 `serviceSidebarStyles.canvas` 인 것이 이 블록의 전부다. 흰 카드는 이 제품의
   * 기본 바닥(`--pl-bg-page`) 위에서 ΔE00 1.20 — JND 아래라 테두리 혼자 버티고,
   * 그게 "흰 바탕에 흰 카드"의 실제 정체다. 같은 흰 면이 캔버스 위에서는 4.12 로
   * 읽힌다(theme.ts `serviceSidebarStyles.canvas` 주석에 측정값이 있다). 카드를 덜
   * 희게 만들 수 없으면 바닥을 내린다.
   */
  /* 높이는 뷰포트까지 — 워크벤치는 카드가 아니라 이 화면의 작업면이다. 내용 높이에
   * 맡기면 사유가 짧은 날엔 화면 아래 200px 이 그냥 비고, 그러면 다시 "떠 있는 카드"로
   * 읽힌다. 282 = 상단 내비 64 + main 상단 여백 24 + 제목·판정 문장·탭 146 + 바닥 48
   * (서비스별 권한 split 이 같은 방식으로 높이를 잡는다). */
  bench: `mt-4 grid min-h-[calc(100vh-282px)] grid-cols-[352px_1fr] overflow-hidden rounded-[12px] ${serviceSidebarStyles.canvas}`,
  /** 목록은 헤어라인이 아니라 간격으로 끊는다 — 그래야 표가 아니라 요청 더미로 읽힌다.
   *  캔버스 여백은 36px 다(오너 지시 2026-08-14: 10 → 16 → 26 → 36). 10px 이던 때는
   *  카드가 바닥에 얹힌 게 아니라 바닥을 꽉 채운 것처럼 보였다.
   *
   *  이 패딩이 곧 레일 카드의 여백이자 레일과 시트 사이의 간격이다 — 시트는 `ml-0` 이라
   *  둘 사이를 여기 오른쪽 패딩 혼자 만든다. 그래서 오른쪽·위·아래는 시트의 `m-9` 와
   *  같은 36 이고, 두 카드의 윗변도 같은 y 에 선다.
   *
   *  왼쪽만 20 이다(오너 지시 2026-08-14) — 왼쪽 여백은 캔버스 가장자리라 아무것도
   *  가르지 않는데, 그 폭이 곧 카드에서 빠지는 폭이다. 열도 320 → 352 라 카드는
   *  248 → 296 으로 넓어진다. */
  benchList: 'flex flex-col py-9 pl-5 pr-9',
  benchRows: 'flex flex-col gap-1.5',
  benchFooter: 'mt-auto pt-2',
  /** 목록 자리의 스켈레톤 조각 — `skeletonBar` 는 h-3.5 라 타일 자리에 못 쓴다
   *  (`cn` 은 단순 join 이라 h-3.5 와 h-7 을 같이 주면 Tailwind 출력 순서가 이긴다). */
  benchSkelTile: 'h-7 w-7 flex-none animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  benchItem:
    'flex w-full cursor-pointer items-center gap-3 rounded-[9px] border bg-[var(--pl-bg-card)] px-3.5 py-3 text-left transition-colors',
  benchItemIdle: 'border-[var(--pl-border)] hover:border-[var(--pl-border-strong)]',
  /** 고른 항목은 테두리와 안쪽 막대 둘 다 — 테두리만으로는 캔버스 위에서 약하다. */
  benchItemActive:
    'border-[var(--pl-primary)] shadow-[inset_3px_0_0_var(--pl-primary)] bg-[var(--pl-primary-bg)]',
  benchItemStack: 'flex min-w-0 flex-1 flex-col',
  /** 서비스 이름 16px — 이 카드에서 고르는 것은 서비스이고, 요청자·경과는 그걸 고르고
   *  나서 읽는 값이다(오너 지시 2026-08-14). 14px 이던 때는 셋이 거의 같은 급이었다. */
  benchItemName: 'truncate text-[16px] font-semibold text-[var(--pl-text-strong)]',
  benchItemNameActive: 'truncate text-[16px] font-semibold text-[var(--pl-primary)]',
  /** 아랫줄은 요청자의 이메일 — 시트가 요청자로 쓰는 값과 같은 값이라야 레일에서 고른
   *  사람과 시트가 보여주는 사람이 같다는 게 눈으로 확인된다. */
  benchItemWho: 'truncate text-[12px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  /** 대기 경과 — 기록이 못 하는 말이라 큐만 쓴다. 임계를 넘으면 잉크가 바뀐다. */
  benchWait:
    'flex-none rounded-full bg-[var(--pl-gray-100)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]',
  benchWaitHot:
    'flex-none rounded-full bg-[var(--pl-warn-bg)] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-warn-text)]',
  /** 오른쪽 시트 — 왼쪽 여백이 없다. 목록과 시트 사이는 레일의 오른쪽 패딩이 만든다.
   *
   *  바깥 36 · 안쪽 32 — 바닥이 카드를 두르는 폭보다 카드가 글을 두르는 폭이 좁다.
   *  둘이 같으면 내용이 면 한가운데 떠 있는 것처럼 보이고, 안쪽이 더 넓으면 이번엔 바닥이
   *  좁아 카드가 캔버스를 채운 것처럼 보인다. 한 칸 차이가 둘을 다 피한다. */
  benchPane:
    'm-9 ml-0 overflow-y-auto rounded-[9px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-8',
  benchHead: 'flex items-start gap-3',
  /** 시트의 주어는 서비스가 아니라 **요청**이다 — 서비스 이름을 제목으로 쓰면 이 시트가
   *  서비스 상세로 읽히고, 결정할 것(승인·반려)이 무엇에 대한 결정인지 제목이 말하지
   *  않는다(오너 지시 2026-08-14). 서비스는 아래 사실 격자의 한 칸으로 내려간다. */
  benchTitle:
    'text-[20px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 사실은 나열 문장이 아니라 격자로 — 라벨과 값이 같은 x 에 서야 훑힌다.
   *  머리 바로 밑에 붙는다(20px): 요청자는 이 시트의 첫 사실이지 한 구역 아래가 아니다.
   *
   *  셋이 한 행이다(오너 지시 2026-08-14) — 2열이면 요청 일시 혼자 둘째 줄로 내려가
   *  같은 급의 사실이 두 덩어리로 갈리고, 오른쪽 절반은 그대로 빈다. */
  benchGrid: `mt-5 ${BENCH_GRID}`,
  /** 처리 결과 묶음 — 사실 둘과 글 하나를 한 장에 담는다(오너 지시 2026-08-17). 간격만으로
   *  나누던 때는 처리자·처리 일시·반려 사유·본문이 시트 위에 그냥 네 줄로 쌓여서, 어디까지가
   *  처리 이야기인지 경계가 없었다.
   *
   *  면은 새로 늘지 않았다 — 회색 판이 인용에서 이 상자로 올라왔다(`benchGroupNote` 는 면을
   *  안 든다). 인용이 쓰던 gray-50 은 흰 시트 위에서 1.045:1 이라 이만한 상자로 키우면
   *  테두리만 보이고 면은 안 보인다. gray-100 은 1.102:1 이고, 그 위에서 제일 옅은 잉크인
   *  12px 키가 4.515:1 로 버틴다(흰 바닥에서 4.6, 워시가 먹는 건 0.09 뿐). */
  benchGroup: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-gray-100)] p-5',
  /** 묶음의 머리 — 상자 밖에 선다(오너 지시 2026-08-17). 안에 들어가면 제목도 상자가 담는
   *  내용 중 하나가 되지만, 밖에 서면 상자 전체를 가리킨다. 위 여백(36px)은 여기 있다:
   *  머리가 이 묶음의 첫 줄이라 요청 반쪽과의 간격도 머리 앞에서 벌어져야 한다.
   *
   *  16px 는 시트 제목(20)과 상자 안 라벨(14) 사이다 — 안에 든 '반려 사유' 와 같은 급이면
   *  묶음이 자기 부품 중 하나로 읽힌다. */
  benchGroupTitle: 'mt-9 mb-2 text-[16px] font-semibold text-[var(--pl-text-strong)]',
  /** 묶음 안의 사실 행 — 위 여백은 머리가 들고 있어서 열 트랙만 가져온다. */
  benchGroupGrid: BENCH_GRID,
  /** 묶음 안의 글 — 면이 없다. 상자가 이미 면이라 여기서 또 깔면 면 안에 면이다. */
  benchGroupNote: 'whitespace-pre-wrap text-[14px] leading-[1.6] text-[var(--pl-text-medium)]',
  benchKey: 'text-[12px] font-medium text-[var(--pl-text-weak)]',
  benchVal: 'mt-0.5 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  /** 서비스 코드 라벨 — 면이 아니라 선으로 만든다(오너 지시 2026-08-14). 이 시트엔 회색
   *  면이 이미 둘(사유 인용·승인 결정)이라 코드까지 면을 가지면 표면만 늘고, 이름 옆에
   *  붙는 짧은 식별자에는 테두리만으로 라벨이라는 게 충분히 읽힌다.
   *
   *  모달 머리의 서비스 줄도 이걸 쓴다(오너 지시 2026-08-21). 면이 없다는 게 거기서 더
   *  중요하다 — 담당자 모달은 바로 아래에 `ownerChip`(회색 면) 들이 깔려서, 코드가 같은
   *  면을 가지면 `CPN` 이 담당자 하나처럼 읽힌다. `align-middle` 은 12px 태그를 16px
   *  이름의 줄 한가운데 세운다(flex 부모인 승인 시트에서는 아무 일도 하지 않는다). */
  codeTag:
    'inline-flex flex-none items-center rounded-[5px] border border-[var(--pl-border-strong)] px-1.5 align-middle text-[12px] font-medium leading-[18px] text-[var(--pl-text-medium)]',
  /** 구역 사이는 선이 아니라 간격이다(오너 지시 2026-08-14). 시트 하나에 구역이 셋인데
   *  선을 그으면 한 장이 카드 셋으로 갈라지고, 폭도 안 바뀌는 선이라 나누는 일 말고는
   *  하는 게 없다. 24px 이면 구역 안(4~8px)과 충분히 갈린다. */
  benchSection: 'mt-6',
  /** 시트 안 구역의 머리 — 승인 결정 블록의 제목과 같은 급이다(14/semibold/strong).
   *  12px weak 이던 때는 라벨이 자기가 이끄는 본문보다 작고 옅어서 구역이 안 보였다. */
  benchLabel: 'mb-2 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  /** 결정은 시트의 마지막 구역이다 — 회색 면도, 제목도, 설명도 없다(오너 지시
   *  2026-08-14). 면을 가진 블록이던 때는 시트에 카드가 한 겹 더 있는 셈이었고, 제목은
   *  버튼 둘이 이미 말하며, 즉시 부여·사유 필수는 각 모달이 누를 때 말한다.
   *  위 간격은 `benchSection` 에서 온다 — 여기서 `mt-*` 를 또 주면 둘이 부딪친다. */
  benchDecideActions: 'flex gap-2',

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
  /**
   * 담당자 보기의 칩 흐름.
   *
   * 한 줄에 값이 하나뿐인 목록은 표가 아니다. 행으로 세웠을 때 638px 짜리 줄에 잉크가
   * 73px(88.5% 가 빈 폭)이었고, 나눌 열이 없는데 구분선만 다섯 줄 그어져 있었다.
   * 칩으로 흘리면 5명이 2줄, 20명이 4줄, 50명이 9줄에 선다 — 스크롤이 7명에서
   * 30명으로 밀린다.
   *
   * 캡은 항상 걸어 둔다(짧은 목록에는 아무 일도 하지 않는다). 잘린 인원 안내는 이
   * 상자 **밖**에 산다 — 목록이 불완전하다는 사실을 끝까지 스크롤해야 알게 되면
   * 안내가 아니다.
   */
  ownerFlow: 'flex flex-wrap gap-1.5 max-h-[280px] overflow-y-auto',
  /**
   * 칩 하나 = Knox ID 하나. 식별자라 mono 다(`pickerName` 과 같은 이유).
   *
   * 면은 `--pl-gray-100`(#F2F4F7) 이다. `--pl-gray-50` 은 흰 모달 바닥에서 ΔE00 1.20 —
   * 식별 한계 바로 위라 칩이 면으로 읽히지 않는다. gray-100 은 2.78 이고, 그 위의
   * `--pl-text-strong` 은 16.1:1 이다.
   *
   * 14px 인 건 이 모달의 본문이 이 칩들이어서다 — 크기는 짝수로만 간다(FONT-EVEN,
   * `.claude/hooks/post-edit-design.mjs`). 인원수(12px)는 아래 각주와 같은 급이다.
   */
  ownerChip:
    'inline-flex max-w-full items-center truncate rounded-[6px] bg-[var(--pl-gray-100)] px-2 py-1 text-[14px] font-medium text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /**
   * 모달 머리의 서비스 줄 — 고정 제목(`담당자 확인`·`접근 권한 요청`) 아래에
   * `이름 (코드)` 로 선다.
   *
   * 제목이 가변 텍스트를 물면(`AWS 담당자 5명`) 이름이 길어질수록 24/700 이 두 줄, 세
   * 줄로 자란다. 제목은 이 모달이 하는 일 하나만 말하게 고정하고, 서비스는 그 아래
   * 자기 줄에서 필요한 만큼 감긴다 — 잘라 내지 않는다. 이 줄이 이 모달의 신원이라,
   * 감기는 건 괜찮아도 사라지는 건 안 된다.
   *
   * `break-keep` 은 한글이 낱말 한가운데서 끊기는 기본 규칙을 막는다.
   *
   * 색은 `--pl-primary` 다(흰 바닥 5.17:1). 제목이 고정 문구가 된 뒤로 이 줄만이 이
   * 모달이 어느 서비스 것인지 말한다 — 굵기는 이미 `ownerChip` 과 같은 편이라, 색이
   * 그 줄을 먼저 읽게 만드는 유일한 채널이다. 괄호 속 코드는 이름에 딸린 값이라
   * 따라오지 않는다.
   */
  serviceMeta:
    'min-w-0 text-[16px] font-semibold leading-[1.4] text-[var(--pl-primary)] break-keep',
  /** 칩 흐름 위 한 줄 — 왼쪽 인원수, 오른쪽 검색(24명 초과일 때만). */
  ownerBar: 'mb-3 flex items-center justify-between gap-3',
  ownerCount: 'text-[12px] font-medium tabular-nums text-[var(--pl-text-weak)]',
  /** 검색 상자는 이 줄의 절반까지만 — 인원수 라벨이 오른쪽으로 밀려나면 안 된다. */
  ownerSearch: 'w-[260px] flex-none',
  /** 서버가 배열을 잘라 보냈을 때의 각주 — 흐름 밖, 상자 아래. */
  ownerNote: 'mt-3 text-[12px] text-[var(--pl-text-weak)]',
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
   *  면이 구분해 주지 못하고, 승인 화면에서 읽어야 할 쪽은 요청자 쪽이다.
   *
   *  높이는 사유 길이와 무관하게 92px 로 고정한다(오너 지시 2026-08-14) — 세 줄
   *  (14px·leading 1.6 → 22.4 × 3 = 67.2)에 위아래 패딩 24. 사유는 계약에 상한이 없고
   *  입력만 1000자로 막혀 있어서, 늘어나게 두면 레일에서 요청을 옮길 때마다 아래 승인·
   *  반려 버튼이 오르내린다 — 누를 자리가 고른 요청에 따라 움직이면 안 된다.
   *  자르지 않고 넘치면 스크롤한다: 승인 화면에서 사유의 뒷부분을 감추면 안 된다. */
  quoteAsk:
    'h-[92px] overflow-y-auto whitespace-pre-wrap rounded-[8px] bg-[var(--pl-primary-bg)] px-4 py-3 text-[14px] leading-[1.6] text-[var(--pl-text-medium)]',
} as const;
