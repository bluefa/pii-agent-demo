'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

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

/**
 * A resolved panel and the service it resolved for. Exactly one of `items`/`error`
 * is set: a fetch either produced a list or a reason it could not.
 */
type ProjectsState =
  | { code: string; items: ProjectSummary[]; error?: undefined }
  | { code: string; items?: undefined; error: string };

// Selection is URL-driven: the `?service_code=` query is the single source of
// truth, replacing the old module-variable handoff. Sidebar search/pagination
// stay in local state (not in the URL — only the selected service is shareable).
export const ServiceManagementView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const selectedService = searchParams.get('service_code');
  // Read by `loadProjects` when its request finally settles, which can be long after
  // the render that started it — the closed-over value would be the old selection.
  const selectedServiceRef = useRef(selectedService);
  selectedServiceRef.current = selectedService;

  const [serviceList, dispatch] = useReducer(
    serviceListReducer,
    undefined,
    buildInitialServiceListState,
  );
  const { services, query: serviceQuery, pageInfo: servicePageInfo } = serviceList;

  // Three states, and the value carries the code it belongs to — the same shape as
  // `resolvedName` below, for the same reason. `null` is "not resolved yet", distinct
  // from `{ items: [] }` = "resolved, and there are none"; a `[]` start made the first
  // paint of every service claim 등록된 연동 대상이 없습니다 before the request had even
  // been made. `error` is the third: a failed fetch must not render as "this service has
  // no accounts", which is a claim we cannot make.
  //
  // Keying to `code` is what makes a late response harmless. Both writers stamp their
  // own code, and the render below discards anything that does not match the current
  // selection, so neither a slow `refreshProjects` nor a slow effect can paint service
  // A's rows under service B's header.
  const [projects, setProjects] = useState<ProjectsState | null>(null);
  const [loading, setLoading] = useState(false);
  // Same idea for the rail, which owns a skeleton it was never being handed the cue for.
  // Only the first page counts: later searches keep the rows on screen rather than
  // blinking the whole rail to skeleton on every keystroke.
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Keyed to the code it belongs to. Clearing it in an effect instead would still let
  // one render pair the new code with the previous service's name — the effect runs
  // after that paint. Derived at render, the pair can never come apart.
  const [resolvedName, setResolvedName] = useState<{ code: string; name: string } | null>(null);
  const selectedName = resolvedName?.code === selectedService ? resolvedName.name : '';
  const panel = projects?.code === selectedService ? projects : null;

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
    } finally {
      // Also on failure: a rail stuck in skeleton forever tells the user less than
      // the empty state does, and the toast already carried the error.
      if (!controller.signal.aborted) setServicesLoaded(true);
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

  // The one loader both the effect and the manual refresh go through, so the race
  // guard cannot be applied to one path and forgotten on the other — which is exactly
  // what happened when `refreshProjects` was written separately. `getProjects` takes
  // no AbortSignal, so a late response cannot be cancelled; stamping the code it was
  // asked for is what makes arriving late harmless.
  const loadProjects = useCallback(
    async (code: string, failureMessage: string) => {
      setLoading(true);
      try {
        const items = await getProjects(code);
        setProjects({ code, items });
      } catch (err) {
        const message = err instanceof Error ? err.message : failureMessage;
        setProjects({ code, error: message });
        toast.error(message);
      } finally {
        // Stale too: a response for a code the user has since left must not clear the
        // flag belonging to the request that replaced it.
        setLoading((prev) => (code === selectedServiceRef.current ? false : prev));
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!selectedService) {
      setProjects(null);
      return;
    }
    setProjects(null);
    void loadProjects(selectedService, '타겟소스 목록 조회 실패');
  }, [selectedService, loadProjects]);

  const refreshProjects = useCallback(async () => {
    if (!selectedService) return;
    await loadProjects(selectedService, '타겟소스 목록 새로고침 실패');
  }, [selectedService, loadProjects]);

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
    // Exact viewport minus the sticky 76px TopNav — `min-h-screen` here stacked a
    // full 100vh under the nav, so the page scrolled 76px and the left panel ended
    // short of the bottom edge.
    // 바닥은 gray-50 이 아니라 앱 캔버스 — /target-sources 가 쓰는 바닥과 같아야
    // 같은 레일이 두 화면에서 같은 대비를 갖는다. gray-50 위에서는 흰 카드가
    // ΔE00 1.20(식별 한계 아래)이라 테두리에만 기대고 있었다.
    <div className={cn('h-[calc(100vh-76px)]', serviceSidebarStyles.canvas)}>
      <div className="flex h-full">
        <ServiceSidebar
          services={services}
          loading={!servicesLoaded}
          currentService={selectedService ? { code: selectedService, name: selectedName } : null}
          onSelectService={handleSelectService}
          searchQuery={serviceQuery}
          onSearchChange={handleSearchChange}
          pageInfo={servicePageInfo}
          onPageChange={handlePageChange}
        />

        {/* The scroll belongs to the card band inside the list, so that the pager below
            it can be a footer rather than something that scrolls past — if this element
            scrolls too, the footer goes with it. But `overflow-hidden` alone left the
            page with no escape hatch under its fixed-height root: below ~240px of column
            (a 400%-zoom viewport, WCAG 1.4.10) the band has already collapsed to nothing
            and the pager clips off the bottom with nothing to scroll. `overflow-y-auto`
            plus a floor on the list restores page scroll exactly there and nowhere else —
            above that height the content fits, so this never scrolls. */}
        <main
          className={cn(
            'flex flex-1 min-w-0 flex-col overflow-y-auto p-6',
            serviceSidebarStyles.canvas,
          )}
        >
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
            // No ceiling: the column is however wide the window is. A max-width here
            // reads as a fixed width to anyone whose monitor is past it — at 2280px a
            // 1440 cap left 520px of dead canvas and froze the layout against every
            // resize. `main` already holds the column off the edges with its own p-6.
            // `flex-1 min-h-0` so the column is exactly as tall as `main` — that fixed
            // height is what lets the list hand its middle band the leftover space and
            // keep the pager on the bottom edge. `min-h-full` sized it to its content
            // instead, which on a short window pushed the pager off the screen.
            <div className="flex w-full flex-1 min-h-0 flex-col">
              {/* No breadcrumb. It read "SIT Home › 서비스 목록" directly above an h1
                  that says the same thing, so it spent 37px of the first screen
                  repeating the title rather than locating the page. On a 100% zoom
                  laptop the chrome above the first account was 30% of the viewport;
                  this is the part of it that was not earning its height. */}
              <ServiceHeaderV7
                serviceCode={selectedService}
                serviceName={selectedName}
                onAddInfra={openCreateModal}
              />

              <InfraRowList
                // Remount per service: the list owns its page number, and without a key
                // that number survives the switch — pick service A, page to 3, click
                // service B, and B opens on its third page having never been paged.
                key={selectedService}
                // Derived at render, so the panel can never come apart from its header:
                // between clicking service B and B's effect running there is one commit
                // still holding A's array, and this drops it back to the skeleton.
                projects={panel?.items ?? null}
                error={panel?.error ?? null}
                loading={loading}
                onRetry={refreshProjects}
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
