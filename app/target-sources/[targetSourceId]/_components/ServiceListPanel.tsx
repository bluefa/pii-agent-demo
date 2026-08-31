'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

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
import { useModal } from '@/app/hooks/useModal';
import { getServicesPage } from '@/app/lib/api';
import { passRoutes } from '@/lib/routes';
import { bgColors, borderColors, cn, serviceSidebarStyles, textColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';

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
  /**
   * `message` is what the UPSTREAM said, and it is optional because upstream does not
   * always say anything. The generic fallback is not stored — it is chosen at the render
   * site, where the reader's language is known.
   */
  | { type: 'FETCH_ERROR'; message?: string };

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
/** How long the move waits for the destination to answer before it gives up. */
const NAV_TIMEOUT_MS = 5000;

interface ServiceListPanelProps {
  /** The service this target source belongs to — pinned to the top of the list. */
  currentService: { code: string; name?: string };
}

export const ServiceListPanel = ({ currentService }: ServiceListPanelProps) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].detail;
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
  const [navPending, setNavPending] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

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
        message: err instanceof Error ? err.message : undefined,
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

  const handleConfirm = useCallback(async () => {
    const data = confirmModal.data;
    if (!data) return;
    setNavPending(true);
    // The router cannot be called back once it starts — a transition that resolves after
    // the deadline still commits, and the page would move under a dialog that already
    // said the move failed. So the deadline is spent on a request we CAN abort, one the
    // destination needs anyway, and the router is handed control only once that came back
    // in time. An answer arriving after the deadline is dropped, not followed.
    const controller = new AbortController();
    let timedOut = false;
    const deadline = setTimeout(() => {
      // The deadline reports the failure itself rather than leaving it to the catch:
      // that makes `timedOut` the single decision point below, and the guarantee holds
      // even if the aborted request settles instead of rejecting.
      timedOut = true;
      controller.abort();
      setNavPending(false);
      setNavError(t.navTimeout);
    }, NAV_TIMEOUT_MS);
    try {
      await getServicesPage(0, SERVICE_PAGE_SIZE, undefined, { signal: controller.signal });
      // A late answer is dropped, not followed: the dialog has already said the move
      // failed, and moving the page out from under that frame is the exact thing this
      // deadline exists to prevent.
      if (timedOut) return;
      // URL-driven selection — the query IS the service's deep link, and the casing
      // rule that goes with it lives on `passRoutes.service`.
      router.push(passRoutes.service(data.code));
    } catch {
      if (timedOut) return;
      // Pending clears, the failure stays: the dialog swaps to its error frame, whose
      // 다시 요청하기 runs this same handler again.
      setNavPending(false);
      setNavError(t.navFailed);
    } finally {
      clearTimeout(deadline);
    }
  }, [confirmModal.data, router, t]);

  // Closing discards the attempt — a reopened dialog must not inherit the last failure.
  const handleMoveClose = useCallback(() => {
    setNavPending(false);
    setNavError(null);
    confirmModal.close();
  }, [confirmModal]);

  const handleRetry = useCallback(() => {
    const attempted = lastAttemptedRef.current;
    dispatch({ type: 'FETCH_LOADING' });
    void fetchServicesPage(attempted.page, attempted.query);
  }, [fetchServicesPage]);

  const isInitialLoading = fetchState.status === 'loading' && services.length === 0;

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
          {fetchState.message ?? t.servicesFailed}
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
          {t.retry}
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
          onClose={handleMoveClose}
          onConfirm={handleConfirm}
          onRetry={handleConfirm}
          isPending={navPending}
          errorReason={navError}
        />
      )}
    </>
  );
};
