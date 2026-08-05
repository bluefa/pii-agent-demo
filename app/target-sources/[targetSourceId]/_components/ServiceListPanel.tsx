'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ServiceSidebar } from '@/app/components/features/admin/ServiceSidebar';
import {
  buildInitialServiceListState,
  serviceListReducer,
  type ServiceListAction,
  type ServiceListState,
} from '@/app/components/features/admin-dashboard/serviceListReducer';
import { useModal } from '@/app/hooks/useModal';
import { getServicesPage } from '@/app/lib/api';
import { passRoutes } from '@/lib/routes';
import { bgColors, borderColors, cn, serviceSidebarStyles, textColors } from '@/lib/theme';

const ServiceMoveConfirmModal = dynamic(
  () =>
    import(
      '@/app/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal'
    ).then((m) => ({ default: m.ServiceMoveConfirmModal })),
  { ssr: false },
);

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

// 15, sized against the rail's geometry rather than a round number: the list
// card's viewport share is panel height (100vh − 56px TopNav) minus ~250px of
// fixed chrome (title, current-service card, search, section label, footer),
// and rows are 40px — so a 900px-tall window fits ~15 rows with no inner
// scroll and 1080p leaves headroom. At ~100 services that is 7 pages; search
// stays the primary lookup path, paging is the browse fallback.
const SERVICE_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

interface ServiceListPanelProps {
  /** The service this target source belongs to — pinned to the top of the list. */
  currentService: { code: string; name?: string };
}

export const ServiceListPanel = ({ currentService }: ServiceListPanelProps) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(panelReducer, undefined, buildInitialPanelState);
  const { services, query, pageInfo } = state.list;
  const fetchState = state.fetch;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Last attempted fetch arguments — set on every fetch entry so retry can
  // re-issue the failed attempt rather than the last successful pageInfo.
  const lastAttemptedRef = useRef<{ page: number; query?: string }>({ page: 0 });
  const confirmModal = useModal<ConfirmModalData>();

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    lastAttemptedRef.current = { page, query: searchQuery };
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
      const content = data.content ?? [];
      const pageInfo = {
        totalElements: data.totalElements ?? 0,
        totalPages: data.totalPages ?? 0,
        number: data.number ?? 0,
        size: data.size ?? SERVICE_PAGE_SIZE,
      };
      // Page out-of-range fallback: reset to page 0 and refetch with the same query.
      if (page > 0 && page >= pageInfo.totalPages) {
        dispatch({ type: 'SET_PAGE', pageNum: 0 });
        lastAttemptedRef.current = { page: 0, query: searchQuery };
        const fallbackController = new AbortController();
        abortRef.current = fallbackController;
        const fallback = await getServicesPage(
          0,
          SERVICE_PAGE_SIZE,
          searchQuery || undefined,
          { signal: fallbackController.signal },
        );
        if (fallbackController.signal.aborted) return;
        const fallbackContent = fallback.content ?? [];
        const fallbackPageInfo = {
          totalElements: fallback.totalElements ?? 0,
          totalPages: fallback.totalPages ?? 0,
          number: fallback.number ?? 0,
          size: fallback.size ?? SERVICE_PAGE_SIZE,
        };
        dispatch({ type: 'SET_SERVICES', services: fallbackContent, pageInfo: fallbackPageInfo });
        return;
      }
      dispatch({ type: 'SET_SERVICES', services: content, pageInfo });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({
        type: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : '서비스 목록을 불러오지 못했습니다.',
      });
    }
  }, []);

  // Initial fetch on mount.
  useEffect(() => {
    void fetchServicesPage(0);
  }, [fetchServicesPage]);

  // Cleanup debounce on unmount. We do NOT abort the in-flight fetch here —
  // StrictMode's invariance check fires this cleanup between two setup phases
  // and would kill the very fetch initial-mount just started, leaving the
  // skeleton stuck. fetchServicesPage already aborts the previous controller
  // on every new call, covering the typing/pagination races.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectService = useCallback((code: string) => {
    // The pinned current service is not necessarily on the loaded page, so fall
    // back to its own name rather than swallowing the click.
    const name = services.find((s) => s.service_code === code)?.service_name
      ?? (code === currentService.code ? currentService.name : undefined);
    confirmModal.open({ code, name: name ?? '' });
  }, [services, currentService, confirmModal]);

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
    // URL-driven selection: the services page reads `?service_code=`. Preserve
    // the original casing — the target-sources lookup is case-sensitive (404 on
    // a wrong-case code).
    router.push(
      `${passRoutes.services}?service_code=${encodeURIComponent(confirmModal.data.code)}`,
    );
  }, [confirmModal.data, router]);

  const handleRetry = useCallback(() => {
    const attempted = lastAttemptedRef.current;
    dispatch({ type: 'FETCH_LOADING' });
    void fetchServicesPage(attempted.page, attempted.query);
  }, [fetchServicesPage]);

  const isInitialLoading = fetchState.status === 'loading' && services.length === 0;

  if (fetchState.status === 'error') {
    return (
      // Same canvas plane as ServiceSidebar — a failed fetch must not hand back a
      // differently-grounded rail than the successful path uses.
      <aside
        className={cn(
          'w-[296px] shrink-0 flex flex-col items-center justify-center border-r px-4 gap-3',
          serviceSidebarStyles.ground,
          borderColors.default,
        )}
      >
        <p className={cn('text-sm text-center', textColors.secondary)}>
          {fetchState.message ?? '서비스 목록을 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className={cn(
            'text-xs px-3 py-1.5 rounded-md border transition-colors',
            borderColors.strong,
            bgColors.mutedHover,
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
        currentService={currentService}
        onSelectService={handleSelectService}
        searchQuery={query}
        onSearchChange={handleSearchChange}
        pageInfo={pageInfo}
        onPageChange={handlePageChange}
        loading={isInitialLoading}
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
