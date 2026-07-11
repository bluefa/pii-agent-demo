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
import { integrationRoutes } from '@/lib/routes';
import { bgColors, cn, textColors } from '@/lib/theme';
import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';
import { InfraRowList, ServiceHeaderV7 } from '@/app/components/features/admin/v7';
import {
  buildInitialServiceListState,
  serviceListReducer,
} from '@/app/components/features/admin-dashboard/serviceListReducer';

const SERVICE_PAGE_SIZE = 10;
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Surface the deep-linked service exactly once on entry (see init effect).
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

  // Initial sidebar load (runs once). When deep-linked with ?service_code=, the
  // sidebar can't know which page the service lives on (no page-index API), so
  // filter the list to that code so the selection surfaces and highlights on
  // page 0. Plain entry loads page 0 unfiltered. After this one-shot, the user
  // can search/paginate freely without the selection re-filtering the list.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (selectedService) {
      dispatch({ type: 'SET_QUERY', query: selectedService });
      void fetchServicesPage(0, selectedService);
    } else {
      void fetchServicesPage(0);
    }
  }, [selectedService, fetchServicesPage]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectedServiceObj = services.find((s) => s.service_code === selectedService);

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
      router.push(`${integrationRoutes.services}?service_code=${encodeURIComponent(code)}`);
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
      router.push(integrationRoutes.targetSource(targetSourceId));
    },
    [router],
  );

  const handleManageAction = useCallback(
    (action: 'view' | 'delete', targetSourceId: number) => {
      if (action === 'view') {
        router.push(integrationRoutes.targetSource(targetSourceId));
        return;
      }
      toast.info('삭제 미구현');
    },
    [router, toast],
  );

  const openCreateModal = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const selectedName = selectedServiceObj?.service_name ?? '';

  return (
    <div className={cn('min-h-screen', bgColors.muted)}>
      <div className="flex h-[calc(100vh-56px)]">
        <ServiceSidebar
          services={services}
          selectedService={selectedService}
          onSelectService={handleSelectService}
          projectCount={projects.length}
          searchQuery={serviceQuery}
          onSearchChange={handleSearchChange}
          pageInfo={servicePageInfo}
          onPageChange={handlePageChange}
        />

        <main className={cn('flex-1 p-6 overflow-auto', bgColors.muted)}>
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
            <div>
              <Breadcrumb
                crumbs={[
                  { label: 'SIT Home', href: '/' },
                  { label: 'Service List' },
                ]}
              />
              <ServiceHeaderV7
                serviceCode={selectedService}
                serviceName={selectedName}
                totalInfraCount={projects.length}
                lastUpdatedAt={null}
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
