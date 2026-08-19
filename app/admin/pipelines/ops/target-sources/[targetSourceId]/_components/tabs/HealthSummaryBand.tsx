'use client';

/**
 * 헬스 요약 밴드 (L1) — 판정 한 문장 + 스코프 캡션 + 사실 kv + 분포 스택바.
 *
 * 승인 조건(L0)의 헬스 행이 "왜"의 첫 층이다: 판정은 점+문장으로만 말하고(솔리드
 * 배너 금지 — 상태색은 점으로), 숫자는 kv 가 나른다. UNHEALTHY 문장이 세는 것은
 * succeededThisWeek=false 뿐 — FAILED 와 NOT_SCHEDULED 를 합쳐 부풀리지 않는다.
 * kv 의 연결 상태는 이 API(모니터링)의 것이라 라벨이 출처를 밝힌다 — Test
 * Connection 탭의 상태와 출처가 다르다.
 */
import { useMemo, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import {
  aggregateDagStatus,
  healthVerdict,
  type DagAggregates,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

const n = (value: number): string => value.toLocaleString('ko-KR');

const sentence = (data: DagStatusResponse, agg: DagAggregates): string => {
  const verdict = healthVerdict(data.healthStatus);
  switch (verdict.kind) {
    case 'healthy':
      return `모니터링 HEALTHY — 논리 DB ${n(agg.dbTotal)}개 중 ${n(agg.succeeded)}개가 이번 주 성공했어요`;
    case 'unhealthy':
      return `모니터링 UNHEALTHY — 논리 DB ${n(agg.noSuccess)}개가 이번 주 성공 기록이 없어요`;
    case 'unknown':
      // Wire vocabulary stays out of the copy — the raw value is in the tooltip.
      return '모니터링 상태를 판정할 수 없어요';
  }
};

const DOT: Record<'healthy' | 'unhealthy' | 'unknown', string> = {
  healthy: 'bg-[var(--pl-ok)]',
  unhealthy: 'bg-[var(--pl-err)]',
  unknown: 'bg-[var(--pl-off)]',
};

export interface HealthSummaryBandProps {
  data: DagStatusResponse;
  /** Client-side fetch time — the response has no timestamp of its own. */
  fetchedAt: string;
}

export function HealthSummaryBand({ data, fetchedAt }: HealthSummaryBandProps): ReactElement {
  // 1,500+ rows scan once per response, not per render.
  const agg = useMemo(() => aggregateDagStatus(data), [data]);
  const verdict = healthVerdict(data.healthStatus);
  const rest = agg.unscheduled + agg.other;
  const pct = (count: number): string =>
    agg.dbTotal === 0 ? '0%' : `${(count / agg.dbTotal) * 100}%`;

  return (
    <section className={pipelineStyles.card.base} aria-label="모니터링 헬스 요약">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={cn('h-2.5 w-2.5 flex-none rounded-full', DOT[verdict.kind])} />
        <p
          className="text-[16px] font-semibold text-[var(--pl-text-strong)]"
          title={verdict.kind === 'unknown' ? `healthStatus: ${verdict.raw}` : undefined}
        >
          {sentence(data, agg)}
        </p>
      </div>
      <p className="mt-1 text-[12px] text-[var(--pl-text-weak)]">
        최근 7일 DAG 실행 기준 · {data.timezone} · 조회 {fmtDateTimeSec(fetchedAt)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
        <span>
          에이전트 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.agentTotal)}</b>개
          중 연결 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.agentConnected)}</b>
        </span>
        <span>
          논리 DB <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.dbTotal)}</b>
        </span>
        <span>
          이번 주 성공 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.succeeded)}</b>
        </span>
        <span className={agg.failed > 0 ? 'text-[var(--pl-err-text)]' : undefined}>
          실패 <b className="font-semibold">{n(agg.failed)}</b>
        </span>
        <span>
          미스케줄 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.unscheduled)}</b>
        </span>
        {agg.running > 0 && (
          <span>
            진행 중 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.running)}</b>
          </span>
        )}
        {agg.other > 0 && (
          <span>
            그 외 <b className="font-semibold text-[var(--pl-text-strong)]">{n(agg.other)}</b>
          </span>
        )}
        {/* 출처가 라벨에 있다 — TC 탭의 연결 상태와 다른 API 의 값. */}
        <span>모니터링 연결 상태 <b className="font-semibold text-[var(--pl-text-strong)]">{data.connectionStatus}</b></span>
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
    </section>
  );
}
