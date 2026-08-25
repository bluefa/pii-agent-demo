'use client';

/**
 * Airflow 확인 tab — 이 대상의 DAG 가 최근 7일 동안 무엇을 했는지.
 *
 * 관리자 승인 탭의 조건 ③(모니터링 헬스)이 판정만 한 줄로 나르고, 그 근거 전부는
 * 여기로 온다 — 요약(밴드) ▸ 에이전트 표 ▸ 논리 DB 보드(우측 패널) ▸ DAG 상세.
 *
 * §10 응답의 소유자는 이 탭이 아니라 OpsTargetView 다. 같은 응답을 승인 탭과 나눠 읽으므로
 * 탭을 오갈 때마다 다시 부르지 않는다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useModal } from '@/app/hooks/useModal';
import { getConfirmedIntegration } from '@/app/lib/api';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  indexConfirmedResources,
  type ConfirmedIndex,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  aggregateDagStatus,
  monitoringEvidenceHead,
  type DagFetch,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { MonitoringEvidenceBody } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/MonitoringEvidenceBody';
import { AgentDagTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/AgentDagTable';
import { DbWeeklyBoard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';
import { DagDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DagDetailModal';
import type {
  BoardFilter,
  DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

export interface AirflowTabProps {
  targetSourceId: number;
  isIdc: boolean;
  /** §10 dag-status — fetched once by the page and shared with 관리자 승인. */
  dag: DagFetch;
}

export function AirflowTab({ targetSourceId, isIdc, dag }: AirflowTabProps): ReactElement {
  // 확정 스냅샷은 DAG 표가 §10 밖에서 빌려 오는 사실(리전·DatabaseType·IDC 접속 주소)의
  // 출처다. best-effort — 실패하면 조인 칸만 대시로 서고 표는 그대로 뜬다.
  const [confirmed, setConfirmed] = useState<ConfirmedIndex | null>(null);
  useAbortableEffect(
    (signal) => {
      setConfirmed(null);
      return getConfirmedIntegration(targetSourceId, { signal })
        .then((snapshot) => {
          if (signal.aborted) return;
          setConfirmed(indexConfirmedResources(snapshot.resource_infos ?? []));
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          // 404 = 확정 전 대상(원래 없음) — 빈 index 도 조인은 대시로 끝난다.
          if (isMissingConfirmedIntegrationError(error)) setConfirmed(indexConfirmedResources([]));
        });
    },
    [targetSourceId],
  );

  const agg = useMemo(() => (dag.phase === 'loaded' ? aggregateDagStatus(dag.data) : null), [dag]);
  const head = monitoringEvidenceHead(dag, agg);

  // 논리 DB 보드 — 우측 오버레이 패널. 진입(요약의 실패 숫자 · 현황 보기 · 에이전트 표의
  // "DAG 상태 조회")이 프리셋과 함께 연다.
  const board = useModal<{ filter: BoardFilter; agentId?: string }>();
  // DAG 상세는 패널 위에 겹치는 레이어라 소유자가 여기여야 Esc 를 누가 먹을지 정할 수 있다.
  const dagDetail = useModal<DagDbRow>();
  const closeBoard = (): void => {
    dagDetail.close();
    board.close();
  };

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="Airflow 확인">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="flow" size={18} className="text-[var(--pl-primary)]" />
            Airflow 확인
            <TcPill tone={head.pill.tone} label={head.pill.label} />
          </h2>
          <p className={opsStyles.cardDesc} title={head.titleHint}>
            {head.subtitle ?? '최근 7일 DAG 실행 기준으로 이 대상의 모니터링 상태를 봅니다.'}
          </p>
        </div>

        <div className="mt-5">
          {dag.phase === 'loaded' && agg ? (
            <>
              <MonitoringEvidenceBody
                data={dag.data}
                agg={agg}
                fetchedAt={dag.fetchedAt}
                onShowFailed={() => board.open({ filter: 'failed' })}
                onOpenBoard={() => board.open({ filter: 'ALL' })}
              />
              {/* 에이전트가 1개뿐이어도 그린다 — 요약은 리소스가 무엇인지 말하지 않는다. */}
              {dag.data.agents.length > 0 && (
                <div className="mt-4">
                  <AgentDagTable
                    data={dag.data}
                    // "DAG 상태 조회"가 약속하는 것은 그 에이전트의 DB 전부다.
                    onViewDbs={(agentId) => board.open({ agentId, filter: 'ALL' })}
                    confirmed={confirmed}
                    isIdc={isIdc}
                  />
                </div>
              )}
            </>
          ) : dag.phase === 'failed' ? (
            <p className="text-[14px] text-[var(--pl-text-weak)]">
              모니터링 상태를 불러오지 못했습니다.
            </p>
          ) : (
            <p className="text-[14px] text-[var(--pl-text-weak)]" aria-busy>
              모니터링 상태를 확인하고 있어요…
            </p>
          )}
        </div>
      </section>

      {/* 패널 + 그 위의 DAG 상세 = 2단 레이어. ModalShell 의 Esc 는 document 에 붙으므로,
          모달이 떠 있는 동안 패널의 Esc 를 꺼야 한 번에 둘 다 닫히지 않는다. */}
      {dag.phase === 'loaded' && (
        <>
          <ModalShell
            open={board.isOpen}
            onClose={closeBoard}
            variant="panel"
            labelledBy="db-board-title"
            closeOnEsc={!dagDetail.isOpen}
          >
            {board.data && (
              <DbWeeklyBoard
                data={dag.data}
                initialFilter={board.data.filter}
                initialAgentId={board.data.agentId ?? null}
                onClose={closeBoard}
                onOpenDag={dagDetail.open}
              />
            )}
          </ModalShell>

          <DagDetailModal
            row={dagDetail.data ?? null}
            timezone={dag.data.timezone}
            onClose={dagDetail.close}
          />
        </>
      )}
    </>
  );
}
