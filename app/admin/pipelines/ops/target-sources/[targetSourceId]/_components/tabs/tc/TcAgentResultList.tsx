'use client';

/**
 * 실행이 보고한 agent 결과 목록 — 최근 연결 테스트 카드의 본문.
 *
 * 집계 타일이 "몇 건"을 말한다면 이 목록은 "어느 것"을 말한다. 실행 중에는 이게 곧
 * 진행 사항이다: agent 가 하나씩 정착하므로, 완료 수와 아직 도는 행이 동시에 보인다.
 * 상단 진행 바는 그 비율을 그대로 그린다.
 *
 * 접기 전의 원문 배열이라 한 리소스가 여러 줄일 수 있다 — 어느 agent 가 걸렸는지는
 * 리소스 단위로 접은 판정(확정 정보 표)으로는 알 수 없어서, 여기서만 보인다.
 *
 * 목록은 리소스 표(opsStyles.table)와 같은 문법 — 약한 구분선, 면 없음. 20건이 와도
 * 카드가 늘어나지 않도록 높이를 고정하고 안에서 스크롤한다.
 */
import type { ReactElement } from 'react';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import {
  Dash,
  TcPill,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  runProgress,
  type TcAgentRow,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const VERDICT_PILL: Record<TcVerdict, { tone: 'ok' | 'err' | 'warn' | 'off'; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  FAIL: { tone: 'err', label: '실패' },
  RUNNING: { tone: 'warn', label: '진행 중' },
  UNKNOWN: { tone: 'off', label: '미확인' },
};

export function TcAgentResultList({
  rows,
  running,
  expectedTotal,
}: {
  rows: readonly TcAgentRow[];
  /** 실행 중에는 진행 바 + "n/m 완료", 끝났으면 총 건수. */
  running: boolean;
  /** 확정 리소스 수 — 진행률의 분모. 0 이면 아직 모른다는 뜻이라 바를 감춘다. */
  expectedTotal: number;
}): ReactElement | null {
  if (rows.length === 0) return null;
  const { done, total } = runProgress(rows, expectedTotal);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // 분모를 모르면 비율을 그릴 수 없다 — 받은 행 수로 100% 를 그리면 아직 보고하지
  // 않은 agent 가 없는 것처럼 보인다.
  const showBar = running && expectedTotal > 0;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold text-[var(--pl-text-strong)]">Agent별 결과</p>
        <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          {running ? `${done}/${total} 완료` : `총 ${total}건`}
        </p>
      </div>

      {/* 실행 중에만 — 끝난 실행에서 100% 바는 아무 것도 더 말해주지 않는다. */}
      {showBar && (
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--pl-gray-100)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="연결 테스트 진행"
        >
          <div
            className="h-full rounded-full bg-[var(--pl-primary)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* 4행까지는 그대로 보이고 그 위로만 스크롤 — 흔한 3~4건에서 스크롤바가 뜨면
          목록이 실제보다 길어 보인다. */}
      <div className="mt-1.5 max-h-[224px] overflow-y-auto">
        {rows.map((row, index) => (
          <div
            key={`${row.resourceId}-${row.agentId ?? index}`}
            className="flex items-center justify-between gap-3 border-b border-[var(--pl-gray-100)] py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <ResourceIdCell
                value={row.resourceId}
                label="Resource ID"
                maxWidthClass="max-w-[330px]"
              />
              {/* Agent ID 는 보조 — 같은 리소스가 여러 줄일 때 둘을 가르는 유일한 값이다. */}
              <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--pl-text-faint)]">
                {row.agentId ?? <Dash />}
              </span>
            </div>
            <TcPill
              tone={VERDICT_PILL[row.verdict].tone}
              label={VERDICT_PILL[row.verdict].label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
