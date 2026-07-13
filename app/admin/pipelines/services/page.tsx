'use client';

/**
 * Admin Pipeline services·targets search (LIN-25 Phase C1-b) —
 * /integration/admin/pipelines/services.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.2): the service list
 * uses `getServicesPage` SERVER-side — page/size plus the `query` param (R20.5:
 * real pagination in the rail, debounced server search; the old size=200
 * client-filter window is gone). The right pane's targets come from the
 * existing `getProjects` (`/services/{code}/target-sources`), and each row's
 * latest run is fetched via `getLatestPipelineByTarget` (#8) under a
 * concurrency cap of 6. Design reference: /integration/services rail.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { getProjects, getServicesPage } from '@/app/lib/api';
import {
  OrchestratorApiError,
  getLatestPipelineByTarget,
} from '@/app/lib/api/pipeline';
import type { PipelineSummary } from '@/lib/pipeline/types';
import type { ProjectSummary } from '@/lib/types';

import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { Card } from '@/app/admin/pipelines/_components/Card';
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
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import {
  type ServiceItem,
  latestCellState,
  runWithConcurrency,
  serviceItemsFrom,
} from '@/app/admin/pipelines/_services/logic';
import { serviceListStyles } from '@/app/admin/pipelines/_services/styles';

const SERVICE_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const LATEST_CONCURRENCY = 6;

const errorMessage = (err: unknown): string =>
  err instanceof OrchestratorApiError || err instanceof Error ? err.message : String(err);

/** Map of targetSourceId → latest run (undefined = fetching, null = 204/idle). */
type LatestMap = Record<number, PipelineSummary | null | undefined>;

export default function ServicesPage(): ReactElement {
  const router = useRouter();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<unknown>(null);
  const [servicesRetry, setServicesRetry] = useState(0);

  const [svcQuery, setSvcQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [svcPage, setSvcPage] = useState(1);
  const [svcPages, setSvcPages] = useState(1);
  // Name is captured at selection time — paging/search may drop the selected
  // service off the current page, and the header must not degrade to the code.
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const selectedCode = selected?.code ?? null;

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
          setServicesLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setServicesError(err);
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

  const selectedName = selected?.name ?? '';

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
      <aside className={s.rail} aria-label="서비스 목록">
        <h1 className={s.railTitle}>서비스·대상 검색</h1>
        <SearchBox
          wrapClassName="block mb-3"
          placeholder="서비스 코드/이름 검색"
          value={svcQuery}
          onChange={(event) => setSvcQuery(event.target.value)}
          aria-label="서비스 코드/이름 검색"
        />
        {servicesLoading ? (
          <div className="min-h-[240px] flex-1" aria-busy="true" />
        ) : servicesError != null ? (
          <div className="flex-1">
            <PlEmptyState
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
            <PlEmptyState icon="search" message="검색 결과 없음" />
          </div>
        ) : (
          <div className={s.railList}>
            {services.map((service) => {
              const code = service.service_code ?? '';
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
                    setSelected({ code, name: service.service_name ?? code });
                    setTargets(null);
                    setLatest({});
                  }}
                  className={cn(s.item, active ? s.itemActive : s.itemIdle)}
                >
                  <span className={cn(s.name, active ? s.nameActive : s.nameIdle)}>
                    {service.service_name ?? code}
                  </span>
                  <span className={s.code}>{code}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className={s.railFoot}>
          <PlPagination
            page={svcPage}
            pages={svcPages}
            onPrev={() => setSvcPage((n) => Math.max(1, n - 1))}
            onNext={() => setSvcPage((n) => Math.min(svcPages, n + 1))}
          />
        </div>
      </aside>

      {/* Right — target sources for the selected service */}
      <section className={s.main}>
        {!selectedCode ? (
          <Card className="min-h-[420px]">
            <PlEmptyState icon="cursor" center message="좌측에서 서비스를 선택하세요" />
          </Card>
        ) : (
          <>
            <div className={s.identity}>
              <span className={s.eyebrow}>서비스</span>
              <div className={s.titleRow}>
                <h2 className={s.svcTitle}>{selectedName}</h2>
                <span className={s.svcCodeChip}>{selectedCode}</span>
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
            <Card className="min-h-[420px]">
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
                <PlEmptyState icon="inbox" message="target source 없음" />
              ) : (
                <PlTable
                  head={
                    <>
                      <PlTh>TargetSourceId</PlTh>
                      <PlTh>Cloud Provider</PlTh>
                      <PlTh>실행 중 파이프라인</PlTh>
                      <PlTh />
                    </>
                  }
                >
                  {(targets ?? []).map((target) => (
                    <PlRow
                      key={target.targetSourceId}
                      onActivate={() =>
                        router.push(integrationRoutes.pipelines.target(target.targetSourceId))
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
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
