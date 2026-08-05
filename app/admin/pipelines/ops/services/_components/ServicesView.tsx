'use client';

/**
 * 서비스 운영 — 좌측 서비스 레일 + 우측 상세 (서비스·대상 검색 /services 와 같은 split
 * 문법). 선택한 서비스는 PATH 에 있어(optional catch-all) 딥링크가 그대로 살아 있다.
 * 레일 상태(검색어·페이지)는 이 컴포넌트가 들고만 있고 URL 에 매어두지 않는다 — 현재
 * App Router 는 세그먼트가 바뀔 때 페이지를 다시 마운트해 처음 상태로 돌아가지만(/services
 * 레일과 같은 동작), 어느 쪽이든 화면이 성립하도록 초기값에 의존하는 로직은 두지 않았다.
 *
 * GET /admin/ops/services 는 배열 전체를 주므로 검색·페이지 자르기는 클라이언트 몫.
 */
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';
import { getOpsServices, type OpsServiceSummary } from '@/app/lib/api/ops';

// The rail pages the same everywhere it appears — see SERVICE_RAIL_PAGE_SIZE.
const RAIL_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;

/**
 * Ceiling for one stretched row. A full page divides the rail's height evenly, so
 * without a cap a tall monitor — or a two-row search result — would stretch each
 * row down the whole rail.
 */
const ROW_MAX_PX = 88;

export function ServicesView(): ReactElement {
  const router = useRouter();
  // Optional catch-all: `/ops/services` → 선택 없음, `/ops/services/{code}` → params[0].
  const params = useParams<{ serviceCode?: string[] }>();
  const selectedCode = params.serviceCode?.[0] ?? null;

  const [services, setServices] = useState<OpsServiceSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getOpsServices();
        if (cancelled) return;
        setFailed(false);
        setServices(loaded);
      } catch {
        if (cancelled) return;
        setServices(null);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    if (!services) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (service) =>
        service.service_code.toLowerCase().includes(needle)
        || service.service_name.toLowerCase().includes(needle),
    );
  }, [services, query]);

  // 검색어가 바뀌면 onChange 에서 1페이지로 되감지만, 재조회로 목록이 줄면 마지막
  // 페이지 밖에 남을 수 있다 — 빈 레일 대신 마지막 장으로.
  const pages = Math.max(1, Math.ceil(rows.length / RAIL_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = rows.slice((safePage - 1) * RAIL_PAGE_SIZE, safePage * RAIL_PAGE_SIZE);

  const s = serviceListStyles;

  return (
    <div className={s.split}>
      {/* 좌 — 서비스 레일. 우측 상세는 표·타일로 길어지므로 레일이 같이 늘어나면
          페이지 이동 버튼이 화면 밖으로 밀린다 — 뷰포트 높이에 고정하고 목록만 스크롤. */}
      <aside
        // top-14 = sticky TopNav(h-14) 아래. top-0 이면 레일 제목이 TopNav 밑으로 들어간다.
        className={cn(s.rail, 'sticky top-14 self-start h-[calc(100vh_-_56px)]')}
        aria-label="서비스 목록"
      >
        {/* 제목 + 개수. 검색 중에는 걸린 건수라 그대로 둔다. */}
        <div className={s.railHead}>
          <h1 className={s.railTitle}>서비스 운영</h1>
          {services != null && rows.length > 0 && (
            <span className={s.railCount}>{rows.length}</span>
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
              setPage(1);
            }}
          />
        </div>
        <div className={s.railBody}>
          {failed ? (
            <div className="flex-1">
              <PlEmptyState
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
            <div className="min-h-[240px] flex-1" aria-busy="true" />
          ) : pageRows.length === 0 ? (
            <div className="flex-1">
              <PlEmptyState icon="search" message="검색 결과가 없습니다." />
            </div>
          ) : (
            <>
            <div className={s.railSection}>{query ? '검색 결과' : '전체 서비스'}</div>
            <div
              className={s.railList}
              // 행이 남은 높이를 나눠 가지므로 상한이 없으면 한 장이 짧을 때 행이
              // 레일 끝까지 늘어난다. 상한을 걸면 남는 높이는 페이지 표시 아래로 빠진다.
              style={{ maxHeight: pageRows.length * ROW_MAX_PX }}
            >
              {pageRows.map((service) => {
                const active = service.service_code === selectedCode;
                return (
                  <button
                    key={service.service_code}
                    type="button"
                    onClick={() => {
                      if (active) return;
                      router.push(passRoutes.pipelines.ops.service(service.service_code));
                    }}
                    title={`${service.service_name} (${service.service_code})`}
                    aria-current={active ? 'true' : undefined}
                    className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                  >
                    <span
                      className={cn(
                        serviceSidebarStyles.tile,
                        serviceTileClass(service.service_code),
                      )}
                      aria-hidden="true"
                    >
                      {service.service_name.charAt(0).toUpperCase()}
                    </span>
                    <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>
                      {service.service_name}
                    </span>
                    {/* 운영중은 기본값이라 적지 않는다 — EOS 만 레일에서 읽혀야 한다.
                        코드 태그 왼쪽에 둬서 코드 열의 x 는 그대로 유지된다. */}
                    {service.status === 'EOS' && (
                      <span
                        className={cn(
                          opsStyles.statusTag,
                          'shrink-0 bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                        )}
                      >
                        EOS
                      </span>
                    )}
                    <span className={active ? s.codeActive : s.code}>
                      {service.service_code}
                    </span>
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
                totalElements: rows.length,
                totalPages: pages,
                number: safePage - 1,
                size: RAIL_PAGE_SIZE,
              }}
              onPageChange={(next) => setPage(next + 1)}
            />
          </div>
        </div>
      </aside>

      {/* 우 — 선택한 서비스의 운영 상세. key 로 갈아끼워 이전 서비스 데이터가 남지 않게 한다. */}
      <section className={s.main}>
        {selectedCode ? (
          <ServiceDetailView
            key={selectedCode}
            serviceCode={selectedCode}
            onServiceChanged={reload}
          />
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
