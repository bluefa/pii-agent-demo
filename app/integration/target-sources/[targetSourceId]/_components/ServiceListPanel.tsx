'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ServiceSidebar } from '@/app/components/features/admin';
import {
  buildInitialServiceListState,
  serviceListReducer,
  type ServiceListState,
  type ServiceListAction,
} from '@/app/components/features/admin-dashboard';
import { setPendingAdminNavigation } from '@/app/components/features/admin-dashboard/pendingAdminNavigation';
import { useModal } from '@/app/hooks/useModal';
import { getServicesPage } from '@/app/lib/api';
import { integrationRoutes } from '@/lib/routes';
import { cn, statusColors, textColors } from '@/lib/theme';

import { ServiceMoveConfirmModal } from './ServiceMoveConfirmModal';

type FetchStatus = 'loading' | 'ready' | 'error';

interface PanelState {
  list: ServiceListState;
  fetch: { status: FetchStatus; message?: string };
}

type PanelAction =
  | ServiceListAction
  | { type: 'FETCH_LOADING' }
  | { type: 'FETCH_ERROR'; message: string };

const buildInitialPanelState = (): PanelState => ({
  list: buildInitialServiceListState(),
  fetch: { status: 'loading' },
});

const panelReducer = (state: PanelState, action: PanelAction): PanelState => {
  switch (action.type) {
    case 'FETCH_LOADING':
      return { ...state, fetch: { status: 'loading' } };
    case 'FETCH_ERROR':
      return { ...state, fetch: { status: 'error', message: action.message } };
    case 'SET_SERVICES':
      return {
        list: serviceListReducer(state.list, action),
        fetch: { status: 'ready' },
      };
    default:
      return { ...state, list: serviceListReducer(state.list, action) };
  }
};

interface ConfirmModalData {
  code: string;
  name: string;
}

const SERVICE_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export const ServiceListPanel = () => {
  const router = useRouter();
  const [state, dispatch] = useReducer(panelReducer, undefined, buildInitialPanelState);
  const { services, query, pageInfo } = state.list;
  const fetchState = state.fetch;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const confirmModal = useModal<ConfirmModalData>();

  // Stable ref to the latest fetcher. The out-of-range branch needs to
  // re-call itself, but `react-hooks/immutability` disallows referencing a
  // useCallback's name inside its own body — so we route the retry through
  // this ref. The ref is updated by the effect below on every render.
  const fetchServicesPageRef = useRef<(page: number, searchQuery?: string) => Promise<void>>(
    () => Promise.resolve(),
  );

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getServicesPage(
        page,
        SERVICE_PAGE_SIZE,
        searchQuery || undefined,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      // page out-of-range fallback: reset to page 0 and refetch.
      if (page > 0 && page >= data.page.totalPages) {
        dispatch({ type: 'SET_PAGE', pageNum: 0 });
        void fetchServicesPageRef.current(0, searchQuery);
        return;
      }
      dispatch({ type: 'SET_SERVICES', services: data.content, pageInfo: data.page });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({
        type: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : '서비스 목록을 불러오지 못했습니다.',
      });
    }
  }, []);

  useEffect(() => {
    fetchServicesPageRef.current = fetchServicesPage;
  }, [fetchServicesPage]);

  // Initial fetch on mount.
  useEffect(() => {
    void fetchServicesPage(0);
  }, [fetchServicesPage]);

  // Cleanup on unmount: clear debounce and cancel any in-flight request.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const handleSelectService = useCallback((code: string) => {
    const svc = services.find((s) => s.code === code);
    if (!svc) return;
    confirmModal.open({ code: svc.code, name: svc.name });
  }, [services, confirmModal]);

  const handleSearchChange = useCallback((newQuery: string) => {
    dispatch({ type: 'SET_QUERY', query: newQuery });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'SET_PAGE', pageNum: 0 });
      dispatch({ type: 'FETCH_LOADING' });
      void fetchServicesPage(0, newQuery);
    }, SEARCH_DEBOUNCE_MS);
  }, [fetchServicesPage]);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', pageNum: page });
    dispatch({ type: 'FETCH_LOADING' });
    void fetchServicesPage(page, query);
  }, [fetchServicesPage, query]);

  const handleConfirm = useCallback(() => {
    if (!confirmModal.data) return;
    // setPendingAdminNavigation must be the immediate predecessor of
    // router.push — no other code in between, so the payload is consumed
    // by the same SPA instance during the soft navigation.
    setPendingAdminNavigation({
      selectedService: confirmModal.data.code,
      searchQuery: query,
      pageNumber: pageInfo.number,
    });
    router.push(integrationRoutes.admin);
  }, [confirmModal.data, query, pageInfo.number, router]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'FETCH_LOADING' });
    void fetchServicesPage(pageInfo.number, query);
  }, [fetchServicesPage, pageInfo.number, query]);

  const isInitialLoading = fetchState.status === 'loading' && services.length === 0;

  if (isInitialLoading) {
    return (
      <aside className="w-[280px] shrink-0 bg-white shadow-sm flex items-center justify-center">
        <span
          className={cn(
            'w-5 h-5 border-2 border-t-transparent rounded-full animate-spin',
            statusColors.pending.border,
          )}
          aria-label="서비스 목록 로딩 중"
        />
      </aside>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <aside className="w-[280px] shrink-0 bg-white shadow-sm flex flex-col items-center justify-center px-4 gap-3">
        <p className={cn('text-sm text-center', textColors.secondary)}>
          {fetchState.message ?? '서비스 목록을 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className={cn(
            'text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors',
            textColors.secondary,
          )}
        >
          다시 시도
        </button>
      </aside>
    );
  }

  return (
    <>
      <ServiceSidebar
        services={services}
        selectedService={null}
        onSelectService={handleSelectService}
        projectCount={0}
        searchQuery={query}
        onSearchChange={handleSearchChange}
        pageInfo={pageInfo}
        onPageChange={handlePageChange}
      />
      {confirmModal.data && (
        <ServiceMoveConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={confirmModal.close}
          onConfirm={handleConfirm}
          serviceCode={confirmModal.data.code}
          serviceName={confirmModal.data.name}
        />
      )}
    </>
  );
};
