'use client';

/**
 * 서비스 운영 — 좌측 서비스 레일 + 우측 상세 (서비스·대상 검색 /services 와 같은 split
 * 문법). 선택한 서비스는 PATH 에 있어(optional catch-all) 딥링크가 그대로 살아 있다.
 * URL 이 바뀌면 App Router 가 페이지를 다시 마운트하므로 레일의 검색어·페이지는 처음
 * 상태로 돌아간다 — /services 레일과 같은 동작이다.
 *
 * GET /admin/ops/services 는 배열 전체를 주므로 검색·페이지 자르기는 클라이언트 몫.
 */
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';
import { getOpsServices, type OpsServiceSummary } from '@/app/lib/api/ops';

const RAIL_PAGE_SIZE = 10;

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
        <h1 className={s.railTitle}>서비스 운영</h1>
        <SearchBox
          wrapClassName="block mb-3"
          placeholder="ServiceCode·서비스명 검색"
          aria-label="ServiceCode·서비스명 검색"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
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
          <div className={s.railList}>
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
                  className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                >
                  <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>
                    {service.service_name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={s.code}>{service.service_code}</span>
                    {/* 운영중은 기본값이라 적지 않는다 — EOS 만 레일에서 읽혀야 한다. */}
                    {service.status === 'EOS' && (
                      <span
                        className={cn(
                          opsStyles.statusTag,
                          'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                        )}
                      >
                        EOS
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className={s.railFoot}>
          <PlPagination
            page={safePage}
            pages={pages}
            onPrev={() => setPage((n) => Math.max(1, n - 1))}
            onNext={() => setPage((n) => Math.min(pages, n + 1))}
          />
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
          // 빈 화면은 카드도 표도 없어 기준선이 없다 — 패널 한가운데에 놓고, 다음 행동
          // ("서비스를 고르세요")만 primary 로 키워 시선이 좌측 레일로 가게 한다.
          <div className="flex h-full items-center justify-center">
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
