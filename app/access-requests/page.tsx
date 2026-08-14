'use client';

/**
 * 내 권한 요청 (/access-requests) — 권한이 없는 서비스를 보고, 사유를 적어 요청하고,
 * 승인·반려 결과를 확인하는 화면.
 *
 * `/admin/**` 밖에 있다. 그 아래였다면 admin 게이트(ADMIN 허용 목록)가 이 화면을 정확히
 * 필요로 하는 사람만 골라 막았을 것이다. 진입점은 계정 카드(UserChip)이고, 화면 자체는
 * 접근 권한 관리자 화면들과 같은 부품·같은 계약을 쓴다.
 *
 * 화면은 두 평면으로 읽힌다 (design/access/access-requests-hierarchy.html 시안 A):
 *  1. **판정** — 헤더 문장. 재방문자가 이 화면에 오는 이유("내 요청 어떻게 됐지?")에
 *     스크롤 없이 답한다. 32px 수치가 화면에서 가장 큰 타입이다.
 *  2. **목록** — 요청할 수 있는 서비스 / 내 요청 내역. 둘은 한 카드 안의 **탭**이고,
 *     그 카드가 이 화면에서 유일하게 테두리를 가진 면이다.
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
 * 시안 A — 행을 두 단으로 만든다: 윗단 [이름 코드], 아랫단 설명(12/weak). 코드는
 * 오른쪽 끝에서 이름 옆으로 오고, 목록은 640px 열 안에서 읽는다. 이제 등급이 카드
 * 사이가 아니라 **행 안**에 있다.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { serviceListStyles as sl } from '@/app/admin/pipelines/_services/styles';
import {
  PagedCard,
  ROWS_PER_PAGE,
  errorMessage,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import { RequestAccessModal } from '@/app/admin/pipelines/access/_components/AccessModals';
import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  createAccessRequest,
  getMyAccessRequests,
  getServicesPage,
  getUserServices,
  sliceToPage,
  type AccessPage,
  type PermissionRequestDetail,
  type ServiceRow,
  type UserServiceRow,
} from '@/app/lib/api/access';

/**
 * 요청 가능한 서비스 = access_status 가 NONE 이거나 REJECTED 인 것.
 *
 * 서버 페이지를 그대로 쓸 수 없어 한 번에 크게 받아 걸러 낸다 — 필터가 화면 쪽에 있으니
 * 서버가 나눠 준 페이지에는 이미 걸러질 행이 섞여 있고, 그대로 그리면 10행짜리 카드에
 * 2행만 남는 페이지가 생긴다. 서비스 수는 목록 화면 하나 분량이라 이 정도가 맞다.
 *
 * 검색어는 서버로 보낸다(코드·이름). 걸러 내는 축이 둘(질의는 서버, 권한 상태는 화면)이라
 * 순서가 중요하다 — 질의로 좁힌 다음 상태로 거르고, 그 결과를 나눈다.
 */
const REQUESTABLE = new Set(['NONE', 'REJECTED']);
const SEARCH_DEBOUNCE_MS = 300;
/** 한 번에 크게 받는 크기 — 서비스도 내 요청도 목록 화면 하나 분량이다. */
const FETCH_ALL = 200;

/**
 * 로딩 중 서비스 목록 — 타일 · [이름 코드] · 설명의 크기를 그대로 흉내 낸다. 두 단이
 * 됐으므로 스켈레톤도 두 단이다. 도착했을 때 목록이 튀지 않는 건 이 칸들이 진짜 행과
 * 같기 때문이다.
 */
const SERVICE_SKELETON = (
  <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중">
    {Array.from({ length: ROWS_PER_PAGE }, (_, row) => (
      <div key={row} className={a.svcRow} aria-hidden="true">
        <span className={cn(serviceSidebarStyles.tile, a.skeletonBar, 'h-7 w-7')} />
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
 * 사유가 두 열인 이유: 계약의 `reason`(내가 쓴 요청 사유)과 `processedNote`(관리자가
 * 남긴 승인 메시지 또는 반려 사유)는 **다른 사람이 쓴 다른 사실**이다. 한 열에 합치면
 * 대기 중인 행에서 내가 쓴 사유가 관리자 답변처럼 읽힌다.
 */
const MINE_COLUMNS: readonly Column[] = [
  // 코드가 따로 없는 건 서비스 셀이 타일·이름·코드를 한 덩어리로 그리기 때문이다 —
  // 서비스 탭의 행과 같은 문법이다.
  { label: '서비스', className: a.svcCell },
  { label: '상태', className: a.status },
  { label: '요청 사유', className: a.reason },
  { label: '처리 결과', className: a.reason },
  { label: '요청 일자', className: a.when },
];

/**
 * 서비스 한 건의 표기 — 타일 · [이름 코드] · 설명. `/services` 레일의 부품을 그대로 쓴다.
 *
 * 두 탭이 같은 이것을 쓴다. 요청할 때 본 서비스와 내역에서 보는 서비스가 다른 모양이면
 * 같은 것으로 읽히지 않는다. 감싸는 칸(`a.svcCell`)이 타일과 덩어리 사이 gap 을 준다.
 *
 * 설명은 서비스 목록에서만 온다 — 내 요청 내역의 행은 이미 상태·사유·처리 결과·일자를
 * 들고 있어서 다섯 번째 사실을 더 얹을 자리가 아니다(계약에도 없다).
 */
function ServiceIdentity({
  code,
  name,
  desc,
}: {
  code: string;
  name: string;
  desc?: string | null;
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
        {/* 계약 확정 전이라 없을 수 있다 — 없으면 빈 줄을 남기지 않고 한 단으로 돌아간다. */}
        {desc && <span className={a.svcDesc}>{desc}</span>}
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

/** 헤더가 먼저 말하는 사실. 급한 순서로 고른다 — 반려는 내가 다시 움직여야 하는 상태다. */
function HeaderVerdict({ mine }: { mine: PermissionRequestDetail[] | null }): ReactElement {
  if (mine == null) {
    // 수를 모르는 동안 문장을 지어내지 않는다 — 어떤 문장이 될지도 아직 모른다.
    return <span className={cn(a.skeletonBar, 'mt-2 block h-5 w-[340px]')} aria-hidden="true" />;
  }

  const total = mine.length;
  const count = (status: string): number => mine.filter((row) => row.status === status).length;
  const rejected = count('REJECTED');
  const pending = count('PENDING');
  const approved = count('APPROVED');

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
      <>
        반려된<strong className={num}>{rejected}</strong>건이 있어요 — 사유를 확인하고 다시 요청할
        수 있어요
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

  const fetchRequestable = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<ServiceRow>> => {
      const all = await getServicesPage(debounced || undefined, 0, { ...opts, size: FETCH_ALL });
      return sliceToPage(
        all.content.filter((row) => REQUESTABLE.has(row.accessStatus)),
        page,
        ROWS_PER_PAGE,
      );
    },
    [debounced],
  );

  // 다른 호출이다 — `/user/services/page` 는 내가 담당인 것만 준다. 다만 ADMIN 에게는
  // 전체가 오므로(role 로 통과할 뿐 담당자는 아니다) 여기서 한 번 더 거른다.
  const fetchOwned = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<UserServiceRow>> => {
      const all = await getUserServices(debounced || undefined, 0, { ...opts, size: FETCH_ALL });
      return sliceToPage(
        all.content.filter((row) => row.accessStatus === 'OWNED'),
        page,
        ROWS_PER_PAGE,
      );
    },
    [debounced],
  );

  // 헤더 판정은 상태별 합이라 한 페이지로는 셀 수 없다(계약에 상태 필터가 없다).
  // 전체를 한 번 받아 화면이 세고, 표는 그 결과를 나눠 그린다 — 호출은 그대로 하나다.
  const [mineAll, setMineAll] = useState<PermissionRequestDetail[] | null>(null);
  const fetchMine = useCallback(
    async (
      page: number,
      opts: { signal: AbortSignal },
    ): Promise<AccessPage<PermissionRequestDetail>> => {
      const all = await getMyAccessRequests(0, { ...opts, size: FETCH_ALL });
      if (!opts.signal.aborted) setMineAll(all.content);
      return sliceToPage(all.content, page, ROWS_PER_PAGE);
    },
    [],
  );

  const requestable = usePagedSection(fetchRequestable);
  const owned = usePagedSection(fetchOwned);
  const mine = usePagedSection(fetchMine);
  const toast = usePlToast();
  /** 요청 모달을 연 서비스 — null 이면 닫혀 있다. */
  const [target, setTarget] = useState<UserServiceRow | null>(null);

  // 검색어가 바뀌면 첫 장으로. 3장짜리 목록의 3페이지에서 검색해 한 장만 남으면
  // 있지도 않은 페이지를 그리게 된다. 검색창은 하나지만 서비스 목록은 둘이라 둘 다.
  const { setPage: setRequestablePage } = requestable;
  const { setPage: setOwnedPage } = owned;
  useEffect(() => {
    setRequestablePage(0);
    setOwnedPage(0);
  }, [debounced, setRequestablePage, setOwnedPage]);

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
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  /**
   * 탭 레일 — 카드들이 번갈아 쓰는 같은 머리 줄.
   *
   * 목록 상태(`usePagedSection`)는 셋 다 이 페이지가 들고 있다. 그래서 탭을 옮겨도
   * 다시 읽지 않고, 다른 탭에 있는 동안에도 헤더 판정이 셀 내역을 받아 둔다 —
   * 안 보이는 탭의 수를 탭 자신이 말해야 하므로 어차피 전부 읽어야 한다.
   */
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'services', label: '요청할 수 있는 서비스', count: requestable.paged?.totalElements },
    { key: 'owned', label: '내가 접근할 수 있는 서비스', count: owned.paged?.totalElements },
    { key: 'mine', label: '내 요청 내역', count: mine.paged?.totalElements },
  ];
  const tabStrip = (
    <div className={a.tabStrip} role="tablist" aria-label="내 권한 요청 탭">
      {tabs.map((item) => {
        const active = item.key === tab;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(item.key)}
            className={cn(a.tab, active ? a.tabActive : a.tabIdle)}
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
      <HeaderVerdict mine={mineAll} />

      {tab !== 'mine' ? (
        // 서비스 탭 둘은 같은 목록을 다른 축으로 자른 것이라 카드도 하나로 그린다 —
        // 나란히 두 벌을 두면 같은 행 문법이 조용히 갈라진다.
        <PagedCard
          className="mt-6"
          head={tabStrip}
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
              wrapClassName={cn('block w-full', a.svcColumn)}
              placeholder="서비스 코드/이름 검색"
              aria-label="서비스 코드/이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
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
          {/* 서비스는 `/services` 레일과 같은 모양으로 읽힌다 — 타일 · 이름 · 코드 태그.
              고를 수 있는 목록이 아니라 요청할 목록이라 행 자체는 버튼이 아니고, 행 끝의
              [권한 요청] 만 누를 수 있다. 이미 가진 서비스는 그 자리가 비어 있다 —
              할 일이 없는 행에 회색 버튼을 두면 눌러 보고 나서야 없다는 걸 알게 된다.

              한 줄에 하나다. 2열로 흘려 봤더니 순서가 좌→우→아래로 튀어서 목록의 차례를
              읽을 수 없었다 — 폭을 쓰자고 훑기를 망치는 거래였다. */}
          {(rows) =>
            rows.map((row) => (
              <div key={row.serviceCode} role="row" className={a.svcRow}>
                <span role="cell" className={a.svcCell}>
                  <ServiceIdentity
                    code={row.serviceCode}
                    name={row.serviceName}
                    desc={hasOwners(row) ? ownerLine(row) : null}
                  />
                </span>
                {/* 칸은 두 탭 모두 자리를 지킨다 — 접근 가능 탭에서만 비우면 코드 태그가
                    탭을 옮길 때마다 68px 씩 튄다. */}
                <span role="cell" className={a.svcAction}>
                  {requestTab && (
                    <button type="button" className={a.svcLink} onClick={() => setTarget(row)}>
                      권한 요청
                    </button>
                  )}
                </span>
              </div>
            ))
          }
        </PagedCard>
      ) : (
        /* 기록. 설명 줄이 없는 건 반려 안내를 헤더 판정이 이미 말하기 때문이다. */
        <PagedCard
          className="mt-6"
          head={tabStrip}
          title="내 요청 내역"
          icon="clock"
          tone="muted"
          state={mine}
          columns={MINE_COLUMNS}
          empty={{
            title: '요청한 내역이 없어요',
            caption: "'요청할 수 있는 서비스' 탭에서 골라 권한을 요청해 보세요",
          }}
        >
          {(rows) =>
            rows.map((row) => (
              // items-start — 사유가 접히면 행 높이가 늘어난다. 가운데 정렬이면 서비스명과
              // 상태가 긴 사유의 세로 한가운데로 떠서 첫 줄끼리 맞지 않는다.
              <div key={row.requestId} role="row" className={cn(a.row, 'items-start')}>
                <span role="cell" className={a.svcCell}>
                  <ServiceIdentity code={row.serviceCode} name={row.serviceName} />
                </span>
                <span role="cell" className={a.status}>
                  <RequestStatusPill status={row.status} />
                </span>
                <span role="cell" className={a.reason}>
                  {row.reason}
                </span>
                <span role="cell" className={a.reason}>
                  {/* 아직 처리 전이면 관리자가 쓴 것이 없다 — 비어 있는 게 사실이다. */}
                  {row.processedNote ?? '—'}
                </span>
                <span role="cell" className={a.when}>
                  {fmtDateTime(row.requestedAt)}
                </span>
              </div>
            ))
          }
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
