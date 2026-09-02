'use client';

/**
 * DAG 상세 모달 — 주간 보드의 "상세 보기"에서 연다. 셋을 한 화면에 둔다: 그 DAG 의 최근
 * 7일(판정·일수·스트립), 이름 전문(열에서는 가운데를 접어 보여 준다), Airflow 행.
 *
 *  - 셸·계층은 ScanDetailModal 그대로다 (오너 2026-09-03: "기존 모달 디자인을 따라가라"):
 *    ModalShell 기본 폭, 제목 줄에 판정 알약, 그 아래 LdbViewModal 의 메타 줄(회색 태그 +
 *    mono 정체), 한 문장에 큰 수 하나(20px primary), 12/500 라벨의 절, 바닥은 `TimeField`
 *    줄(border-t · pt-3.5). 푸터도 ✕ 도 없다 — Esc·scrim 이 닫는다.
 *  - 상태는 이미 받아 둔 dag-status 행 그대로다 — 모달이 다시 조회하지 않는다. 같은
 *    값을 두 곳에서 계산하면 보드와 모달이 서로 다른 말을 하는 날이 온다. 판정 알약은
 *    `succeededThisWeek` 원문이고, 문장의 수는 스트립이 이미 보여 주는 성공 **일수**다 —
 *    같은 사실의 재계산이 아니라 다른 사실(며칠)이다.
 *  - 조회하는 건 주소 하나뿐(assumed §11). 화면은 4상태다 (오너 2026-09-02, 시안 E):
 *    조회 중 · 생성됨(주소 있음) · 없음(200 이지만 빈 본문) · 실패. 없음은 다시 둘로 갈린다 —
 *    행에 DAG 이름도 없으면 "아직 생성되지 않았어요"(§10 의 이름은 Pipeline Manager 명부의
 *    거울이라, 이름도 주소도 없는 것은 파이프라인이 아직 없다는 사실이다, PR #707),
 *    이름은 있는데 주소만 없으면 "주소가 없어요"다. **재시도는 조회가 실패했을 때만** —
 *    업스트림이 이미 "없다"고 답한 것을 다시 물어도 답은 같다(실패와 빈 결과는 다른 사실이다).
 *    다시 시도는 실패 문장 옆의 작은 단추다 — 푸터가 없으므로 자리도 행 안이다.
 *  - 주소 원문은 화면에 서지 않는다 (Google Cloud Composer 의 "Open Airflow UI" 문법 —
 *    콘솔은 주소를 보여 주지 않고 여는 링크만 준다; 링크 문구는 동작을 말한다, Google
 *    developer style "link text"). 여는 길은 Airflow 행의 링크 하나다 (오너 2026-09-03,
 *    푸터 CTA 제거) — 그래서 주소 복사 단추도 없다. DAG 이름 복사만 남는다.
 *  - 패널 위에 겹치는 2단 레이어다. 이 모달이 열려 있는 동안 패널의 Esc 는 꺼진다
 *    (AirflowTab 이 closeOnEsc 로 넘긴다) — 그러지 않으면 Esc 한 번에 둘 다 닫힌다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getAirflowHost } from '@/app/lib/api/ops';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TimeField } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { DayStrip } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';
import {
  agentDisplayName,
  dayCellKind,
  type DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

/** 주소 조회 — 'loaded' 의 빈 url 은 "업스트림이 주소를 주지 않았다"는 사실이다. */
type HostFetch = { phase: 'loading' } | { phase: 'failed' } | { phase: 'loaded'; url: string };

/** 화면이 갈리는 네 갈래 — 조회의 세 국면에서 'loaded' 를 주소 유무로 한 번 더 가른다. */
type HostView = 'loading' | 'ready' | 'absent' | 'failed';

const hostView = (host: HostFetch): HostView =>
  host.phase === 'loaded' ? (host.url ? 'ready' : 'absent') : host.phase;

/** 절의 라벨 — ScanDetailModal 의 열 머리와 같은 12/500 weak. */
const LABEL = 'text-[12px] font-medium text-[var(--pl-text-weak)]';

/**
 * Airflow 행의 상태 한 줄 — 점 + 문장. 점은 카운트 줄의 8px 점(`tcBand.countDot`)이고, 색은
 * 바닥용 짝을 쓴다: 흰 면에서도 `--pl-ok` 는 3:1 아래라(2.40) 램프 한 칸 아래인 `-text` 계열이
 * 그래픽 기준을 넘긴다(카운트 점의 실측과 같은 판단). 부재는 회색 점 — 색이 없는 것이 사실이다.
 */
function HostLine({
  dot,
  children,
}: {
  dot: string;
  children: ReactNode;
}): ReactElement {
  const b = opsStyles.tcBand;
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] text-[var(--pl-text-strong)]">
      <span className={cn(b.countDot, dot)} aria-hidden />
      {children}
    </span>
  );
}

function DagDetailBody({ row, timezone }: { row: DagDbRow; timezone: string }): ReactElement {
  const [host, setHost] = useState<HostFetch>({ phase: 'loading' });
  const [reload, setReload] = useState(0);
  const { db } = row;
  const b = opsStyles.tcBand;

  useAbortableEffect(
    (signal) => {
      setHost({ phase: 'loading' });
      return getAirflowHost(db.databaseUri, { signal })
        .then((url) => {
          if (signal.aborted) return;
          setHost({ phase: 'loaded', url: (url ?? '').trim() });
        })
        .catch(() => {
          if (signal.aborted) return;
          setHost({ phase: 'failed' });
        });
    },
    [db.databaseUri, reload],
  );

  const view = hostView(host);
  const url = host.phase === 'loaded' ? host.url : '';
  // 스트립과 같은 판정 함수로 센다 — 셀이 초록인 날이 곧 성공한 날이다.
  const successDays = db.days.filter((day) => dayCellKind(day.status) === 'ok').length;

  return (
    <>
      {/* 판정은 제목 줄에 — ScanDetailModal 이 스캔 결과 알약을 제목에 두는 것과 같다. */}
      <h3
        id="dag-detail-title"
        className="flex items-center gap-2 text-[16px] font-bold text-[var(--pl-text-strong)]"
      >
        DAG 상세
        {db.succeededThisWeek ? (
          <TcPill tone="ok" label="최근 7일 성공" />
        ) : (
          <TcPill tone="err" label="성공 없음" />
        )}
      </h3>
      {/* 어느 행에서 열었는지 — LdbViewModal 의 메타 줄 문법(태그 + mono 정체). */}
      <div className="mt-2 flex items-center gap-2">
        <span className={cn(tqStyles.tag.base, tqStyles.tag.gray)}>{agentDisplayName(row.resourceId)}</span>
        <span className={tqStyles.appTable.tdMono}>
          {db.databaseName ?? db.databaseUri}
          {db.schemaName ? ` · ${db.schemaName}` : ''}
        </span>
      </div>

      {/* 한 문장에 큰 수 하나 — "총 N개를 발견했어요" 의 계층. 0 이면 수 없이 문장만. */}
      <div className="mt-4">
        {successDays > 0 ? (
          <p className="text-[14px] text-[var(--pl-text-weak)]">
            최근 7일 중{' '}
            <b className="text-[20px] font-bold tabular-nums text-[var(--pl-primary)]">{successDays}</b>
            일 성공했어요.
          </p>
        ) : (
          <p className="text-[14px] text-[var(--pl-text-weak)]">최근 7일 성공 기록이 없어요.</p>
        )}
        <div className="mt-3">
          <DayStrip row={row} />
        </div>
      </div>

      <div className="mt-4">
        <p className={LABEL}>DAG 이름</p>
        <div className="mt-1">
          {db.dagName ? (
            <div className="flex items-start gap-1.5">
              {/* 열에서는 접히는 이름이 여기서는 전문이다 — 300자까지 오므로 줄바꿈. */}
              <p className="min-w-0 flex-1 break-all font-mono text-[14px] text-[var(--pl-text-strong)]">
                {db.dagName}
              </p>
              <CopyButton value={db.dagName} label="DAG 이름 복사" className="flex-none" />
            </div>
          ) : (
            // 이름이 없어도 열 수 있다 — 주소는 databaseUri 로 묻기 때문이다. 낱말은 보드의
            // DAG 셀과 같다: 응답에 이름이 없는 것은 실행 기록이 아니라 DAG 가 없다는 사실이다.
            <p className="text-[14px] text-[var(--pl-text-weak)]">DAG 없음</p>
          )}
        </div>
      </div>

      {/* 라벨은 '주소'가 아니라 'Airflow' 다 — 값 칸이 주소를 보여 주지 않으므로(머리 주석)
          이 행이 말하는 것은 주소가 아니라 그 DAG 가 Airflow 에 있는가, 열 수 있는가다. */}
      <div className="mt-4">
        <p className={LABEL}>Airflow</p>
        <div className="mt-1">
          {view === 'loading' && (
            <span className={cn(opsStyles.skeletonBar, 'block h-5 w-[320px]')} aria-hidden />
          )}
          {view === 'ready' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <HostLine dot={b.countDotOkGround}>DAG 생성됨</HostLine>
              {/* 흰 면 위라 `--pl-primary` 그대로(4.5:1 이상) — 바닥 위의 카운트 줄이 -hover 로
                  한 칸 내려간 것과 다른 자리다. */}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--pl-primary)] hover:underline"
              >
                Airflow에서 열기
                <Icon name="arrow-ur" size="sm" />
              </a>
            </div>
          )}
          {view === 'absent' &&
            (db.dagName === null ? (
              <>
                <HostLine dot={b.countDotRest}>DAG가 아직 생성되지 않았어요</HostLine>
                <p className="mt-1 text-[12px] text-[var(--pl-text-weak)]">
                  응답에 DAG 이름도 주소도 없어요. 파이프라인이 만들어지면 여기서 열 수 있어요.
                </p>
              </>
            ) : (
              <HostLine dot={b.countDotRest}>Airflow 주소가 없어요</HostLine>
            ))}
          {view === 'failed' && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <HostLine dot={b.countDotFailGround}>주소를 확인하지 못했어요</HostLine>
                {/* 실패에만 — 빈 답을 다시 물어도 답은 같다. */}
                <PlButton size="sm" onClick={() => setReload((k) => k + 1)}>
                  다시 시도
                </PlButton>
              </div>
              <p className="mt-1 text-[12px] text-[var(--pl-text-weak)]">잠시 후 다시 시도해 주세요.</p>
            </>
          )}
        </div>
      </div>

      {/* 바닥은 시각 줄 — ScanDetailModal 과 같은 `TimeField` 문법, 클래스 그대로. */}
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
        <TimeField label="마지막 성공">{db.lastSuccessAt ? fmtDateTime(db.lastSuccessAt) : '없음'}</TimeField>
        <TimeField label="기준">최근 7일 · {timezone}</TimeField>
      </div>
    </>
  );
}

export interface DagDetailModalProps {
  /** 열린 행 — null 이면 닫힌 상태(매 오픈이 새 마운트라 조회도 매번 새로 한다). */
  row: DagDbRow | null;
  timezone: string;
  onClose: () => void;
}

export function DagDetailModal({ row, timezone, onClose }: DagDetailModalProps): ReactElement {
  return (
    <ModalShell open={row !== null} onClose={onClose} labelledBy="dag-detail-title">
      {row && <DagDetailBody row={row} timezone={timezone} />}
    </ModalShell>
  );
}
