'use client';

/**
 * Admin Pipeline services·targets search (LIN-25 Phase C1-b) —
 * /integration/admin/pipelines/services.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.2): the service list
 * comes from the EXISTING `getServicesPage` (a single size=200 window, filtered
 * client-side to match the design's in-place search); the right panel's targets
 * come from the existing `getProjects` (`/services/{code}/target-sources`), and
 * each row's latest run is fetched via `getLatestPipelineByTarget` (#8) under a
 * concurrency cap of 6. Design fidelity: admin-pipeline.html §Services.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { buildTargetHref } from '@/lib/pipeline/format';
import { getProjects, getServicesPage } from '@/app/lib/api';
import {
  OrchestratorApiError,
  getLatestPipelineByTarget,
} from '@/app/lib/api/pipeline';
import type { PipelineSummary } from '@/lib/pipeline/types';
import type { ProjectSummary } from '@/lib/types';

import { SearchBox } from '@/app/integration/admin/pipelines/_components/SearchBox';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { PlEmptyState } from '@/app/integration/admin/pipelines/_components/PlEmptyState';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/integration/admin/pipelines/_components/ProvTag';
import {
  PlChevCell,
  PlRow,
  PlTable,
  PlTd,
  PlTh,
} from '@/app/integration/admin/pipelines/_components/PlTable';
import { LatestCell } from '@/app/integration/admin/pipelines/_services/LatestCell';
import {
  type ServiceItem,
  filterServices,
  runWithConcurrency,
  serviceItemsFrom,
} from '@/app/integration/admin/pipelines/_services/logic';
import { serviceListStyles } from '@/app/integration/admin/pipelines/_services/styles';

const SERVICE_FETCH_SIZE = 200;
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
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [targets, setTargets] = useState<ProjectSummary[] | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState<unknown>(null);
  const [targetsRetry, setTargetsRetry] = useState(0);
  const [latest, setLatest] = useState<LatestMap>({});

  // Service list — one large window, filtered client-side (design semantics).
  useAbortableEffect(
    (signal) => {
      setServicesLoading(true);
      setServicesError(null);
      return getServicesPage(0, SERVICE_FETCH_SIZE, undefined, { signal })
        .then((page) => {
          if (signal.aborted) return;
          setServices(serviceItemsFrom(page));
          setServicesLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setServicesError(err);
          setServicesLoading(false);
        });
    },
    [servicesRetry],
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

  const filtered = useMemo(() => filterServices(services, svcQuery), [services, svcQuery]);
  const selectedName = useMemo(
    () => services.find((s) => s.service_code === selectedCode)?.service_name ?? selectedCode ?? '',
    [services, selectedCode],
  );

  return (
    <div>
      <div className="mb-6 flex items-center">
        <h1 className={pipelineStyles.text.pageTitle}>서비스·대상 검색</h1>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-3">
        {/* Left — service picker */}
        <Card className="min-h-[420px]">
          <SearchBox
            wrapClassName="block mb-3"
            placeholder="서비스 코드/이름 검색"
            value={svcQuery}
            onChange={(event) => setSvcQuery(event.target.value)}
            aria-label="서비스 코드/이름 검색"
          />
          {servicesLoading ? (
            <div className="min-h-[240px]" aria-busy="true" />
          ) : servicesError != null ? (
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
          ) : filtered.length === 0 ? (
            <PlEmptyState icon="search" message="검색 결과 없음" />
          ) : (
            <div>
              {filtered.map((service) => {
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
                      setSelectedCode(code);
                      setTargets(null);
                      setLatest({});
                    }}
                    className={cn(
                      serviceListStyles.item,
                      active ? serviceListStyles.itemActive : serviceListStyles.itemIdle,
                    )}
                  >
                    <span>{service.service_name ?? code}</span>
                    <span className={pipelineStyles.text.meta}>{code}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right — target sources for the selected service */}
        <Card className="min-h-[420px]">
          {!selectedCode ? (
            <PlEmptyState icon="cursor" center message="좌측에서 서비스를 선택하세요" />
          ) : (
            <>
              <SectionHeader first title={`${selectedName} 의 Target Source`} desc="대상을 선택하면 상세에서 설치·삭제를 시작할 수 있어요" />
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
                      <PlTh>CSP</PlTh>
                      <PlTh>파이프라인</PlTh>
                      <PlTh />
                    </>
                  }
                >
                  {(targets ?? []).map((target) => (
                    <PlRow
                      key={target.targetSourceId}
                      onActivate={() =>
                        router.push(
                          buildTargetHref(target.targetSourceId, {
                            svc: selectedCode,
                            svcName: selectedName,
                          }),
                        )
                      }
                    >
                      <PlTd mono>{target.targetSourceId}</PlTd>
                      <PlTd>
                        <ProvTag provider={target.cloudProvider} />
                      </PlTd>
                      <PlTd>
                        <LatestCell entry={latest[target.targetSourceId]} />
                      </PlTd>
                      <PlChevCell title="대상 상세로 이동" />
                    </PlRow>
                  ))}
                </PlTable>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
