'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { ProjectCreateModal } from '@/app/components/features/ProjectCreateModal';
import { DescriptionEditModal } from '@/app/services/_components/DescriptionEditModal';
import { useToast } from '@/app/components/ui/toast';
import {
  getProjects,
  getServicesPage,
} from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import type { ProjectSummary } from '@/lib/types';
import { passRoutes } from '@/lib/routes';
import { cn, primaryColors, serviceSidebarStyles, textColors } from '@/lib/theme';
import { ChevronRightIcon, ShieldIcon } from '@/app/components/ui/icons';
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
// 실패 패널의 본문. 제목이 이미 "불러오지 못했습니다"를 말하므로 여기서는 다음 행동만 남긴다.
const PANEL_RETRY_HINT = '잠시 후 다시 시도해 주세요.';

/**
 * EOS 여부를 계약에 **없는** 필드에서 읽는다.
 *
 * `/user/services/page` 의 `ServiceItem` 은 `{service_code, service_name}` 뿐이다
 * (업스트림 `api-docs.yaml`). EOS 플래그는 target-source 를 타고 오는 응답에만 있어서
 * 이 화면 — 아직 target 이 하나도 없을 수 있는 서비스 목록 — 에서는 쓸 수 없다.
 *
 * swagger 에 필드를 손으로 넣는 건 ADR-019 D8 위반이고, `gen:api` 가 우리 스펙을
 * 입력으로 읽기 때문에 D7 신선도 게이트도 그 조작을 잡지 못한다. 대신 생성 스키마가
 * `.partial().passthrough()` 라는 사실을 쓴다: 계약에 없는 키도 `parse()` 를 그대로
 * 통과해 클라이언트까지 온다. 그래서 **BFF 가 필드를 싣기 시작하는 날, 코드 변경 없이**
 * 이 화면이 켜진다.
 *
 * `=== true` 는 방어가 아니라 의도의 표기다 — 세 상태(true / false / 없음) 중 EOS 라고
 * 말할 근거가 있는 건 하나뿐이고, 나머지 둘은 "모른다"로 접힌다.
 */
export const readIsEosService = (item: unknown): boolean | undefined => {
  if (typeof item !== 'object' || item === null) return undefined;
  const value = (item as { is_eos_service?: unknown }).is_eos_service;
  return value === true ? true : value === false ? false : undefined;
};

/**
 * The content pane while the first services page is still in flight.
 *
 * Not 서비스를 선택하세요 held up as a placeholder: that sentence is a settled
 * answer, and rendering it before the response arrives makes the pane say the
 * wrong thing and then swap — 서비스를 선택하세요 → 아직 접근 권한이 있는 …, which
 * is the flicker this replaces. The rail beside it was already showing a skeleton
 * for exactly the same wait; now both halves of the screen are one loading frame.
 *
 * It draws only what BOTH settled states have — a 48px mark and one line of type
 * under it, at the mark's own `w-12 h-12 mx-auto mb-4`. The reason lines and the
 * link are NOT drawn: they exist in one outcome and not the other, and a skeleton
 * that promises them is a prediction, not a placeholder.
 * The bar is 20px, the smaller of the two headings (20/28 here, 24/32 there).
 *
 * Both frames are centred, so the mark travels on settle — measured 56px up into
 * the no-access block (84px of skeleton → 196px of content) and 6px into
 * 서비스를 선택하세요 (96px). Reserving the taller height instead would zero one of
 * those two and double the other; a skeleton that grows into its content, centred
 * both times, promises neither outcome.
 */
const PaneLoadingFrame = () => (
  <div className="h-full flex items-center justify-center" aria-busy="true" aria-hidden="true">
    <div className="px-6">
      <div
        className={cn(
          'w-12 h-12 mx-auto mb-4 rounded-[10px]',
          serviceSidebarStyles.canvasSkeletonBar,
        )}
      />
      <div className={cn('h-5 w-64 rounded', serviceSidebarStyles.canvasSkeletonBar)} />
    </div>
  </div>
);

/**
 * The content pane when the account has access to no service at all.
 *
 * It stands where 서비스를 선택하세요 stands, because that sentence is an instruction
 * with nothing to follow: the rail beside it is empty, and telling someone to pick
 * from an empty list is the loudest thing on the screen saying the least. The rail
 * states the fact in one line; naming the reason and offering the way out belongs
 * here, on the surface with room for it.
 *
 * The shield is `ShieldCheckIcon` minus the tick — a shield with a check in it says
 * "verified", the opposite of an empty permission list.
 *
 * Inks are the page's, not the rail's, and they are measured against this canvas
 * (#F4F4FB) rather than white: `textColors.tertiary` is 4.42:1 here — fine for the
 * glyph (1.4.11 asks 3:1) and under AA for the sentence, which is why the reason
 * line uses `secondary` (9.41:1). The link is `textOnLight`, not `primaryColors.text`:
 * #0064FF lands on 4.4951:1 against this wash, i.e. just under.
 */
const NoServiceAccessState = () => (
  <div className="h-full flex items-center justify-center">
    {/* `break-keep` 은 제목이 갈리는 자리를 어절 경계로 묶는 안전망이다 — 한글은 기본
        규칙에서 "없습니/다" 처럼 낱말 한가운데가 끊긴다. 24px 시절 이 판이 실제로 그렇게
        갈렸다. */}
    <div className="max-w-[560px] px-6 text-center">
      <ShieldIcon className={cn('w-12 h-12 mx-auto mb-4', textColors.tertiary)} />
      {/* 20 / 16 두 단(오너 지시). 제목만 semibold 라 계층이 크기와 무게 두 채널에
          실린다 — 4px 차이 하나로는 두 줄이 같은 단으로 읽힌다. */}
      <p className={cn('text-[20px] font-semibold leading-7 break-keep', textColors.primary)}>
        아직 접근 권한이 있는 서비스가 없습니다
      </p>
      <p className={cn('mt-3 text-[16px] leading-6', textColors.secondary)}>
        담당하시는 서비스가 있다면 권한 요청을 해주세요.
        <br />
        관리자가 확인 후 승인해드립니다.
      </p>
      {/* 행동은 사유보다 작지 않다 — 본문과 같은 16px 에 둔다. */}
      <Link
        href={passRoutes.accessRequests}
        className={cn(
          'mt-5 inline-flex items-center gap-0.5 text-[16px] hover:underline',
          primaryColors.textOnLight,
        )}
      >
        권한 요청하기
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </div>
  </div>
);

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
  // paint of every service claim 등록된 인프라가 없습니다. before the request had even
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
  // 이 계정이 접근할 수 있는 서비스가 하나도 없다 — 목록이 비었다가 아니라.
  // 근거가 되는 건 **검색어 없는 응답뿐**이다: 걸러진 0건은 부분집합이라 권한에 대해
  // 아무 말도 못 한다. 초기 조회가 항상 무필터(page 0, query 없음)라 값은 첫 응답에서
  // 정해지고, 뒤이은 검색이 그 판정을 뒤집지 않는다.
  const [noAccess, setNoAccess] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The row being described, by id — not the row object. The list is reloaded after a
  // save, so a captured object would be the pre-save copy; an id re-reads the row that
  // is on screen right now, and resolves to nothing if the row is gone.
  const [describingId, setDescribingId] = useState<number | null>(null);
  // Keyed to the code it belongs to. Clearing it in an effect instead would still let
  // one render pair the new code with the previous service's name — the effect runs
  // after that paint. Derived at render, the pair can never come apart.
  // `isEos` 는 3-상태다: true / false / undefined(아직 못 읽었거나 BFF 가 안 실어 보냄).
  // 헤더가 EOS 를 그리는 조건이 `=== true` 라 세 번째 상태는 자동으로 "EOS 아님" 쪽으로
  // 접힌다 — 계약이 나가기 전까지는 지금과 같은 화면이라는 뜻이다.
  const [resolvedName, setResolvedName] = useState<
    { code: string; name: string; isEos?: boolean } | null
  >(null);
  const resolved = resolvedName?.code === selectedService ? resolvedName : null;
  const selectedName = resolved?.name ?? '';
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
      if (!searchQuery) setNoAccess((data.totalElements ?? 0) === 0);
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
      // 업스트림 message 를 그대로 싣지 않는다. 조회 실패에 사용자가 할 수 있는 일은
      // 재시도뿐인데, 게이트웨이 문구("backend service unavailable")는 그 판단에
      // 아무것도 보태지 못한 채 영어 원문으로 노출된다.
      toast.error('서비스 목록을 불러오지 못했습니다.');
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
        setResolvedName({
          code: selectedService,
          name: hit?.service_name ?? '',
          // 못 찾았거나 필드가 안 왔으면 undefined 로 남긴다 — `?? false` 로 접으면
          // "모른다"가 "운영 중"이라는 단정으로 바뀐다.
          isEos: readIsEosService(hit),
        });
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
      } catch {
        // 업스트림 원문은 여기서도 버린다. 패널은 제목이 이미 실패를 말하므로
        // (InfraRowList 의 실패 화면) 본문에는 다음 행동만 남기고, 실패 사실은
        // 토스트가 문장으로 말한다.
        setProjects({ code, error: PANEL_RETRY_HINT });
        toast.error(failureMessage);
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
    void loadProjects(selectedService, '연동 대상 계정을 불러오지 못했습니다.');
  }, [selectedService, loadProjects]);

  const refreshProjects = useCallback(async () => {
    if (!selectedService) return;
    await loadProjects(selectedService, '연동 대상 계정을 새로고침하지 못했습니다.');
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
        case 'editDescription':
          setDescribingId(targetSourceId);
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

  const closeDescribe = useCallback(() => {
    setDescribingId(null);
  }, []);

  const handleDescriptionSaved = useCallback(() => {
    setDescribingId(null);
    toast.success('설명을 저장했습니다.');
    void refreshProjects();
  }, [refreshProjects, toast]);

  // Resolved at render off the list the row is drawn from, so the dialog and the row
  // can never hold different text. A row that vanished under an open dialog (a reload
  // that dropped it) resolves to null and the dialog simply is not rendered.
  const describing = panel?.items?.find((item) => item.targetSourceId === describingId) ?? null;

  return (
    // Exact viewport minus the sticky 64px TopNav — `min-h-screen` here stacked a
    // full 100vh under the nav, so the page scrolled 64px and the left panel ended
    // short of the bottom edge.
    // 바닥은 gray-50 이 아니라 앱 캔버스 — /target-sources 가 쓰는 바닥과 같아야
    // 같은 레일이 두 화면에서 같은 대비를 갖는다. gray-50 위에서는 흰 카드가
    // ΔE00 1.20(식별 한계 아래)이라 테두리에만 기대고 있었다.
    <div className={cn('h-[calc(100vh-64px)]', serviceSidebarStyles.canvas)}>
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
          {!selectedService && !servicesLoaded ? (
            // 도착하기 전에는 어느 쪽도 말하지 않는다. 이 게이트가 레일 스켈레톤과
            // 같은 플래그를 쓰므로 화면 양쪽이 같은 순간에 갈린다.
            <PaneLoadingFrame />
          ) : !selectedService && noAccess ? (
            <NoServiceAccessState />
          ) : !selectedService ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                {/* The layout this page IS: rail on the left with rows in it,
                    empty pane on the right. It was a terminal `>_` — a console
                    glyph on a screen with no console anywhere near it.
                    An empty state's job is to say what to DO, not to name the
                    room, so the mark shows the pick-on-the-left gesture rather
                    than a service-shaped noun.

                    A solid column, not list ticks: three 1.5-weight ticks in a
                    7-unit column are the same weight as the frame around them,
                    so at this size the whole glyph flattened into one texture.
                    Fill separates the two halves in one read.

                    No plate behind it. A tinted disc is what a glyph gets when it
                    is too small to hold the eye on its own; at 48px this one holds
                    it. Standing on the canvas it also has to carry its own
                    contrast, so it leaves `quaternary` — that token is explicitly
                    for glyphs sitting ON something, and 2.54:1 was borrowed from
                    the plate. */}
                <svg
                  className={cn('w-12 h-12 mx-auto mb-4', textColors.tertiary)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6.5A2.5 2.5 0 015.5 4H10v16H5.5A2.5 2.5 0 013 17.5z"
                    fill="currentColor"
                    stroke="none"
                  />
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                </svg>
                {/* Ink, not the quiet tier. This line is the pane's only content —
                    there is nothing for it to sit quietly behind. `tertiary` is
                    for text that yields to something louder nearby. */}
                <p className={cn('text-[24px] leading-8', textColors.primary)}>
                  서비스를 선택하세요
                </p>
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
                isEosService={resolved?.isEos}
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

      {/* Keyed to the target: mounting per row is what makes the textarea start from
          that row's description without an effect syncing it afterwards. */}
      {describing && (
        <DescriptionEditModal
          key={describing.targetSourceId}
          targetSourceId={describing.targetSourceId}
          initialDescription={describing.description ?? ''}
          onSaved={handleDescriptionSaved}
          onClose={closeDescribe}
        />
      )}
    </div>
  );
};
