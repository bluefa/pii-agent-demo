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
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { DagAggregates } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/approvalGate';
import { attentionCount } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const n = (value: number): string => value.toLocaleString('ko-KR');

export interface MonitoringEvidenceBodyProps {
  /** ApprovalTab 이 응답당 1회 접어 둔 집계 — 1,500행을 여기서 다시 세지 않는다. */
  agg: DagAggregates;
  /** 확인 필요 숫자 → 보드 패널을 같은 필터로 연다. 0건이면 그릴 것이 없다. */
  onShowAttention?: () => void;
  /** 1,500행 보드 패널(논리 DB 전체 현황) 진입. */
  onOpenBoard: () => void;
  /** 응답 최상위 `latestTableCountSum` — 논리 DB 마다 가장 최근 성공 실행이 읽은 Table 수의 합. */
  latestTableCountSum: number;
}

export function MonitoringEvidenceBody({
  agg,
  onShowAttention,
  onOpenBoard,
  latestTableCountSum,
}: MonitoringEvidenceBodyProps): ReactElement {
  const b = opsStyles.tcBand;
  // 두 조각뿐이다 (오너 2026-08-26: healthy/unhealthy 로 분기) — 성공했나 아닌가.
  // 실행 시작·그 외를 따로 세우던 조각은 확인 필요 안으로 들어갔다: 셋의 차이는 원인이지
  // **할 일**이 아니고, 이 줄이 답하는 질문은 "몇 개를 봐야 하나" 하나다. 원인은 보드의
  // 7일 스트립이 행마다 진다.
  //
  // 두 수의 합이 항상 논리 DB 총계다. 그리고 확인 필요는 카드 머리의 UNHEALTHY 문장
  // ("성공 기록이 없는 논리 DB가 있어요")이 세는 집합과 같다 — 문장과 수가 같은 것을
  // 가리키지 않던 것이 이 줄의 오래된 문제였다.
  const buckets: { label: string; value: number; dot: string; ink?: string }[] = [
    // 이 줄은 카드가 아니라 바닥 위에 선다 — 점도 바닥용 짝을 입는다(3:1 그래픽 기준).
    { label: '성공', value: agg.succeeded, dot: b.countDotOkGround, ink: b.okValue },
    { label: '확인 필요', value: attentionCount(agg), dot: b.countDotFailGround, ink: b.failValue },
  ];

  return (
    <div className={cn(b.counts, 'flex-wrap gap-y-1.5')}>
      {/* 줄의 주어 — 이 수의 단위가 무엇인지 한 번만 말하고, 나머지는 그 몫이다. */}
      {/* 구분선은 --pl-border 가 아니다 — 그 토큰은 이 줄이 서 있는 바닥(--pl-gray-200)과
          **같은 값**이라(1.000) 선이 통째로 사라진다. 한 칸 더 진한 획이 진다. */}
      <span className="flex items-center gap-1.5 border-r border-[var(--pl-border-strong)] pr-3">
        논리 DB<b className={b.countValue}>{n(agg.dbTotal)}</b>
      </span>
      {buckets.map((part) =>
        // 확인 필요만 진입을 진다 — 밑줄이 affordance 를 지고 색은 상태에 남는다(countLink 규칙).
        part.label === '확인 필요' && onShowAttention && part.value > 0 ? (
          <button
            key={part.label}
            type="button"
            onClick={onShowAttention}
            aria-label={`확인 필요 ${n(part.value)}건을 최근 7일 현황에서 보기`}
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
      {/* Table 수 — 논리 DB 와 단위가 다른 수라 구분선 뒤에 선다(점 없음: 버킷이 아니다).
          뜻은 (?) 가 진다: 논리 DB 마다 가장 최근 성공한 DAG 실행이 읽은 Table 수의 합.
          0 은 그대로 0 — 성공 기록이 없어 읽은 Table 이 없다는 사실이다. */}
      <span className="flex items-center gap-1.5 border-l border-[var(--pl-border-strong)] pl-3">
        최근 성공 Table 수<b className={b.countValue}>{n(latestTableCountSum)}</b>
        <InfoTooltip
          variant="value"
          content="논리 DB마다 가장 최근에 성공한 DAG 실행이 읽은 Table 수를 모두 더한 값이에요."
        />
      </span>
      {/* 1,500행 보드는 패널의 것 — 이 줄에는 진입만 남는다. */}
      <button
        type="button"
        onClick={onOpenBoard}
        // 파랑도 한 칸 내려간다 — 이 줄은 바닥(gray-200) 위라 --pl-primary 가 4.17 로 AA
        // 아래다. --pl-primary-hover 가 5.41 을 낸다.
        className="ml-auto cursor-pointer whitespace-nowrap text-[12px] font-semibold text-[var(--pl-primary-hover)] hover:underline"
      >
        논리 DB 전체 현황 보기
      </button>
    </div>
  );
}
