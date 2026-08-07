'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { ProjectCreateModal } from '@/app/components/features/ProjectCreateModal';
import { useToast } from '@/app/components/ui/toast';
import {
  getProjects,
  getServicesPage,
} from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import type { ProjectSummary } from '@/lib/types';
import { passRoutes } from '@/lib/routes';
import { bgColors, cn, serviceSidebarStyles, textColors } from '@/lib/theme';
import {
  ServiceSidebar,
  SERVICE_RAIL_PAGE_SIZE,
} from '@/app/components/features/admin/ServiceSidebar';
import {
  InfraRowList,
  ServiceHeaderV7,
  type InfraRowAction,
} from '@/app/components/features/admin/v7';
import {
  buildInitialServiceListState,
  serviceListReducer,
} from '@/app/components/features/admin-dashboard/serviceListReducer';

// Page size belongs to the rail, not to this page — see SERVICE_RAIL_PAGE_SIZE.
const SERVICE_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;
const SEARCH_DEBOUNCE_MS = 300;

// Selection is URL-driven: the `?service_code=` query is the single source of
// truth, replacing the old module-variable handoff. Sidebar search/pagination
// stay in local state (not in the URL — only the selected service is shareable).
export const ServiceManagementView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const selectedService = searchParams.get('service_code');

  const [serviceList, dispatch] = useReducer(
    serviceListReducer,
    undefined,
    buildInitialServiceListState,
  );
  const { services, query: serviceQuery, pageInfo: servicePageInfo } = serviceList;

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Keyed to the code it belongs to. Clearing it in an effect instead would still let
  // one render pair the new code with the previous service's name — the effect runs
  // after that paint. Derived at render, the pair can never come apart.
  const [resolvedName, setResolvedName] = useState<{ code: string; name: string } | null>(null);
  const selectedName = resolvedName?.code === selectedService ? resolvedName.name : '';

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Guards the sidebar's initial load so it runs once per mount (see init effect).
  const initRef = useRef(false);

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getServicesPage(page, SERVICE_PAGE_SIZE, searchQuery || undefined, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      dispatch({
        type: 'SET_SERVICES',
        services: data.content ?? [],
        pageInfo: {
          totalElements: data.totalElements ?? 0,
          totalPages: data.totalPages ?? 0,
          number: data.number ?? page,
          size: data.size ?? SERVICE_PAGE_SIZE,
        },
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof AppError && err.code === 'ABORTED') return;
      toast.error(err instanceof Error ? err.message : '서비스 목록 조회 실패');
    }
  }, [toast]);

  // Initial sidebar load (runs once) — always page 0, unfiltered. A deep-linked
  // ?service_code= used to pre-fill the search box with the code so the selection
  // would surface on page 0; the sidebar now pins the current service above the
  // list on its own, so the list no longer has to be filtered to show it.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void fetchServicesPage(0);
  }, [fetchServicesPage]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // The selected service may live on a later page, so its name can't be read off
  // the loaded page. Resolve it once per selection with a query-scoped lookup that
  // never touches the visible list.
  useEffect(() => {
    if (!selectedService) return;
    let cancelled = false;
    getServicesPage(0, SERVICE_PAGE_SIZE, selectedService)
      .then((data) => {
        if (cancelled) return;
        const hit = (data.content ?? []).find((s) => s.service_code === selectedService);
        setResolvedName({ code: selectedService, name: hit?.service_name ?? '' });
      })
      .catch(() => {
        // Name is decoration — the code alone still identifies the service.
        if (!cancelled) setResolvedName({ code: selectedService, name: '' });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedService]);

  // Fetch the selected service's target sources. Race guard: a stale in-flight
  // response for a previously-selected service must not overwrite the panel.
  useEffect(() => {
    if (!selectedService) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setProjects([]);
    getProjects(selectedService)
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : '타겟소스 목록 조회 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedService, toast]);

  const refreshProjects = useCallback(async () => {
    if (!selectedService) return;
    setLoading(true);
    try {
      setProjects(await getProjects(selectedService));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '타겟소스 목록 새로고침 실패');
    } finally {
      setLoading(false);
    }
  }, [selectedService, toast]);

  const handleSelectService = useCallback(
    (code: string) => {
      // Preserve the original casing — /services/{code}/target-sources matches
      // case-sensitively (a wrong-case code 404s).
      router.push(`${passRoutes.services}?service_code=${encodeURIComponent(code)}`);
    },
    [router],
  );

  const handleSearchChange = useCallback(
    (newQuery: string) => {
      dispatch({ type: 'SET_QUERY', query: newQuery });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchServicesPage(0, newQuery);
      }, SEARCH_DEBOUNCE_MS);
    },
    [fetchServicesPage],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchServicesPage(page, serviceQuery);
    },
    [fetchServicesPage, serviceQuery],
  );

  const handleOpenDetail = useCallback(
    (targetSourceId: number) => {
      router.push(passRoutes.targetSource(targetSourceId));
    },
    [router],
  );

  const handleManageAction = useCallback(
    // A switch, not an if-chain ending in `else → delete`: a fourth action added to
    // InfraRowAction would otherwise fall silently into "삭제 미구현" with no type error.
    (action: InfraRowAction, targetSourceId: number) => {
      switch (action) {
        case 'view':
          router.push(passRoutes.targetSource(targetSourceId));
          return;
        case 'copyId':
          // Support asks for this id; the owner never needs to read it off the screen.
          // The whole call is inside try/catch: on an insecure origin `navigator
          // .clipboard` is undefined, and that throws synchronously — a .catch() on
          // the promise never sees it, so the click would give no feedback at all.
          void (async () => {
            try {
              await navigator.clipboard.writeText(String(targetSourceId));
              toast.success(`Target Source ID ${targetSourceId} 복사됨`);
            } catch {
              toast.error('클립보드 복사 실패');
            }
          })();
          return;
        case 'delete':
          toast.info('삭제 미구현');
      }
    },
    [router, toast],
  );

  const openCreateModal = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
  }, []);

  return (
    // Exact viewport minus the sticky 56px TopNav — `min-h-screen` here stacked a
    // full 100vh under the nav, so the page scrolled 56px and the left panel ended
    // short of the bottom edge.
    // 바닥은 gray-50 이 아니라 앱 캔버스 — /target-sources 가 쓰는 바닥과 같아야
    // 같은 레일이 두 화면에서 같은 대비를 갖는다. gray-50 위에서는 흰 카드가
    // ΔE00 1.20(식별 한계 아래)이라 테두리에만 기대고 있었다.
    <div className={cn('h-[calc(100vh-56px)]', serviceSidebarStyles.canvas)}>
      <div className="flex h-full">
        <ServiceSidebar
          services={services}
          currentService={selectedService ? { code: selectedService, name: selectedName } : null}
          onSelectService={handleSelectService}
          searchQuery={serviceQuery}
          onSearchChange={handleSearchChange}
          pageInfo={servicePageInfo}
          onPageChange={handlePageChange}
        />

        <main className={cn('flex-1 p-6 overflow-auto', serviceSidebarStyles.canvas)}>
          {!selectedService ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div
                  className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    bgColors.muted,
                  )}
                >
                  <svg
                    className={cn('w-8 h-8', textColors.quaternary)}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className={textColors.tertiary}>서비스를 선택하세요</p>
              </div>
            </div>
          ) : (
            // Rows carry a fixed 40px mark, three text layers and a right-hand action
            // pair — past ~880px the middle column stretches and the eye loses the
            // line it is reading. The cap is the row's, not the viewport's.
            <div className="max-w-[880px]">
              <Breadcrumb
                crumbs={[
                  { label: 'SIT Home', href: '/' },
                  { label: '서비스 목록' },
                ]}
              />
              <ServiceHeaderV7
                serviceCode={selectedService}
                serviceName={selectedName}
                onAddInfra={openCreateModal}
              />

              <InfraRowList
                projects={projects}
                loading={loading}
                onAddInfra={openCreateModal}
                onOpenDetail={handleOpenDetail}
                onManageAction={handleManageAction}
              />
            </div>
          )}
        </main>
      </div>

      {createOpen && selectedService && (
        <ProjectCreateModal
          selectedServiceCode={selectedService}
          onClose={closeCreateModal}
          onCreated={refreshProjects}
        />
      )}
    </div>
  );
};
