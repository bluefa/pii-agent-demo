'use client';

/**
 * 모니터링 근거 행의 펼침 본문 — 스코프 캡션 + 사실 kv + 분포 스택바.
 *
 * 판정 문장은 여기 없다: 접힌 행(monitoringEvidenceHead)이 알약과 보조 줄로 이미
 * 말했고, 펼침은 그 근거만 더한다. 상태색은 바의 채움 몫이다(솔리드 배너 금지).
 * UNHEALTHY 가 세는 것은 succeededThisWeek=false 뿐 — FAILED 와 NOT_SCHEDULED 를
 * 합쳐 부풀리지 않는다. kv 의 연결 상태는 이 API(모니터링)의 것이라 라벨이 출처를
 * 밝힌다 — 연결 테스트 탭의 상태와 출처가 다르다.
 */
import type { ReactElement } from 'react';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import type { DagAggregates } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { connPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const n = (value: number): string => value.toLocaleString('ko-KR');

export interface MonitoringEvidenceBodyProps {
  data: DagStatusResponse;
  /** ApprovalTab 이 응답당 1회 접어 둔 집계 — 1,500행을 여기서 다시 세지 않는다. */
  agg: DagAggregates;
  /** Client-side fetch time — the response has no timestamp of its own. */
  fetchedAt: string;
  /** 실패 숫자 → 보드 패널을 실패 필터로 연다. 실패 0건이면 그릴 것이 없다. */
  onShowFailed?: () => void;
  /** 1,500행 보드 패널(논리 DB 전체 현황) 진입. */
  onOpenBoard: () => void;
}

export function MonitoringEvidenceBody({
  data,
  agg,
  fetchedAt,
  onShowFailed,
  onOpenBoard,
}: MonitoringEvidenceBodyProps): ReactElement {
  // 리소스 표와 같은 fold — 한 값이 두 표면에서 다른 말을 하면 안 되고, enum raw 는
  // 어느 쪽에서도 문장에 서지 않는다(툴팁 채널만).
  const conn = connPill(data.connectionStatus);
  const rest = agg.unscheduled + agg.other;
  const pct = (count: number): string =>
    agg.dbTotal === 0 ? '0%' : `${(count / agg.dbTotal) * 100}%`;

  return (
    <div>
      <p className="text-[12px] text-[var(--pl-text-weak)]">
        최근 7일 DAG 실행 기준 · {data.timezone} · 조회 {fmtDateTimeSec(fetchedAt)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
        <span>
          에이전트 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.agentTotal)}</b>개
          중 연결 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.agentConnected)}</b>
        </span>
        <span>
          논리 DB <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.dbTotal)}</b>
        </span>
        <span>
          최근 7일 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.succeeded)}</b>
        </span>
        {onShowFailed && agg.failed > 0 ? (
          // 밑줄이 affordance 를 지고 색은 상태(err)에 남는다 (countLink 규칙).
          <button
            type="button"
            onClick={onShowFailed}
            aria-label={`실패 ${n(agg.failed)}건을 최근 7일 현황에서 보기`}
            className="cursor-pointer text-[var(--pl-err-text)]"
          >
            실패 <b className="border-b border-current font-semibold">{n(agg.failed)}</b>
          </button>
        ) : (
          <span className={agg.failed > 0 ? 'text-[var(--pl-err-text)]' : undefined}>
            실패 <b className="font-semibold">{n(agg.failed)}</b>
          </span>
        )}
        <span>
          미스케줄 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.unscheduled)}</b>
        </span>
        {agg.running > 0 && (
          <span>
            실행 시작 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.running)}</b>
          </span>
        )}
        {agg.other > 0 && (
          <span>
            그 외 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.other)}</b>
          </span>
        )}
        {/* 출처가 라벨에 있다 — 연결 테스트 탭의 연결 상태와 다른 API 의 값. */}
        <span title={conn.raw ? `connectionStatus: ${conn.raw}` : undefined}>
          모니터링 연결 상태{' '}
          <b className="font-semibold text-[var(--pl-text-strong)]">{conn.label}</b>
        </span>
        {/* 1,500행 보드는 패널의 것 — 본문에는 진입만 남는다 (시안 A 유지). */}
        <button
          type="button"
          onClick={onOpenBoard}
          className="ml-auto cursor-pointer whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] hover:underline"
        >
          논리 DB 전체 현황 보기
        </button>
      </div>

      {agg.dbTotal > 0 && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full" aria-hidden>
            <span style={{ width: pct(agg.succeeded) }} className="bg-[var(--pl-ok)]" />
            <span style={{ width: pct(agg.failed) }} className="bg-[var(--pl-err)]" />
            {agg.running > 0 && <span style={{ width: pct(agg.running) }} className="bg-[var(--pl-warn)]" />}
            {/* NOT_SCHEDULED(+미지 값)는 부재 — 채도 경쟁 없이 점선으로. */}
            {rest > 0 && (
              <span
                style={{ width: pct(rest) }}
                className="self-center border-t-2 border-dashed border-[var(--pl-border-strong)]"
              />
            )}
          </span>
          <span className="flex-none text-[12px] tabular-nums text-[var(--pl-text-weak)]">
            {n(agg.succeeded)} · {n(agg.failed)} · {n(rest)}
          </span>
        </div>
      )}
    </div>
  );
}
