'use client';

/**
 * 내 권한 요청 (/access-requests) — 권한이 없는 서비스를 보고, 사유를 적어 요청하고,
 * 승인·반려 결과를 확인하는 화면.
 *
 * `/admin/**` 밖에 있다. 그 아래였다면 admin 게이트(ADMIN 허용 목록)가 이 화면을 정확히
 * 필요로 하는 사람만 골라 막았을 것이다. 진입점은 계정 카드(UserChip)이고, 화면 자체는
 * 접근 권한 관리자 화면들과 같은 부품·같은 계약을 쓴다.
 *
 * 화면은 세 켜로 읽힌다:
 *  1. **건수 줄** — 반려·대기·승인. 재방문자가 이 화면에 오는 이유("내 요청 어떻게
 *     됐지?")에 스크롤 없이 답한다. 판정 문장이 있던 자리다(오너 지시 2026-08-17).
 *  2. **탭** — 이 화면의 목차. 세 목록을 같은 한 자리에 포갠다.
 *  3. **표** — 탭이 무엇을 고르든 열 문법은 같다.
 *
 * 처음에는 목록 둘을 위아래 두 구역으로 놓았다. 같은 바닥의 형제 둘이라 무슨 등급을
 * 매겨도 평평했고, 등급 대신 표면 수를 줄여도 여전히 스크롤 한 번이 두 목록을 갈랐다.
 * 계층은 포함에서 생기지 등급에서 생기지 않는다 — 탭은 둘을 같은 한 자리에 포갠다.
 * 서로 배타적인 두 일(요청하러 왔다 / 결과 보러 왔다)이라 동시에 볼 이유도 없다.
 *
 * 첫 탭은 "내가 아직 못 가진 서비스"다 — `/user/services/page` 가 전체 서비스와
 * `access_status` 를 주므로, NONE 이거나 REJECTED 인 것만 걸러 낸 것이다.
 *
 * 셋 다 **머리 줄이 있는 표**다(오너 지시 2026-08-17). 카드 더미였을 때는 한 칸에
 * [타일 이름 코드칩] 이 붙어 다녀서 코드가 행마다 다른 x 에 섰고, 무엇이 무슨 값인지
 * 말해 주는 것이 아무 데도 없었다. 이제 열 이름이 한 번만 적히고 값은 그 열을 채운다.
 *
 * 표는 흰 종이 위에 올라간다. 행에 면이 없는 표는 구분선이 캔버스(#F4F4FB) 위에 바로
 * 그어지는데 #E4E7EC 대 그 바닥은 1.132:1 — 있어도 안 보이는 선이다. 흰 바닥에서 같은
 * 선이 1.239:1 이고, 그래서 손대는 것은 선이 아니라 바닥이다(브라우저 실측).
 *
 * 폭은 960 이다 — 자세한 이유는 layout.tsx.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { fmtDateTime } from '@/lib/pipeline/format';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  PagedCard,
  errorMessage,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import {
  OwnersModal,
  RequestAccessModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';
import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  createAccessRequest,
  getMyAccessRequests,
  getServicesPage,
  getUserServices,
  sliceToPage,
  type AccessPage,
  type AccessRequestStatus,
  type MyAccessRequest,
  type ServiceRow,
  type UserServiceRow,
} from '@/app/lib/api/access';

/**
 * 요청 가능한 서비스 = access_status 가 NONE 이거나 REJECTED 인 것.
 *
 * 거르는 일은 화면 몫이다 — 계약에 `access_status` 필터가 없다(갭 B6).
 *
 * 거른 뒤에 나눈다. 서버가 나눠 준 다섯 줄 안에서 걸렀더니 장마다 남는 수가 달랐다 —
 * 카탈로그 20 개 기준으로 요청 가능이 3·2·2·2, 접근 가능이 2·3·2·1 이었다. 다섯 줄짜리
 * 칸에 두세 줄이 서고, 다음 장으로 넘겨도 여전히 두세 줄이다. 한 장은 다섯 줄이어야
 * 한다(오너 지시 2026-08-18).
 *
 * 08-14 에 전체 훑기를 접었던 이유는 **왕복 횟수**였다(서비스 2,059 개에서 열한 번).
 * 그 전제가 여기서는 성립하지 않는다 — 한 번에 크게 받아 화면에서 나누므로 왕복은
 * 한 번이다. 관리자 화면 둘(`admins`, `services/[[...code]]`)이 이미 같은 `sliceToPage`
 * 를 쓴다.
 *
 * 천장: 카탈로그가 CATALOG_FETCH_SIZE 를 넘으면 넘는 만큼은 후보에 안 뜬다. 그때 답은
 * 더 큰 수가 아니라 B6(서버 필터)다.
 */
const REQUESTABLE = new Set(['NONE', 'REJECTED']);
const CATALOG_FETCH_SIZE = 500;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 헤더 판정이 세는 축. 필요한 건 건수뿐이라 상태마다 `size=1` 로 한 줄씩만 받아
 * `totalElements` 를 읽는다 — 세 번, 요청이 몇 건이든 고정이다.
 */
const VERDICT_STATUSES: readonly AccessRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

type VerdictCounts = { pending: number; approved: number; rejected: number };

/**
 * 서비스 두 탭의 열 — 코드와 이름을 각자 제 열에 세운다(오너 지시 2026-08-17).
 *
 * 카드 더미였을 때는 한 칸에 [타일 이름 코드칩] 이 붙어 있었다. 그러면 코드가 이름
 * 길이만큼 밀려 행마다 다른 x 에 서고, 무엇이 이름이고 무엇이 코드인지 머리 줄이
 * 말해 주지도 않는다. 내 요청 내역과 같은 순서다 — 코드가 왼쪽이라야 코드로 훑힌다.
 *
 * 타일은 없다. 타일을 이름 칸에 두면 '서비스' 머리가 이름이 아니라 타일 위에 서서,
 * 방금 상태 열에서 고친 것과 같은 어긋남이 38px 짜리로 생긴다.
 *
 * 마지막 열은 라벨이 없다(꼬리) — 버튼 그룹 자리다.
 */
const SERVICE_COLUMNS: readonly Column[] = [
  { label: '서비스 코드', className: a.code },
  { label: '서비스 이름', className: a.name },
  { className: a.svcActionCell },
];

/** 그 표의 로딩 자리 — 꼬리 칸의 막대는 버튼 그룹의 실제 크기(140×32)다. */
const SERVICE_SKELETON = (
  <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중" className={a.tableBody}>
    {Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
      <div key={row} className={a.rowMid} aria-hidden="true">
        <span className={cn(a.code, a.skeletonBar)} />
        <span className={cn(a.name, a.skeletonBar)} />
        <span className={a.svcActionCell}>
          <span className={cn(a.skeletonBar, 'h-8 w-[140px]')} />
        </span>
      </div>
    ))}
  </div>
);

/** 담당자를 싣는 계약은 한쪽뿐이라 행 타입이 갈린다 — 버튼 그룹은 이 좁힘 뒤에만 그린다. */
const hasOwners = (row: UserServiceRow): row is ServiceRow => 'owners' in row;

/**
 * 헤더가 먼저 말하는 사실. 급한 순서로 고른다 — 반려는 내가 다시 움직여야 하는 상태다.
 *
 * 목록이 아니라 건수를 받는다. 세는 데 필요한 게 수뿐인데 목록을 통째로 들고 있으면
 * 이 문장 하나 때문에 화면이 모든 장을 훑게 된다.
 */
function HeaderVerdict({ counts }: { counts: VerdictCounts | 'error' | null }): ReactElement | null {
  // 못 셌으면 아무것도 쓰지 않는다 — 틀린 수를 말하느니 말하지 않는다. 실패 자체는
  // 아래 목록 카드가 재시도와 함께 말한다.
  if (counts === 'error') return null;
  if (counts == null) {
    // 수를 모르는 동안 자리만 잡는다 — 로딩 중의 '0' 은 아직 모르는 수를 단언하는 것.
    return <span className={cn(a.skeletonBar, 'mt-2 block h-7 w-[240px]')} aria-hidden="true" />;
  }

  const { pending, approved, rejected } = counts;
  const total = pending + approved + rejected;

  if (total === 0) {
    // 셀 것이 없을 때만 문장이 선다 — 수를 못 쓰는 유일한 경우라서.
    return (
      <p className={a.pageDesc}>
        아직 요청한 권한이 없어요 — 아래 목록에서 서비스를 골라 권한을 요청해 보세요
      </p>
    );
  }

  // 판정 문장은 없다(오너 지시 2026-08-17). 문장이 고른 한 상태를 크게 말하고 나머지
  // 둘을 작게 되풀이하던 자리인데, 같은 세 수를 두 급으로 두 번 쓰는 셈이었다. 이제
  // 셋이 같은 줄에 같은 급으로 선다 — 급한 순서(반려 → 대기 → 승인)는 그대로다.
  // 0건인 상태는 쓰지 않는다.
  const items = [
    { label: '반려', value: rejected },
    { label: '대기', value: pending },
    { label: '승인', value: approved },
  ].filter((item) => item.value > 0);

  return (
    <p className={a.pageMeta}>
      {items.map((item) => (
        <span key={item.label}>
          {item.label} <b className={a.pageMetaVal}>{item.value}</b>
        </span>
      ))}
    </p>
  );
}

/**
 * 내 요청 내역의 열 — 이 탭만 표다(오너 지시 2026-08-17).
 *
 * 서비스 두 탭은 고를 것들의 더미지만 이 탭은 **기록**이다. 카드 더미로 그리던 때는
 * 한 줄에 이름·사유·상태·일시 넷이 라벨 없이 놓여 있어서, 회색 12px 두 개 중 어느
 * 쪽이 내가 쓴 사유이고 어느 쪽이 일시인지 읽어 봐야 알았다. 표는 그 이름을 머리
 * 한 줄에 한 번만 적고 열마다 같은 x 를 준다.
 *
 * 코드가 서비스 왼쪽 제 열에 서는 것은 관리자 전체 이력과 같은 규칙이다 — 이름 뒤에
 * 붙이면 코드가 이름 길이만큼 밀려 행마다 다른 x 에 서고, 코드로 훑을 수가 없다.
 * 마지막 열은 라벨이 없다(꼬리) — 반려된 요청에만 서는 [다시 요청] 자리다.
 */
const MINE_COLUMNS: readonly Column[] = [
  { label: '서비스 코드', className: a.code },
  { label: '서비스 이름', className: a.name },
  { label: '요청 사유', className: a.reason },
  // 이 열의 머리만 8px 들여 쓴다. 값이 pill 이라 글자가 자기 면 안쪽으로 px-2 만큼
  // 들어가 있고, 눈이 열을 맞추는 기준은 옅은 면의 가장자리가 아니라 글자다 — 머리를
  // 상자 왼쪽에 두면 이 열만 8px 어긋나 보인다(실측: 머리 991, pill 글자 999).
  // 반대로 pill 을 왼쪽으로 당기지 않는 이유는 열 사이 간격이 12px 뿐이라, 8px 을
  // 당기면 사유 열 글자와 pill 면 사이가 4px 로 붙어 버린다.
  { label: '상태', className: cn(a.status, 'pl-2') },
  { label: '요청 일시', className: a.when },
  { className: a.svcAction },
];

/**
 * 그 표의 로딩 자리 — `PagedCard` 의 기본 스켈레톤과 같은 막대지만 표의 행 문법으로
 * 그린다. 기본 스켈레톤은 `row`(위아래 10px)를 쓰는데, 도착한 행은 16px 이라 목록이
 * 행마다 12px 씩 올라온다.
 */
const MINE_SKELETON = (
  <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중" className={a.tableBody}>
    {Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
      <div key={row} className={a.rowTop} aria-hidden="true">
        {MINE_COLUMNS.map((col, index) => (
          <span
            key={col.label ?? `tail-${index}`}
            className={cn(col.className, col.label != null && a.skeletonBar)}
          />
        ))}
      </div>
    ))}
  </div>
);

type TabKey = 'services' | 'owned' | 'mine';

export default function MyAccessRequestsPage(): ReactElement {
  const [tab, setTab] = useState<TabKey>('services');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 검색은 서버가, 상태는 화면이 거른다. 한 번에 크게 받아 거른 뒤 다섯 줄씩 나눈다
  // (위 REQUESTABLE 주석). `page` 는 걸러진 목록의 장 번호지 서버 장 번호가 아니다.
  const fetchRequestable = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<ServiceRow>> => {
      const result = await getServicesPage(debounced || undefined, 0, {
        ...opts,
        size: CATALOG_FETCH_SIZE,
      });
      const rows = result.content.filter((row) => REQUESTABLE.has(row.accessStatus));
      return sliceToPage(rows, page, ACCESS_PAGE_SIZE);
    },
    [debounced],
  );

  // 다른 호출이다 — `/user/services/page` 는 내가 담당인 것만 준다. 다만 ADMIN 에게는
  // 전체가 오므로(role 로 통과할 뿐 담당자는 아니다) 여기서 한 번 더 거른다.
  const fetchOwned = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<UserServiceRow>> => {
      const result = await getUserServices(debounced || undefined, 0, {
        ...opts,
        size: CATALOG_FETCH_SIZE,
      });
      const rows = result.content.filter((row) => row.accessStatus === 'OWNED');
      return sliceToPage(rows, page, ACCESS_PAGE_SIZE);
    },
    [debounced],
  );

  const fetchMine = useCallback(
    (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<MyAccessRequest>> =>
      getMyAccessRequests(undefined, page, opts),
    [],
  );

  const requestable = usePagedSection(fetchRequestable);
  const owned = usePagedSection(fetchOwned);
  const mine = usePagedSection(fetchMine);
  const toast = usePlToast();

  // 헤더 판정용 건수 — 상태마다 한 줄씩(`size=1`), 세 번. 요청을 넣으면 다시 센다.
  const [counted, setCounted] = useState(0);
  const [verdict, setVerdict] = useState<VerdictCounts | 'error' | null>(null);
  useAbortableEffect(
    (signal) =>
      Promise.all(
        VERDICT_STATUSES.map((status) =>
          getMyAccessRequests(status, 0, { signal, size: 1 }).then((p) => p.totalElements),
        ),
      )
        .then(([pending, approved, rejected]) => {
          if (signal.aborted) return;
          setVerdict({ pending, approved, rejected });
        })
        .catch(() => {
          if (!signal.aborted) setVerdict('error');
        }),
    [counted],
  );
  /**
   * 요청 모달을 연 서비스 — null 이면 닫혀 있다.
   *
   * 행 타입이 아니라 모달이 실제로 읽는 두 필드만 담는다. 반려된 요청에서도 같은
   * 모달을 여는데, `MyAccessRequest` 를 `UserServiceRow` 로 만들려면 `accessStatus`
   * 와 `isEosService` 를 지어내야 한다 — 화면이 안 쓰는 값을 지어내지 않는다.
   */
  const [target, setTarget] = useState<{
    serviceCode: string;
    serviceName: string;
  } | null>(null);

  /**
   * 담당자 모달을 연 서비스 — null 이면 닫혀 있다(오너 지시 2026-08-17).
   *
   * 행 안에 펼치던 것을 모달로 옮겼다. 행의 둘째 단은 한 줄이라 담당자가 여럿이면
   * 이름이 잘렸는데, 펼쳐서 본 답이 또 잘리면 펼친 의미가 없다.
   *
   * 행 전체를 담는다 — 모달이 코드·이름·담당자·전체 수를 다 쓴다. 새로 조회하지 않는
   * 이유는 `OwnersModal` 주석에 있다.
   */
  const [owners, setOwners] = useState<ServiceRow | null>(null);

  const submit = async (reason: string): Promise<void> => {
    if (!target) return;
    try {
      await createAccessRequest(target.serviceCode, reason);
      toast.show(`${target.serviceName} 접근 권한을 요청했어요`);
      setTarget(null);
      // 요청한 서비스는 후보에서 빠지고 내역에 나타난다 — 둘 다 다시 읽는다.
      // 접근 가능 목록은 승인이 나야 바뀌므로 여기서는 건드리지 않는다.
      requestable.reload();
      mine.reload();
      setCounted((n) => n + 1);
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  /**
   * 탭 레일 — 이 화면의 목차다. 카드 안이 아니라 화면 자체를 가르므로 카드보다 위에
   * 있고, 한 칸 큰 타입(`tabLg`)을 쓴다.
   *
   * 목록 상태(`usePagedSection`)는 셋 다 이 페이지가 들고 있다. 그래서 탭을 옮겨도
   * 다시 읽지 않는다.
   *
   * 건수는 **내 요청 내역에만** 붙는다. 서비스 두 탭도 이제는 셀 수 있다 — 거른 뒤에
   * 나누므로 `totalElements` 가 걸러진 수다(전에는 서버가 센 전체라 '내가 접근할 수
   * 있는 서비스 20' 옆에 빈 목록이 서곤 했다). 다만 붙일지는 별개 판단이라 그대로 둔다.
   */
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'services', label: '요청할 수 있는 서비스' },
    { key: 'owned', label: '내가 접근할 수 있는 서비스' },
    { key: 'mine', label: '내 요청 내역', count: mine.paged?.totalElements },
  ];
  const tabStrip = (
    <div className={a.pageTabStrip} role="tablist" aria-label="내 권한 요청 탭">
      {tabs.map((item) => {
        const active = item.key === tab;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(item.key)}
            className={cn(a.tab, a.tabLg, active ? a.tabActive : a.tabIdle)}
          >
            {item.label}
            {/* 아직 모르는 수는 쓰지 않는다 — 로딩 중 '0' 은 단언이다. */}
            {item.count != null && <span className={a.tabCount}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );

  const requestTab = tab === 'services';

  return (
    <div>
      <h1 className={a.pageTitle}>내 권한 요청</h1>
      <HeaderVerdict counts={verdict} />
      {tabStrip}

      {/* 세 탭 모두 흰 종이 위의 표다(오너 지시 2026-08-17). 행에 면이 없는 표는 구분선이
          캔버스 위에 바로 그어지고, #E4E7EC 대 #F4F4FB 는 1.132:1 — 선이 있어도 안 보인다.
          흰 바닥에서 같은 선이 1.239:1 이다. 머리 줄은 없다(`head={null}`) — 제목은 위의
          탭이 이미 쓰고 있어서 대신 그릴 것조차 없다. */}
      {tab !== 'mine' ? (
        // 서비스 탭 둘은 같은 목록을 다른 축으로 자른 것이라 표도 하나로 그린다 —
        // 나란히 두 벌을 두면 같은 행 문법이 조용히 갈라진다.
        <PagedCard
          className="mt-4"
          head={null}
          title={requestTab ? '요청할 수 있는 서비스' : '내가 접근할 수 있는 서비스'}
          desc={
            requestTab
              ? '아직 접근 권한이 없는 서비스예요 — 사유를 적어 요청하면 관리자가 검토해요'
              : '이미 권한이 있어 바로 들어갈 수 있는 서비스예요'
          }
          icon={requestTab ? 'compass' : 'shield-check'}
          tone={requestTab ? 'primary' : 'muted'}
          state={requestTab ? requestable : owned}
          search={
            <SearchBox
              wrapClassName="block w-full"
              placeholder="서비스 코드/이름 검색"
              aria-label="서비스 코드/이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
          columns={SERVICE_COLUMNS}
          skeleton={SERVICE_SKELETON}
          empty={
            debounced
              ? {
                  title: '검색 결과가 없어요',
                  caption: requestTab
                    ? '이미 권한이 있거나 요청해 둔 서비스는 여기 나오지 않아요'
                    : '권한이 있는 서비스 중에는 검색어와 맞는 것이 없어요',
                }
              : requestTab
              ? {
                  title: '요청할 서비스가 없어요',
                  caption: '모든 서비스에 권한이 있거나, 이미 요청해 두었어요',
                }
              : {
                  title: '접근할 수 있는 서비스가 없어요',
                  caption: "'요청할 수 있는 서비스' 탭에서 골라 권한을 요청해 보세요",
                }
          }
        >
          {/* 행 자체는 버튼이 아니다 — 고르는 목록이 아니라 요청하는 목록이라, 누를 수
                있는 건 꼬리의 버튼 그룹뿐이다. 이미 가진 서비스는 그 자리가 비어 있다:
                할 일이 없는 행에 회색 버튼을 두면 눌러 보고 나서야 없다는 걸 알게 된다. */}
          {(rows) => (
            <div role="rowgroup" className={a.tableBody}>
              {rows.map((row) => (
                <div key={row.serviceCode} role="row" className={a.rowMid}>
                  <span role="cell" className={cn(a.code, a.monoMd)}>
                    {row.serviceCode}
                  </span>
                  <span role="cell" className={cn(a.name, a.nameStrong)}>
                    {row.serviceName}
                  </span>
                  {/* 칸은 두 탭 모두 자리를 지킨다 — 접근 가능 탭에서만 비우면 이름이
                      탭을 옮길 때마다 이 폭만큼 튄다. */}
                  <span role="cell" className={a.svcActionCell}>
                    {requestTab && hasOwners(row) && (
                      <span className={a.svcActions}>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          disabled={row.ownerCount === 0}
                          className={a.svcActionBtn}
                          onClick={() => setOwners(row)}
                        >
                          {row.ownerCount > 0 ? '담당자 보기' : '담당자 없음'}
                        </button>
                        <button
                          type="button"
                          className={a.svcActionBtnGo}
                          onClick={() => setTarget(row)}
                        >
                          권한 요청
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PagedCard>
      ) : (
        /* 기록. 설명 줄이 없는 건 반려 안내를 헤더 판정이 이미 말하기 때문이다.
           `bare` 가 없는 유일한 목록이다(오너 지시 2026-08-17) — 표는 흰 종이 위에
           올라간다. 서비스 두 탭은 행 하나하나가 흰 카드라 캔버스가 카드 사이를 갈라
           주지만, 표의 행에는 면이 없어서 구분선이 캔버스(#F4F4FB) 위에 바로 그어졌고
           #E4E7EC 대 그 바닥은 1.132:1 — 선이 있어도 안 보인다. 흰 바닥에서는 같은
           선이 1.239:1 이고, 이게 Azure 콘솔을 비롯한 모든 표가 읽히는 이유다:
           선을 진하게 하는 게 아니라 종이를 깐다. */
        <PagedCard
          className="mt-4"
          head={null}
          title="내 요청 내역"
          icon="clock"
          tone="muted"
          state={mine}
          columns={MINE_COLUMNS}
          skeleton={MINE_SKELETON}
          empty={{
            title: '요청한 내역이 없어요',
            caption: "'요청할 수 있는 서비스' 탭에서 골라 권한을 요청해 보세요",
          }}
        >
          {(rows) => (
            <div role="rowgroup" className={a.tableBody}>
              {rows.map((row) => (
                // 카드가 아니라 표의 행이다(오너 지시 2026-08-17) — 타일도 없다.
                // 무엇이 무슨 값인지는 머리 줄이 한 번만 말하고, 행은 그 열을 채운다.
                <div key={row.requestId} role="row" className={a.rowTop}>
                  <span role="cell" className={cn(a.code, a.monoMd)}>
                    {row.serviceCode}
                  </span>
                  <span role="cell" className={cn(a.name, a.nameStrong)}>
                    {row.serviceName}
                  </span>
                  <span role="cell" className={a.reason}>
                    {row.reason}
                  </span>
                  <span role="cell" className={a.status}>
                    <RequestStatusPill status={row.status} />
                  </span>
                  <span role="cell" className={a.when}>
                    {fmtDateTime(row.requestedAt)}
                  </span>
                  {/* 꼬리 칸은 반려가 아닌 행에서도 자리를 지킨다 — 반려에만 두면 그
                      행의 일시만 오른쪽으로 밀려 날짜들이 한 x 에 안 선다.

                      반려는 이 화면에서 다시 움직여야 하는 유일한 상태다. 예전에는
                      '요청할 수 있는 서비스' 탭으로 건너가야 했는데, 판정 문장이
                      가리키는 건이 정작 손댈 수 없는 줄로 서 있었다. 같은 요청 모달을
                      여기서 연다. */}
                  <span role="cell" className={a.svcAction}>
                    {row.status === 'REJECTED' && (
                      <button type="button" className={a.svcLink} onClick={() => setTarget(row)}>
                        다시 요청
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PagedCard>
      )}

      <OwnersModal
        open={owners != null}
        onClose={() => setOwners(null)}
        serviceCode={owners?.serviceCode ?? ''}
        serviceName={owners?.serviceName ?? ''}
        owners={owners?.owners ?? []}
        ownerCount={owners?.ownerCount ?? 0}
      />
      <RequestAccessModal
        open={target != null}
        onClose={() => setTarget(null)}
        serviceCode={target?.serviceCode ?? ''}
        serviceName={target?.serviceName ?? ''}
        onSubmit={submit}
      />
    </div>
  );
}
