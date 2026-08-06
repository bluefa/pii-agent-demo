'use client';

/**
 * Admin Pipeline services·targets search (LIN-25 Phase C1-b) —
 * /pass/admin/pipelines/services and /…/services/{code}.
 *
 * Optional catch-all: the selected service lives in the PATH (`[[...code]]`), so
 * a service is deep-linkable (`/services/{code}` opens it immediately) and rail
 * clicks just `router.push` the code — one component serves both URLs, keeping
 * the rail's search/pagination state across selections.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.2): the service list
 * uses `getServicesPage` SERVER-side — page/size plus the `query` param (R20.5:
 * real pagination in the rail, debounced server search; the old size=200
 * client-filter window is gone). The right pane's targets come from the
 * existing `getProjects` (`/services/{code}/target-sources`), and each row's
 * latest run is fetched via `getLatestPipelineByTarget` (#8) under a
 * concurrency cap of 6. Design reference: /pass/services rail.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { getProjects, getServicesPage } from '@/app/lib/api';
import {
  OrchestratorApiError,
  getLatestPipelineByTarget,
} from '@/app/lib/api/pipeline';
import type { PipelineSummary } from '@/lib/pipeline/types';
import type { ProjectSummary } from '@/lib/types';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import {
  PlChevCell,
  PlRow,
  PlTable,
  PlTd,
  PlTh,
} from '@/app/admin/pipelines/_components/PlTable';
import { LatestCell } from '@/app/admin/pipelines/_services/LatestCell';
import { SERVICE_RAIL_PAGE_SIZE } from '@/app/components/features/admin/ServiceSidebar';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import {
  type ServiceItem,
  latestCellState,
  runWithConcurrency,
  serviceItemsFrom,
} from '@/app/admin/pipelines/_services/logic';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';

// The rail pages the same everywhere it appears — see SERVICE_RAIL_PAGE_SIZE.
const SERVICE_PAGE_SIZE = SERVICE_RAIL_PAGE_SIZE;
/** Ceiling for one stretched rail row — see serviceListStyles.item. */
const ROW_MAX_PX = 88;
const SEARCH_DEBOUNCE_MS = 300;
const LATEST_CONCURRENCY = 6;

const errorMessage = (err: unknown): string =>
  err instanceof OrchestratorApiError || err instanceof Error ? err.message : String(err);

/** Map of targetSourceId → latest run (undefined = fetching, null = 204/idle). */
type LatestMap = Record<number, PipelineSummary | null | undefined>;

export default function ServicesPage(): ReactElement {
  const router = useRouter();
  // Optional catch-all: `/services` → no code, `/services/{code}` → params.code[0].
  const params = useParams<{ code?: string[] }>();
  const selectedCode = params.code?.[0] ?? null;

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<unknown>(null);
  const [servicesRetry, setServicesRetry] = useState(0);

  const [svcQuery, setSvcQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [svcPage, setSvcPage] = useState(1);
  const [svcPages, setSvcPages] = useState(1);
  /** Total behind the rail title — during a search it is the hit count. */
  const [svcTotal, setSvcTotal] = useState(0);
  // Deep-link name resolution — on a direct `/services/{code}` hit the service
  // may sit on another list page, so its name is fetched once by search.
  const [resolvedName, setResolvedName] = useState<{ code: string; name: string } | null>(null);

  const [targets, setTargets] = useState<ProjectSummary[] | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState<unknown>(null);
  const [targetsRetry, setTargetsRetry] = useState(0);
  const [latest, setLatest] = useState<LatestMap>({});

  // Debounced server search — a query change also rewinds to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(svcQuery.trim());
      setSvcPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [svcQuery]);

  // Service list — server pagination + server query (R20.5).
  useAbortableEffect(
    (signal) => {
      setServicesLoading(true);
      setServicesError(null);
      return getServicesPage(svcPage - 1, SERVICE_PAGE_SIZE, debouncedQuery || undefined, { signal })
        .then((page) => {
          if (signal.aborted) return;
          setServices(serviceItemsFrom(page));
          setSvcPages(Math.max(1, page.totalPages ?? 1));
          setSvcTotal(page.totalElements ?? 0);
          setServicesLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setServicesError(err);
          // 이전 질의의 총계·페이지 수가 "불러오지 못했습니다" 옆에 남지 않게 같이
          // 비운다. 총계만 비우면 개수 태그는 사라져도 페이저는 "1 / 3 페이지"를
          // 계속 그린다 — 페이저는 한 장이면 스스로 사라진다.
          setSvcTotal(0);
          setSvcPages(1);
          setServicesLoading(false);
        });
    },
    [servicesRetry, svcPage, debouncedQuery],
  );

  // Targets + per-target latest for the selected service. getProjects has no
  // signal param, so `signal.aborted` guards every setState instead.
  useAbortableEffect(
    (signal) => {
      if (!selectedCode) return;
      setTargetsLoading(true);
      setTargetsError(null);
      setTargets(null);
      setLatest({});
      return getProjects(selectedCode)
        .then((list) => {
          if (signal.aborted) return;
          setTargets(list);
          setTargetsLoading(false);
          return runWithConcurrency(
            list,
            LATEST_CONCURRENCY,
            async (target) => {
              const summary = await getLatestPipelineByTarget(target.targetSourceId).catch(
                () => null,
              );
              if (signal.aborted) return;
              setLatest((prev) => ({ ...prev, [target.targetSourceId]: summary }));
            },
            // Stop LAUNCHING new latest lookups once this effect is cleaned up
            // (service switch/unmount) — a stale batch must not keep scheduling.
            () => !signal.aborted,
          );
        })
        .catch((err) => {
          if (signal.aborted) return;
          setTargetsError(err);
          setTargetsLoading(false);
        });
    },
    [selectedCode, targetsRetry],
  );

  // Name from the current list page if present — the common case (rail click).
  const listName =
    services.find((svc) => svc.service_code === selectedCode)?.service_name ?? null;

  // Resolve the name once for a deep-linked service that isn't on this page.
  useAbortableEffect(
    (signal) => {
      if (!selectedCode || listName) return;
      return getServicesPage(0, SERVICE_PAGE_SIZE, selectedCode, { signal })
        .then((page) => {
          if (signal.aborted) return;
          const match = serviceItemsFrom(page).find((item) => item.service_code === selectedCode);
          if (match) {
            setResolvedName({ code: selectedCode, name: match.service_name ?? selectedCode });
          }
        })
        .catch(() => {});
    },
    [selectedCode, listName],
  );

  const selectedName =
    listName ??
    (resolvedName?.code === selectedCode ? resolvedName.name : null) ??
    selectedCode ??
    '';

  // Identity-block summary stats — both derived from data already on the page:
  // 대상 수 = target count, 실행 중 = targets whose latest run is RUNNING/PENDING
  // (the same `active` state LatestCell surfaces). null until targets resolve.
  const targetCount = targets?.length ?? null;
  const activeCount =
    targets != null
      ? targets.filter((t) => latestCellState(latest[t.targetSourceId]).kind === 'active').length
      : null;

  const s = serviceListStyles;

  return (
    <div className={s.split}>
      {/* Left — full-height service rail (R20.5: flush at the content edge, not a card) */}
      <aside className={cn(s.rail, s.railSticky)} aria-label="서비스 목록">
        <div className={s.railHead}>
          <h1 className={s.railTitle}>서비스·대상 검색</h1>
          {!servicesLoading && svcTotal > 0 && <span className={s.railCount}>{svcTotal}</span>}
        </div>
        <div className={s.railSearch}>
          <SearchBox
            // `block` alone leaves SearchBox's `inline-block` shrink-to-fit width.
            wrapClassName="block w-full"
            placeholder="서비스 코드/이름 검색"
            value={svcQuery}
            onChange={(event) => setSvcQuery(event.target.value)}
            aria-label="서비스 코드/이름 검색"
          />
        </div>
        <div className={s.railBody}>
          {servicesLoading ? (
            <div className="min-h-[240px] flex-1" aria-busy="true" />
          ) : servicesError != null ? (
            <div className="flex-1">
              <PlEmptyState
                onGround
                icon="search"
                message={errorMessage(servicesError)}
                meta={
                  <PlButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setServicesRetry((n) => n + 1)}
                  >
                    재시도
                  </PlButton>
                }
              />
            </div>
          ) : services.length === 0 ? (
            <div className="flex-1">
              <PlEmptyState onGround icon="search" message="검색 결과가 없습니다." />
            </div>
          ) : (
            <>
            <div className={s.railSection}>{svcQuery ? '검색 결과' : '전체 서비스'}</div>
            <div className={s.railList} style={{ maxHeight: services.length * ROW_MAX_PX }}>
              {services.map((service) => {
                const code = service.service_code ?? '';
                const name = service.service_name ?? code;
                const active = code === selectedCode;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      if (code === selectedCode) return;
                      // Clear the previous service's rows synchronously so the
                      // next render shows the loading placeholder — never the
                      // prior table or a false "없음" before the fetch starts.
                      setTargets(null);
                      setLatest({});
                      router.push(passRoutes.pipelines.service(code));
                    }}
                    title={`${name} (${code})`}
                    aria-current={active ? 'true' : undefined}
                    className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                  >
                    <span
                      className={cn(serviceSidebarStyles.tile, serviceTileClass(code))}
                      aria-hidden="true"
                    >
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>{name}</span>
                    <span className={active ? s.codeActive : s.code}>{code}</span>
                  </button>
                );
              })}
            </div>
            </>
          )}
          <div className={s.railFoot}>
            <SidebarPagination
              pageInfo={{
                totalElements: svcTotal,
                totalPages: svcPages,
                number: svcPage - 1,
                size: SERVICE_PAGE_SIZE,
              }}
              onPageChange={(next) => setSvcPage(next + 1)}
            />
          </div>
        </div>
      </aside>

      {/* Right — target sources for the selected service */}
      <section className={s.main}>
        {!selectedCode ? (
          <div className={cn(s.sheet, 'items-center justify-center')}>
            <PlEmptyState icon="cursor" center message="좌측에서 서비스를 선택해 주세요." />
          </div>
        ) : (
          // 본문은 시트 한 장 — 정체 블록과 표 사이는 가로줄로 나누고, 시트는 끊지 않는다.
          <div className={s.sheet}>
            <div className={s.identity}>
              <span className={s.eyebrow}>서비스</span>
              <div className={s.titleRow}>
                <h2 className={s.svcTitle}>{selectedName}</h2>
                <span className={s.svcCodeChip}>
                  <span className={s.svcCodeChipLabel}>서비스코드</span>
                  <span className="[font-family:var(--pl-font-mono)]">{selectedCode}</span>
                </span>
              </div>
              <div className={s.statRow}>
                <div className={s.stat}>
                  <span className={s.statLabel}>대상 수</span>
                  <span className={s.statVal}>{targetCount ?? '—'}</span>
                </div>
                <div className={s.stat}>
                  <span className={s.statLabel}>실행 중</span>
                  <span className={s.statValActive}>{activeCount ?? '—'}</span>
                </div>
              </div>
              <p className={s.identityDesc}>대상을 선택하면 상세에서 설치·삭제를 시작할 수 있어요</p>
            </div>

            <hr className={s.sheetRule} />

            <div className="flex-1 min-h-0">
              {targetsError != null ? (
                <PlEmptyState
                  icon="inbox"
                  message={errorMessage(targetsError)}
                  meta={
                    <PlButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setTargetsRetry((n) => n + 1)}
                    >
                      재시도
                    </PlButton>
                  }
                />
              ) : targetsLoading || targets === null ? (
                // null = not fetched yet (effect runs post-paint); treat as loading
                // so the first selection never flashes a false "target source 없음".
                <div className="min-h-[240px]" aria-busy="true" />
              ) : targets.length === 0 ? (
                <PlEmptyState icon="inbox" message="target source가 없습니다." />
              ) : (
                <PlTable
                  head={
                    <>
                      <PlTh>TargetSourceId</PlTh>
                      <PlTh>Cloud Provider</PlTh>
                      <PlTh>실행 중 작업</PlTh>
                      <PlTh />
                    </>
                  }
                >
                  {(targets ?? []).map((target) => (
                    <PlRow
                      key={target.targetSourceId}
                      onActivate={() =>
                        router.push(passRoutes.pipelines.ops.targetSource(target.targetSourceId, 'infra'))
                      }
                    >
                      <PlTd mono>{target.targetSourceId}</PlTd>
                      <PlTd>
                        <ProvTag provider={target.cloudProvider} isSdu={target.isSduType} />
                      </PlTd>
                      <PlTd>
                        <LatestCell entry={latest[target.targetSourceId]} />
                      </PlTd>
                      <PlChevCell title="대상 상세로 이동" />
                    </PlRow>
                  ))}
                </PlTable>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
