'use client';

/**
 * 서비스 운영 — 좌측 서비스 레일 + 우측 상세 (서비스·대상 검색 /services 와 같은 split
 * 문법). 선택한 서비스는 PATH 에 있어(optional catch-all) 딥링크가 그대로 살아 있다.
 * 레일 상태(검색어·페이지)는 이 컴포넌트가 들고만 있고 URL 에 매어두지 않는다 — 현재
 * App Router 는 세그먼트가 바뀔 때 페이지를 다시 마운트해 처음 상태로 돌아가지만(/services
 * 레일과 같은 동작), 어느 쪽이든 화면이 성립하도록 초기값에 의존하는 로직은 두지 않았다.
 *
 * 레일은 실계약 `GET /user/services/page` 하나로 선다 (서비스·대상 검색 레일과 같은
 * 소스). 검색·페이지가 계약의 `query`/`page`/`size` 파라미터라 자르기는 서버 몫이고,
 * 이 화면에는 클라이언트 필터가 없다. 레일이 EOS 배지를 달지 않는 이유도 여기 있다 —
 * ServiceItem 은 code·name 두 필드뿐이고, EOS 는 대상의 service_info 에만 실려
 * 상세에서만 읽을 수 있다.
 */
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState, type ReactElement } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { useDebounce } from '@/app/hooks/useDebounce';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import { serviceItemsFrom, type ServiceItem } from '@/app/admin/pipelines/_services/logic';
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';
import { getServicesPage } from '@/app/lib/api';

// The rail pages the same everywhere it appears — see SERVICE_RAIL_PAGE_SIZE.
const RAIL_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;

/** 서비스·대상 검색 레일과 같은 값 — 두 레일의 검색 감각이 갈리지 않게. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Ceiling for one stretched row. A full page divides the rail's height evenly, so
 * without a cap a tall monitor — or a two-row search result — would stretch each
 * row down the whole rail.
 */
const ROW_MAX_PX = 88;

/**
 * Skeleton frame for the rail's list — mirrors the row shape (타일 · 이름 · 코드) so
 * the layout does not shift when the services land. Row count is the page size for
 * the same reason: a shorter skeleton would reflow the moment a full page arrives.
 *
 * The section label is real text, not a bar. It is local state (검색 중인가), known
 * before the request resolves, so blanking it would hide something we already have.
 */
function RailSkeleton({ section }: { section: string }): ReactElement {
  return (
    <>
      <div className={serviceListStyles.railSection}>{section}</div>
      <div
        className={serviceListStyles.railList}
        style={{ maxHeight: RAIL_PAGE_SIZE * ROW_MAX_PX }}
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: RAIL_PAGE_SIZE }).map((_, i) => (
          // 진짜 행과 같은 flex-1 + min-h-[48px] — 스켈레톤이 걷힐 때 목록이 튀지 않는다.
          <div key={i} className="flex flex-1 min-h-[48px] items-center gap-2.5 px-3" aria-hidden="true">
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-7 w-7 shrink-0 rounded-[6px]')} />
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-3 flex-1 rounded')} />
            <div className={cn(serviceSidebarStyles.skeletonBar, 'h-5 w-10 shrink-0 rounded-[6px]')} />
          </div>
        ))}
      </div>
    </>
  );
}

export function ServicesView(): ReactElement {
  const router = useRouter();
  // Optional catch-all: `/ops/services` → 선택 없음, `/ops/services/{code}` → params[0].
  const params = useParams<{ serviceCode?: string[] }>();
  const selectedCode = params.serviceCode?.[0] ?? null;

  const [services, setServices] = useState<ServiceItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  /** 0-based — 계약의 `page` 파라미터이자 SidebarPagination 이 쓰는 값. */
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // 타이핑 한 글자마다 질의를 보내지 않는다 — 서비스·대상 검색 레일과 같은 300ms.
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);

  // 콜백은 동기로 두고 promise 를 돌려준다 — 서비스·대상 검색 레일과 같은 형태
  // (async 콜백은 useAbortableEffect 의 레이스 가드를 우회할 수 있어 lint 가 막는다).
  useAbortableEffect(
    (signal) =>
      getServicesPage(page, RAIL_PAGE_SIZE, debouncedQuery || undefined, { signal })
        .then((loaded) => {
          if (signal.aborted) return;
          setFailed(false);
          setServices(serviceItemsFrom(loaded));
          setPages(Math.max(1, loaded.totalPages ?? 1));
          setTotal(loaded.totalElements ?? 0);
        })
        .catch(() => {
          if (signal.aborted) return;
          setServices(null);
          setFailed(true);
          // 앞선 질의의 총계·장수가 "불러오지 못했습니다" 옆에 남지 않게 같이 비운다.
          setTotal(0);
          setPages(1);
        }),
    [reloadKey, page, debouncedQuery],
  );

  // 검색어가 바뀌면 onChange 에서 첫 장으로 되감지만, 재조회로 목록이 줄면 마지막
  // 페이지 밖에 남을 수 있다 — 빈 레일 대신 마지막 장으로.
  const safePage = Math.min(page, pages - 1);
  const pageRows = services ?? [];

  const s = serviceListStyles;

  return (
    <div className={s.split}>
      {/* 좌 — 서비스 레일. 우측 상세는 표·타일로 길어지므로 레일이 같이 늘어나면
          페이지 이동 버튼이 화면 밖으로 밀린다 — 뷰포트 높이에 고정하고 목록만 스크롤. */}
      <aside
        // top-14 = sticky TopNav(h-14) 아래. top-0 이면 레일 제목이 TopNav 밑으로 들어간다.
        className={cn(s.rail, s.railSticky)}
        aria-label="서비스 목록"
      >
        {/* 제목 + 개수. 검색 중에는 걸린 건수라 그대로 둔다. */}
        <div className={s.railHead}>
          <h1 className={s.railTitle}>서비스 운영</h1>
          {services != null && total > 0 && (
            <span className={s.railCount}>{total}</span>
          )}
        </div>
        <div className={s.railSearch}>
          <SearchBox
            // `block` alone leaves SearchBox's `inline-block` shrink-to-fit width.
            wrapClassName="block w-full"
            placeholder="ServiceCode·서비스명 검색"
            aria-label="ServiceCode·서비스명 검색"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className={s.railBody}>
          {failed ? (
            <div className="flex-1">
              <PlEmptyState
                onGround
                icon="search"
                message="서비스 목록을 불러오지 못했습니다."
                meta={
                  <PlButton variant="secondary" size="sm" onClick={reload}>
                    다시 시도
                  </PlButton>
                }
              />
            </div>
          ) : !services ? (
            <RailSkeleton section={query ? '검색 결과' : '전체 서비스'} />
          ) : pageRows.length === 0 ? (
            <div className="flex-1">
              <PlEmptyState onGround icon="search" message="검색 결과가 없습니다." />
            </div>
          ) : (
            <>
            <div className={s.railSection}>{query ? '검색 결과' : '전체 서비스'}</div>
            <div
              className={s.railList}
              // 행이 남은 높이를 나눠 가지므로 상한이 없으면 한 장이 짧을 때 행이
              // 레일 끝까지 늘어난다. 상한을 걸면 남는 높이는 마지막 행과 페이지 표시
              // 사이로 빠진다 — railFoot 의 mt-auto 가 표시를 바닥에 붙여 두기 때문.
              style={{ maxHeight: pageRows.length * ROW_MAX_PX }}
            >
              {/* 계약 스키마가 두 필드 모두 optional 이라(zod 느슨한 codegen) code 가
                  없는 행은 이동할 곳이 없다 — 그릴 수 없는 행이라 걸러 낸다. */}
              {pageRows.map((service) => {
                const code = service.service_code;
                if (!code) return null;
                const name = service.service_name ?? code;
                const active = code === selectedCode;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      if (active) return;
                      router.push(passRoutes.pipelines.ops.service(code));
                    }}
                    title={`${name} (${code})`}
                    aria-current={active ? 'true' : undefined}
                    className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                  >
                    <span
                      className={cn(serviceSidebarStyles.tile, serviceTileClass(code))}
                      aria-hidden="true"
                    >
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>
                      {name}
                    </span>
                    {/* EOS 배지는 여기 없다 — ServiceItem 에 그 필드가 없고, EOS 는
                        대상의 service_info 를 거쳐야 읽히므로 상세에서만 표시한다. */}
                    <span className={active ? s.codeActive : s.code}>{code}</span>
                  </button>
                );
              })}
            </div>
            </>
          )}
          {/* 한 장뿐이면 아무것도 그리지 않는다 — 갈 곳 없는 "1 / 1" 은 컨트롤이 아니다. */}
          <div className={s.railFoot}>
            <SidebarPagination
              pageInfo={{
                totalElements: total,
                totalPages: pages,
                number: safePage,
                size: RAIL_PAGE_SIZE,
              }}
              onPageChange={setPage}
            />
          </div>
        </div>
      </aside>

      {/* 우 — 선택한 서비스의 운영 상세. key 로 갈아끼워 이전 서비스 데이터가 남지 않게 한다. */}
      <section className={s.main}>
        {selectedCode ? (
          <ServiceDetailView key={selectedCode} serviceCode={selectedCode} />
        ) : (
          // 선택 전에도 같은 시트가 서 있어야 화면의 틀이 흔들리지 않는다. 다음 행동
          // ("서비스를 고르세요")만 primary 로 키워 시선이 좌측 레일로 가게 한다.
          <div className={cn(s.sheet, 'items-center justify-center')}>
            <PlEmptyState
              icon="cursor"
              message={
                <span className="text-[20px] font-bold text-[var(--pl-primary)]">
                  좌측에서 서비스를 선택해 주세요.
                </span>
              }
              meta={<span className="text-[16px]">서비스 현황을 상세 확인합니다.</span>}
            />
          </div>
        )}
      </section>
    </div>
  );
}
