'use client';

/**
 * 요약 카운트 줄 — 이 대상의 논리 DB 가 최근 7일에 무엇을 했는지, 수로만.
 *
 * 판정 문장은 여기 없다: 카드 머리(알약 + 한 줄)가 이미 말했고 이 줄은 그 근거인 수만
 * 든다 (Step 5 TC 카드와 같은 규칙 — 문장은 판정만, 수는 카운트 줄이).
 *
 * 문법은 `opsStyles.tcBand` 의 카운트 줄 그대로: 점 · 라벨 · 굵은 수. 총계는 점이 없다 —
 * 버킷이 아니라 그 버킷들의 합(줄의 주어)이라, 점을 달면 다섯 번째 색처럼 읽힌다.
 *
 * ⛔ 분포 스택바는 기각됐다 (오너 2026-08-25, "긴 막대 바는 그냥 없애자") — 바로 아래
 * 카운트가 수로 말한 것을 형태로 한 번 더 말했고, 1,500 분의 96 은 어차피 몇 픽셀이었다.
 * ⛔ 모니터링 연결 상태(응답의 connectionStatus)도 걷혔다 (같은 지시) — 리소스별 연결은
 * 아래 표의 종합 상태 알약이 이미 지고 있어, 대상 단위 값 하나가 무엇을 말하는지 화면에서
 * 읽히지 않았다.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { DagAggregates } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';

const n = (value: number): string => value.toLocaleString('ko-KR');

export interface MonitoringEvidenceBodyProps {
  /** ApprovalTab 이 응답당 1회 접어 둔 집계 — 1,500행을 여기서 다시 세지 않는다. */
  agg: DagAggregates;
  /** 실패 숫자 → 보드 패널을 실패 필터로 연다. 실패 0건이면 그릴 것이 없다. */
  onShowFailed?: () => void;
  /** 1,500행 보드 패널(논리 DB 전체 현황) 진입. */
  onOpenBoard: () => void;
}

export function MonitoringEvidenceBody({
  agg,
  onShowFailed,
  onOpenBoard,
}: MonitoringEvidenceBodyProps): ReactElement {
  const b = opsStyles.tcBand;
  // 진행 중·그 외는 있을 때만 — 0 을 세우면 없다는 사실만 반복한다. 계약 밖 값(그 외)은
  // 색이 아니라 형태(파선 링)로 말한다: 읽지 못한 값이지 나쁜 값이 아니다.
  const buckets: { label: string; value: number; dot: string; ink?: string }[] = [
    { label: '성공', value: agg.succeeded, dot: b.countDotOk, ink: b.okValue },
    { label: '실패', value: agg.failed, dot: b.countDotFail, ink: b.failValue },
    { label: '스케줄 안 됨', value: agg.unscheduled, dot: b.countDotRest },
    ...(agg.running > 0
      ? [{ label: '진행 중', value: agg.running, dot: b.countDotRest }]
      : []),
    ...(agg.other > 0 ? [{ label: '그 외', value: agg.other, dot: b.countDotMissing }] : []),
  ];

  return (
    <div className={cn(b.counts, 'flex-wrap gap-y-1.5')}>
      {/* 줄의 주어 — 이 수의 단위가 무엇인지 한 번만 말하고, 나머지는 그 몫이다. */}
      <span className="flex items-center gap-1.5 border-r border-[var(--pl-border)] pr-3">
        논리 DB<b className={b.countValue}>{n(agg.dbTotal)}</b>
      </span>
      {buckets.map((part) =>
        // 실패만 진입을 진다 — 밑줄이 affordance 를 지고 색은 상태에 남는다(countLink 규칙).
        part.label === '실패' && onShowFailed && part.value > 0 ? (
          <button
            key={part.label}
            type="button"
            onClick={onShowFailed}
            aria-label={`실패 ${n(part.value)}건을 최근 7일 현황에서 보기`}
            className={cn(b.countSeg, 'cursor-pointer')}
          >
            <span className={cn(b.countDot, part.dot)} />
            {part.label}
            <b className={cn(b.countValue, part.ink, 'border-b border-current')}>{n(part.value)}</b>
          </button>
        ) : (
          <span key={part.label} className={b.countSeg}>
            <span className={cn(b.countDot, part.dot)} />
            {part.label}
            <b className={cn(b.countValue, part.ink)}>{n(part.value)}</b>
          </span>
        ),
      )}
      {/* 1,500행 보드는 패널의 것 — 이 줄에는 진입만 남는다. */}
      <button
        type="button"
        onClick={onOpenBoard}
        className="ml-auto cursor-pointer whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary)] hover:underline"
      >
        논리 DB 전체 현황 보기
      </button>
    </div>
  );
}
