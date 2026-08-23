'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  ServiceSidebar,
  SERVICE_RAIL_PAGE_SIZE,
} from '@/app/components/features/admin/ServiceSidebar';
import {
  buildInitialServiceListState,
  serviceListReducer,
  type ServiceListAction,
  type ServiceListState,
} from '@/app/components/features/admin-dashboard/serviceListReducer';
import { RailToggle, useRailCollapse } from '@/app/components/ui/RailCollapse';
import { useModal } from '@/app/hooks/useModal';
import { getServicesPage } from '@/app/lib/api';
import { passRoutes } from '@/lib/routes';
import {
  bgColors,
  borderColors,
  cn,
  railStyles,
  serviceSidebarStyles,
  textColors,
} from '@/lib/theme';

/**
 * Versioned, and not keyed by target source: how much of the screen a reader wants spent
 * on the switcher is a workspace preference. Sibling of the guide rail's own key.
 *
 * No `openMinWidth` at the call site below, unlike the guide rail — this rail is open at
 * every width today and stays that way. Folding it is a thing the reader may now DO, not
 * a thing the viewport decides for them; changing its resting state was not asked for.
 */
const SERVICE_RAIL_STORAGE_KEY = 'pii:rail:v1:services';

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
}

// Page size belongs to the rail, not to this page — see SERVICE_RAIL_PAGE_SIZE.
const SERVICE_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;
const SEARCH_DEBOUNCE_MS = 300;

interface ServiceListPanelProps {
  /** The service this target source belongs to — pinned to the top of the list. */
  currentService: { code: string; name?: string };
}

export const ServiceListPanel = ({ currentService }: ServiceListPanelProps) => {
  const router = useRouter();
  const { collapsed, toggle } = useRailCollapse(SERVICE_RAIL_STORAGE_KEY);
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
    confirmModal.open({ code });
  }, [confirmModal]);

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

  // Folded — and folded ahead of the error branch, because a rail the reader has put
  // away should stay away whether or not the list behind it happens to be failing.
  // `collapsed` is null only until the preference resolves, and this rail's default is
  // open, so null paints the open rail: no media query needed on this side.
  if (collapsed) {
    return (
      <aside
        aria-label="서비스 목록"
        className={cn(
          railStyles.collapsedWidth,
          'flex shrink-0 border-r',
          railStyles.strip,
          serviceSidebarStyles.surface,
          borderColors.default,
        )}
      >
        <RailToggle
          direction="right"
          label="서비스 목록 펼치기"
          plane="tint"
          onClick={toggle}
        />
      </aside>
    );
  }

  if (fetchState.status === 'error') {
    return (
      // Same flush plane as ServiceSidebar — a failed fetch must not hand back a
      // differently-grounded rail than the successful path uses.
      <aside
        className={cn(
          'w-[296px] shrink-0 flex flex-col items-center justify-center border-r px-4 gap-3',
          serviceSidebarStyles.surface,
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
            // 흰색 hover — mutedHover(gray-50)는 틴트 레일 위에서 1.03 이라 안 보인다.
            bgColors.surfaceHover,
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
        onCollapse={toggle}
      />
      {confirmModal.data && (
        <ServiceMoveConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={confirmModal.close}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
};
