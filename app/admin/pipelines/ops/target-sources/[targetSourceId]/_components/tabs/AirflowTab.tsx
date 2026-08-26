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
import { cn } from '@/lib/theme';
import { fmtDateTimeShort } from '@/lib/pipeline/format';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useModal } from '@/app/hooks/useModal';
import { getConfirmedIntegration } from '@/app/lib/api';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { ComposerIcon } from '@/app/components/ui/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  indexConfirmedResources,
  type ConfirmedIndex,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  aggregateDagStatus,
  healthVerdict,
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

/**
 * 카드의 보조 한 줄 — 판정만 말한다. 수(총계·성공·확인 필요)는 바로 아래
 * 카운트 줄이 지므로, 예전처럼 문장이 같은 수를 한 번 더 세지 않는다 (오너 2026-08-25).
 * 관측 스코프는 우측 상단 메타 줄로 갔다 — '최근 7일' 태그 + 조회 시각(타임존).
 *
 * ⚠️ `monitoringEvidenceHead` 의 subtitle 을 쓰지 않는 이유: 그 문장은 승인 탭 조건 ③
 * 행의 것이라 수를 안고 있어야 한다(그 화면엔 카운트 줄이 없다). 알약만 공유한다.
 */
const verdictSentence = (dag: DagFetch): string => {
  if (dag.phase === 'loading') return '모니터링 상태를 확인하고 있어요.';
  if (dag.phase === 'failed') return '모니터링 상태를 확인하지 못했어요.';
  switch (healthVerdict(dag.data.healthStatus).kind) {
    case 'healthy':
      // 스코프를 문장이 진다 — §10 이 healthStatus 산식을 열린 질문으로 두고 UI 문구를
      // '최근 7일 DAG 실행 기준'까지로 묶는다(승인 탭 게이트 ③ 과 같은 제약).
      return '최근 7일 DAG 실행이 정상이에요.';
    case 'unhealthy':
      return '성공 기록이 없는 논리 DB가 있어요.';
    case 'unknown':
      return '모니터링 상태를 판정할 수 없어요.';
  }
};

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
      {/* 카드 없음 (오너 2026-08-25, "카드를 빼고 바닥에 모든걸 뿌려놓자") — 이 탭에는
          카드가 하나뿐이라 그 테두리는 무엇도 다른 것과 구분하지 않으면서 탭 안에 상자를
          하나 더 그렸다. 판정·수·표가 바닥에 바로 서고, 제 표면을 갖는 것은 표뿐이다. */}
      <section aria-label="Airflow 확인">
        {/* 머리 = 이름·판정 / 우측 상단 = 이 화면이 언제 무엇을 봤는가. 스코프와 조회
            시각은 카드가 말하는 모든 수의 전제라, 수보다 위·바깥에 선다 (오너 지시). */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
              <ComposerIcon className="flex-none" />
              Airflow 확인
              <TcPill tone={head.pill.tone} label={head.pill.label} />
            </h2>
            <p className={opsStyles.cardDesc} title={head.titleHint}>
              {verdictSentence(dag)}
            </p>
          </div>
          {dag.phase === 'loaded' && (
            <p className="mt-1 flex flex-none items-center gap-2 text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              {/* 스코프는 태그, 시각은 값 (오너 2026-08-25). 셋을 가운뎃점으로 잇던 줄은
                  세 값을 같은 무게로 세워서, 이 탭 전체가 최근 7일치라는 사실이 시각의
                  각주처럼 읽혔다.

                  태그는 파랑이다 — 중립 회색은 이 줄의 글자색과 같은 계열이라 태그가 아니라
                  굵은 글자로 읽혔다(`opsStyles.scopeTag` 에 값의 근거). '조회'는 걷혔다:
                  메타 줄에 시각이 하나뿐이라 그 낱말이 고르는 것이 없다. */}
              <span className={opsStyles.scopeTag}>최근 7일</span>
              {fmtDateTimeShort(dag.fetchedAt)} ({dag.data.timezone})
            </p>
          )}
        </div>

        {dag.phase === 'loaded' && agg && (
          <>
            <div className="mt-5">
              <MonitoringEvidenceBody
                agg={agg}
                onShowAttention={() => board.open({ filter: 'attention' })}
                onOpenBoard={() => board.open({ filter: 'ALL' })}
              />
            </div>
            {/* 에이전트가 1개뿐이어도 그린다 — 요약은 리소스가 무엇인지 말하지 않는다. */}
            {dag.data.agents.length > 0 && (
              <div className="mt-4">
                <AgentDagTable
                  data={dag.data}
                  // "DAG 상태 조회"가 약속하는 것은 그 에이전트의 DB 전부다.
                  // 행의 수가 여는 것은 그 수가 센 행이다 — 시안 A 의 셀이 세우는 값은
                  // '확인 필요'뿐이므로 필터도 그것이다. 요약 줄의 수와 같은 집합.
                  onViewDbs={(agentId) => board.open({ agentId, filter: 'attention' })}
                  confirmed={confirmed}
                  isIdc={isIdc}
                />
              </div>
            )}
          </>
        )}
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
