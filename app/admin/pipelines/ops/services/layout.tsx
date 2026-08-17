'use client';

/**
 * 서비스 운영 — 좌측 서비스 레일 + 우측 상세 (서비스·대상 검색 /services 와 같은 split
 * 문법). 선택한 서비스는 PATH 에 있어(optional catch-all) 딥링크가 그대로 살아 있다.
 *
 * ⛔ 레일은 page 가 아니라 이 LAYOUT 에 있어야 한다. 서비스 선택은 세그먼트를 바꾸는
 * 내비게이션이고, App Router 는 세그먼트가 바뀌면 page 를 언마운트했다가 다시 마운트한다
 * — 레일을 page 에 두면 서비스를 고를 때마다 레일 상태(목록·검색어·페이지)가 초기값으로
 * 돌아가고 `GET /user/services/page` 를 다시 부른다. 방금 읽고 있던 목록이 스켈레톤으로
 * 되돌아갔다가 (그 요청이 실패하면 "불러오지 못했습니다"로) 다시 서는 것이다. 레이아웃은
 * 자식 세그먼트가 바뀌어도 React 가 보존하므로, 클릭하면 우측 page 만 갈린다.
 *
 * 레일은 실계약 `GET /user/services/page` 하나로 선다 (서비스·대상 검색 레일과 같은
 * 소스). 검색·페이지가 계약의 `query`/`page`/`size` 파라미터라 자르기는 서버 몫이고,
 * 이 화면에는 클라이언트 필터가 없다. 레일이 EOS 배지를 달지 않는 이유도 여기 있다 —
 * ServiceItem 은 code·name 두 필드뿐이고, EOS 는 대상의 service_info 에만 실려
 * 상세에서만 읽을 수 있다.
 */
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { passRoutes } from '@/lib/routes';
import { useDebounce } from '@/app/hooks/useDebounce';
import { holdFor, SKELETON_MIN_MS } from '@/lib/min-duration';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { AdminServiceRail } from '@/app/admin/pipelines/_services/AdminServiceRail';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';
import { serviceItemsFrom, type ServiceItem } from '@/app/admin/pipelines/_services/logic';
import { getServicesPage } from '@/app/lib/api';

// The rail pages the same everywhere it appears — see SERVICE_RAIL_PAGE_SIZE.
const RAIL_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;

/** 서비스·대상 검색 레일과 같은 값 — 두 레일의 검색 감각이 갈리지 않게. */
const SEARCH_DEBOUNCE_MS = 300;

export default function OpsServicesLayout({ children }: { children: ReactNode }): ReactElement {
  const router = useRouter();
  // Optional catch-all: `/ops/services` → 선택 없음, `/ops/services/{code}` → params[0].
  // 레이아웃에서도 현재 URL 의 params 를 그대로 읽는다 (PathParamsContext 는 라우터
  // 루트가 URL 단위로 넣는다) — 선택 표시는 레일을 다시 세우지 않고 갱신된다.
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
  // deps 에 selectedCode 가 없는 것이 이 화면의 요점이다 — 선택은 우측만 바꾼다.
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

      {/* 우 — 선택한 서비스의 운영 상세. 세그먼트가 바뀌면 이 자리만 갈린다. */}
      <section className={s.main}>{children}</section>
    </div>
  );
}
