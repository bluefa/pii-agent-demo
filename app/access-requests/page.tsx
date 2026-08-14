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
 *  1. **판정** — 헤더 문장. 재방문자가 이 화면에 오는 이유("내 요청 어떻게 됐지?")에
 *     스크롤 없이 답한다. 32px 수치가 화면에서 가장 큰 타입이다.
 *  2. **탭** — 이 화면의 목차. 세 목록을 같은 한 자리에 포갠다.
 *  3. **카드 더미** — 탭이 무엇을 고르든 카드 문법은 같다.
 *
 * 처음에는 목록 둘을 위아래 두 구역으로 놓았다. 같은 바닥의 형제 둘이라 무슨 등급을
 * 매겨도 평평했고, 등급 대신 표면 수를 줄여도 여전히 스크롤 한 번이 두 목록을 갈랐다.
 * 계층은 포함에서 생기지 등급에서 생기지 않는다 — 탭은 둘을 같은 한 자리에 포갠다.
 * 서로 배타적인 두 일(요청하러 왔다 / 결과 보러 왔다)이라 동시에 볼 이유도 없다.
 *
 * 첫 탭은 "내가 아직 못 가진 서비스"다 — `/user/services/page` 가 전체 서비스와
 * `access_status` 를 주므로, NONE 이거나 REJECTED 인 것만 걸러 낸 것이다.
 *
 * 탭으로 합친 뒤에도 카드 **안**은 평평했다(2차 진단:
 * design/access/access-requests-benchmark-r2.html). 이름 칸 735px 에 든 글자가 41px,
 * 94% 가 빈 폭이었고 카드 안의 타입은 12·14·16 셋뿐이라 훑을 굵은 줄이 없었다.
 * 행을 두 단으로 만든 것이 그 답이다: 윗단 [이름 코드], 아랫단 보조 사실(12/weak).
 * 등급이 카드 사이가 아니라 **행 안**에 있다.
 *
 * 마지막으로 표면을 하나 걷어 냈다(승인 워크벤치와 같은 정리). 탭은 카드 밖 화면
 * 자체로 나오고, 목록을 감싸던 카드는 사라지고, 행 자체가 카드가 된다.
 *
 * 워크벤치처럼 캔버스를 새로 깔지는 **않는다**. 저쪽은 어드민 셸이 #F9FAFB 를 칠하고
 * 있어서 흰 카드가 ΔE00 1.20 — JND 아래라 테두리 혼자 버텼고, 그래서 바닥을 내려야
 * 4.12 가 됐다. 이 화면은 `/admin/**` 밖이라 body 의 캔버스(#F4F4FB)를 그대로 물려받아
 * 바닥이 이미 내려가 있다(브라우저 실측 2026-08-14). 그래서 여기서 할 일은 바닥을
 * 내리는 게 아니라 그 바닥을 덮고 있던 흰 카드를 걷어 내는 것이다.
 *
 * 카드끼리는 헤어라인이 아니라 간격으로 끊는다 — 표가 아니라 더미로 읽히도록.
 * 폭도 하나로 줄였다 — 자세한 이유는 layout.tsx.
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { fmtDateTime } from '@/lib/pipeline/format';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { serviceListStyles as sl } from '@/app/admin/pipelines/_services/styles';
import {
  PagedCard,
  errorMessage,
  usePagedSection,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import { RequestAccessModal } from '@/app/admin/pipelines/access/_components/AccessModals';
import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  createAccessRequest,
  getMyAccessRequests,
  getServicesPage,
  getUserServices,
  type AccessPage,
  type AccessRequestStatus,
  type MyAccessRequest,
  type ServiceRow,
  type UserServiceRow,
} from '@/app/lib/api/access';

/**
 * 요청 가능한 서비스 = access_status 가 NONE 이거나 REJECTED 인 것.
 *
 * 거르는 일은 화면 몫이다 — 계약에 `access_status` 필터가 없다. 그래서 **서버가 준 장
 * 안에서만** 거른다. 예전에는 전체를 훑어 거른 뒤 다시 나눴는데, 서비스가 2,000 개인
 * 계정에서 그건 목록 하나가 열 몇 번의 왕복이 된다(오너 확인 2026-08-14).
 *
 * 대가는 둘이다: 이미 권한이 있는 서비스만큼 장이 짧아지고, 배지 건수는 서버가 센
 * 전체라 걸러진 행까지 포함한다. 둘 다 서버 필터 하나면 사라지므로 계약에 올려 둔다(B6).
 */
const REQUESTABLE = new Set(['NONE', 'REJECTED']);
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 헤더 판정이 세는 축. 필요한 건 건수뿐이라 상태마다 `size=1` 로 한 줄씩만 받아
 * `totalElements` 를 읽는다 — 세 번, 요청이 몇 건이든 고정이다.
 */
const VERDICT_STATUSES: readonly AccessRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

type VerdictCounts = { pending: number; approved: number; rejected: number };

/**
 * 로딩 중 목록 — 타일 · [이름 코드] · 둘째 단의 크기를 그대로 흉내 낸다. 세 탭이 같은
 * 카드 문법을 쓰므로 스켈레톤도 하나다. 도착했을 때 목록이 튀지 않는 건 이 칸들이
 * 진짜 카드와 같기 때문이다.
 *
 * 타일 자리는 `skeletonBar`(h-3.5)로 못 그린다 — `cn` 은 단순 join 이라 h-7 을 덧씌우면
 * Tailwind 출력 순서가 이긴다. 그래서 크기·색을 여기서 직접 준다.
 */
const CARD_SKELETON = (
  <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중" className={a.deckRows}>
    {Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
      <div key={row} className={a.svcRow} aria-hidden="true">
        <span className={cn(serviceSidebarStyles.tile, 'animate-pulse bg-[var(--pl-gray-100)]')} />
        <span className={a.svcStack}>
          <span className={a.svcIdent}>
            <span className={cn(a.skeletonBar, 'h-4 w-[128px]')} />
            <span className={cn(a.skeletonBar, 'h-5 w-[38px]')} />
          </span>
          <span className={cn(a.skeletonBar, 'h-3 w-[172px]')} />
        </span>
        <span className={a.svcAction} />
      </div>
    ))}
  </div>
);

/**
 * 서비스 한 건의 표기 — 타일 · [이름 코드] · 설명. `/services` 레일의 부품을 그대로 쓴다.
 *
 * 두 탭이 같은 이것을 쓴다. 요청할 때 본 서비스와 내역에서 보는 서비스가 다른 모양이면
 * 같은 것으로 읽히지 않는다. 감싸는 칸(`a.svcCell`)이 타일과 덩어리 사이 gap 을 준다.
 *
 * 둘째 단(`sub`)은 탭마다 다르다 — 서비스 목록은 담당자, 내 요청 내역은 내가 쓴 사유.
 * 담당자는 자르고 사유는 접으므로 스타일까지 여기서 정하지 않고 부르는 쪽이 준다.
 */
function ServiceIdentity({
  code,
  name,
  sub,
}: {
  code: string;
  name: string;
  sub?: ReactNode;
}): ReactElement {
  return (
    <>
      <span className={cn(serviceSidebarStyles.tile, serviceTileClass(code))} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className={a.svcStack}>
        <span className={a.svcIdent}>
          <span className={cn(sl.name, sl.nameIdle)}>{name}</span>
          <span className={sl.code}>{code}</span>
        </span>
        {/* 없을 수 있다 — 없으면 빈 줄을 남기지 않고 한 단으로 돌아간다. */}
        {sub}
      </span>
    </>
  );
}

/**
 * 담당자 줄 — 행의 둘째 단.
 *
 * `/services/page` 만 담당자를 싣는다(담당 서비스 목록은 싣지 않는다). 신청 화면에서
 * 가장 쓸모 있는 사실이 이것이라 여기 온다 — 내 요청을 볼 사람이 누구인지, 그리고
 * 이름이 비슷한 서비스 둘 중 어느 쪽이 내가 아는 그 서비스인지. 계약에 이 필드가 생긴
 * 이유가 정확히 그 헷갈림이다.
 *
 * 이름은 둘까지만 쓰고 나머지는 수로 접는다. 담당자가 없으면 그렇게 쓴다 — 신청해도
 * 볼 사람이 없다는 뜻이라 감출 사실이 아니다.
 */
function ownerLine(row: ServiceRow): string {
  const shown = row.owners.slice(0, 2);
  if (shown.length === 0) {
    return row.ownerCount > 0 ? `담당자 ${row.ownerCount}명` : '담당자 없음';
  }
  const rest = row.ownerCount - shown.length;
  return `담당자 ${shown.join(' · ')}${rest > 0 ? ` 외 ${rest}명` : ''}`;
}

/** 담당자를 싣는 계약은 한쪽뿐이라 행 타입이 갈린다 — 둘째 단은 이 좁힘 뒤에만 그린다. */
const hasOwners = (row: UserServiceRow): row is ServiceRow => 'owners' in row;

/**
 * 헤더가 먼저 말하는 사실. 급한 순서로 고른다 — 반려는 내가 다시 움직여야 하는 상태다.
 *
 * 목록이 아니라 건수를 받는다. 세는 데 필요한 게 수뿐인데 목록을 통째로 들고 있으면
 * 이 문장 하나 때문에 화면이 모든 장을 훑게 된다.
 */
function HeaderVerdict({ counts }: { counts: VerdictCounts | 'error' | null }): ReactElement | null {
  // 못 셌으면 아무 문장도 쓰지 않는다 — 틀린 수를 말하느니 말하지 않는다. 실패 자체는
  // 아래 목록 카드가 재시도와 함께 말한다.
  if (counts === 'error') return null;
  if (counts == null) {
    // 수를 모르는 동안 문장을 지어내지 않는다 — 어떤 문장이 될지도 아직 모른다.
    return <span className={cn(a.skeletonBar, 'mt-2 block h-5 w-[340px]')} aria-hidden="true" />;
  }

  const { pending, approved, rejected } = counts;
  const total = pending + approved + rejected;

  if (total === 0) {
    return (
      <p className={a.pageDesc}>
        아직 요청한 권한이 없어요 — 아래 목록에서 서비스를 골라 권한을 요청해 보세요
      </p>
    );
  }

  const featured = rejected > 0 ? 'REJECTED' : pending > 0 ? 'PENDING' : 'APPROVED';
  const num = cn(a.pageTotal, a.pageTotalTone[featured]);
  const sentence =
    featured === 'REJECTED' ? (
      // 반려 **사유**는 말하지 않는다 — `GET /user/permission-access` 는 처리 메모를
      // 싣지 않아서 요청자가 볼 길이 없다(갭 B5). 없는 것을 확인하라고 보내지 않는다.
      <>
        반려된<strong className={num}>{rejected}</strong>건이 있어요 — &lsquo;내 요청 내역&rsquo;
        탭에서 다시 요청할 수 있어요
      </>
    ) : featured === 'PENDING' ? (
      <>
        {/* 전부 대기 중이면 "1건 중 1건"이 된다 — 분모가 분자와 같으면 말하지 않는다. */}
        요청한 {pending < total && `${total}건 중 `}
        <strong className={num}>{pending}</strong>건이 관리자 확인을 기다리고 있어요
      </>
    ) : (
      <>
        요청한<strong className={num}>{total}</strong>건이 모두 승인됐어요
      </>
    );

  // 문장이 이미 말한 수는 다시 쓰지 않는다 — 같은 사실을 두 번 쓰면 정보량은 그대로인데
  // 읽을 것만 늘어난다. 0건인 상태도 굳이 말하지 않는다.
  const rest: { label: string; value: number }[] = [];
  if (featured !== 'REJECTED' && rejected > 0) rest.push({ label: '반려', value: rejected });
  if (featured !== 'PENDING' && pending > 0) rest.push({ label: '대기', value: pending });
  if (featured !== 'APPROVED' && approved > 0) rest.push({ label: '승인', value: approved });

  return (
    <>
      <p className={a.pageDesc}>{sentence}</p>
      {rest.length > 0 && (
        <p className={a.pageMeta}>
          {rest.map((item) => (
            <span key={item.label}>
              {item.label} <b className={a.pageMetaVal}>{item.value}</b>
            </span>
          ))}
        </p>
      )}
    </>
  );
}

type TabKey = 'services' | 'owned' | 'mine';

export default function MyAccessRequestsPage(): ReactElement {
  const [tab, setTab] = useState<TabKey>('services');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 서버가 나눠 준 장을 그대로 그린다. 거르기는 그 장 안에서만 한다(위 REQUESTABLE 주석).
  const fetchRequestable = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<ServiceRow>> => {
      const result = await getServicesPage(debounced || undefined, page, opts);
      return {
        ...result,
        content: result.content.filter((row) => REQUESTABLE.has(row.accessStatus)),
      };
    },
    [debounced],
  );

  // 다른 호출이다 — `/user/services/page` 는 내가 담당인 것만 준다. 다만 ADMIN 에게는
  // 전체가 오므로(role 로 통과할 뿐 담당자는 아니다) 여기서 한 번 더 거른다.
  const fetchOwned = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<UserServiceRow>> => {
      const result = await getUserServices(debounced || undefined, page, opts);
      return {
        ...result,
        content: result.content.filter((row) => row.accessStatus === 'OWNED'),
      };
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
   * 건수는 **내 요청 내역에만** 붙는다. 서비스 두 탭의 `totalElements` 는 서버가 센
   * 전체 서비스 수고, 목록은 그 장 안에서 `access_status` 로 걸러 그린다 — 그래서
   * '내가 접근할 수 있는 서비스 20' 옆에 빈 목록이 서는 일이 실제로 생긴다. 걸러진
   * 수를 서버가 세 주기 전까지는(갭 B6) 수를 말하지 않는다. 틀린 수는 없는 수보다
   * 나쁘다.
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

      {/* 목록을 감싸는 카드가 없다(`bare`). 이 화면의 바닥은 이미 캔버스라 흰 카드가
          그 위에서 읽히고, 그러면 목록을 또 한 겹 흰 면으로 감쌀 이유가 없다 — 감싸면
          카드 안의 카드가 된다. 머리 줄도 없다(`head={null}`) — 제목은 위의 탭이 이미
          쓰고 있어서 대신 그릴 것조차 없다. */}
      {tab !== 'mine' ? (
        // 서비스 탭 둘은 같은 목록을 다른 축으로 자른 것이라 카드도 하나로 그린다 —
        // 나란히 두 벌을 두면 같은 행 문법이 조용히 갈라진다.
        <PagedCard
          className="mt-4"
          bare
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
          skeleton={CARD_SKELETON}
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
          {/* 서비스는 `/services` 레일과 같은 모양으로 읽힌다 — 타일 · 이름 · 코드 태그.
                고를 수 있는 목록이 아니라 요청할 목록이라 카드 자체는 버튼이 아니고, 끝의
                [권한 요청] 만 누를 수 있다. 이미 가진 서비스는 그 자리가 비어 있다 —
                할 일이 없는 카드에 회색 버튼을 두면 눌러 보고 나서야 없다는 걸 알게 된다.

                한 줄에 하나다. 2열로 흘려 봤더니 순서가 좌→우→아래로 튀어서 목록의 차례를
                읽을 수 없었다 — 폭을 쓰자고 훑기를 망치는 거래였다. */}
          {(rows) => (
            <div role="rowgroup" className={a.deckRows}>
              {rows.map((row) => (
                <div key={row.serviceCode} role="row" className={a.svcRow}>
                  <span role="cell" className={a.svcCell}>
                    <ServiceIdentity
                      code={row.serviceCode}
                      name={row.serviceName}
                      sub={
                        hasOwners(row) ? <span className={a.svcDesc}>{ownerLine(row)}</span> : null
                      }
                    />
                  </span>
                  {/* 칸은 두 탭 모두 자리를 지킨다 — 접근 가능 탭에서만 비우면 코드
                        태그가 탭을 옮길 때마다 68px 씩 튄다. */}
                  <span role="cell" className={a.svcAction}>
                    {requestTab && (
                      <button type="button" className={a.svcLink} onClick={() => setTarget(row)}>
                        권한 요청
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PagedCard>
      ) : (
        /* 기록. 설명 줄이 없는 건 반려 안내를 헤더 판정이 이미 말하기 때문이다. */
        <PagedCard
          className="mt-4"
          bare
          head={null}
          title="내 요청 내역"
          icon="clock"
          tone="muted"
          state={mine}
          skeleton={CARD_SKELETON}
          empty={{
            title: '요청한 내역이 없어요',
            caption: "'요청할 수 있는 서비스' 탭에서 골라 권한을 요청해 보세요",
          }}
        >
          {(rows) => (
            <div role="rowgroup" className={a.deckRows}>
              {rows.map((row) => (
                // 서비스 카드와 같은 골격에 꼬리만 다르다 — 같은 서비스가 탭 하나
                // 건너 다른 모양이면 같은 것으로 읽히지 않는다.
                <div key={row.requestId} role="row" className={a.svcRowTop}>
                  <span role="cell" className={a.svcCellTop}>
                    <ServiceIdentity
                      code={row.serviceCode}
                      name={row.serviceName}
                      sub={<span className={a.reqReason}>{row.reason}</span>}
                    />
                  </span>
                  <span role="cell" className={a.reqTail}>
                    <RequestStatusPill status={row.status} />
                    <span className={a.reqWhen}>{fmtDateTime(row.requestedAt)}</span>
                    {/* 액션 칸은 반려가 아닌 카드에서도 자리를 지킨다 — 반려에만 두면
                        그 카드의 일시만 왼쪽으로 밀려 날짜들이 한 x 에 안 선다.
                        서비스 탭의 [권한 요청] 칸과 같은 폭이라 두 탭에서 누를 자리도
                        같다.

                        반려는 이 화면에서 다시 움직여야 하는 유일한 상태다. 예전에는
                        '요청할 수 있는 서비스' 탭으로 건너가야 했는데, 판정 문장이
                        가리키는 건이 정작 손댈 수 없는 줄로 서 있었다. 같은 요청 모달을
                        여기서 연다. */}
                    <span className={a.svcAction}>
                      {row.status === 'REJECTED' && (
                        <button type="button" className={a.svcLink} onClick={() => setTarget(row)}>
                          다시 요청
                        </button>
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </PagedCard>
      )}

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
