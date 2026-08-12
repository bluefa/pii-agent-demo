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
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { useDebounce } from '@/app/hooks/useDebounce';
import { holdFor, SKELETON_MIN_MS } from '@/lib/min-duration';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { AdminServiceRail } from '@/app/admin/pipelines/_services/AdminServiceRail';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import { serviceItemsFrom, type ServiceItem } from '@/app/admin/pipelines/_services/logic';
import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';
import { getServicesPage } from '@/app/lib/api';

// The rail pages the same everywhere it appears — see SERVICE_RAIL_PAGE_SIZE.
const RAIL_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;

/** 서비스·대상 검색 레일과 같은 값 — 두 레일의 검색 감각이 갈리지 않게. */
const SEARCH_DEBOUNCE_MS = 300;

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
    (signal) => {
      // 스켈레톤이 한 번 떴으면 최소 시간을 채운 뒤에 데이터를 반영한다 — 목이 20ms 만에
      // 답하는 화면에서 한 프레임 번쩍이고 사라지면 읽히지도 않고 화면만 불안해 보인다.
      const startedAt = Date.now();
      return getServicesPage(page, RAIL_PAGE_SIZE, debouncedQuery || undefined, { signal })
        .then(async (loaded) => {
          await holdFor(startedAt, SKELETON_MIN_MS, signal);
          if (signal.aborted) return;
          const nextPages = Math.max(1, loaded.totalPages ?? 1);
          // 목록이 줄어 요청한 페이지가 범위를 벗어났으면 상태를 되감아 다시 부른다.
          // 라벨만 클램프하면 요청은 계속 빈 페이지를 향하고, 화면은 "3 / 3 페이지"에
          // 빈 목록을 띄운 채 굳는다 — 페이지 버튼도 이미 그 값이라 눌러도 안 움직인다.
          if (page > nextPages - 1) {
            setPage(nextPages - 1);
            return;
          }
          setFailed(false);
          setServices(serviceItemsFrom(loaded));
          setPages(nextPages);
          setTotal(loaded.totalElements ?? 0);
        })
        .catch(async () => {
          await holdFor(startedAt, SKELETON_MIN_MS, signal);
          if (signal.aborted) return;
          setServices(null);
          setFailed(true);
          // 앞선 질의의 총계·장수가 "불러오지 못했습니다" 옆에 남지 않게 같이 비운다.
          setTotal(0);
          setPages(1);
        });
    },
    [reloadKey, page, debouncedQuery],
  );

  const safePage = Math.min(page, pages - 1);
  const pageRows = services ?? [];

  const s = serviceListStyles;

  return (
    <div className={s.split}>
      {/* 좌 — 서비스 레일. 서비스·대상 검색 화면과 같은 컴포넌트다. */}
      <AdminServiceRail
        title="서비스 운영"
        total={services != null ? total : null}
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
        searchPlaceholder="ServiceCode·서비스명 검색"
        services={pageRows}
        loading={!failed && services == null}
        error={
          failed
            ? {
                message: '서비스 목록을 불러오지 못했습니다.',
                // 첫 장으로 되감고 다시 부른다. 범위를 벗어난 페이지가 실패의
                // 원인이었다면, 같은 페이지로 재시도해봐야 같은 실패만 반복된다.
                onRetry: () => {
                  setPage(0);
                  reload();
                },
              }
            : null
        }
        selectedCode={selectedCode}
        onSelectService={(code) => router.push(passRoutes.pipelines.ops.service(code))}
        pageInfo={{
          totalElements: total,
          totalPages: pages,
          number: safePage,
          size: RAIL_PAGE_SIZE,
        }}
        onPageChange={setPage}
      />

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
