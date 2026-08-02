'use client';

/**
 * 실행이 보고한 agent 결과 — 최근 연결 테스트 카드의 3단(가장 아래) 계층.
 *
 * 카드의 계층: 이 실행이 통과했나(제목행 #N + pill) → 얼마나(집계 타일) → 어느 것(여기).
 * 그래서 이 블록은 위와 구분선으로 끊고, 자기 제목(13/600)을 따로 갖는다.
 *
 * 30건 규모를 전제로 짠 목록이다 —
 *  - 판정별로 묶고 실패를 맨 위에 둔다. 운영자가 이 목록에 오는 이유는 "뭐가 실패했나"
 *    라서, 27번째 행에 묻히면 목록이 없는 것과 같다. wire 순서에는 의미가 없다
 *    (확정 정보 표는 Step 2 요청 순서를 지키지만, 그건 다른 질문에 답하는 표다)
 *  - 판정은 그룹 헤더가 한 번만 말한다. 행마다 pill 을 달면 30개의 같은 pill 이
 *    목록을 덮는다
 *  - 그래서 행은 한 줄 — Resource ID + Agent ID. 밀도가 두 배가 되어 한 화면에
 *    8건이 들어온다
 *  - 그룹 헤더는 sticky: 스크롤 중에도 지금 보는 행이 어느 판정인지 남는다
 *
 * 실행 중에는 이 목록이 곧 진행 사항이다. agent 가 하나씩 정착하므로 완료 수와 아직
 * 안 올라온 몫이 동시에 읽힌다.
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

/** 조치가 필요한 순서 — 실패가 맨 위, 이미 끝난 성공이 맨 아래. */
const GROUP_ORDER: readonly TcVerdict[] = ['FAIL', 'RUNNING', 'UNKNOWN', 'SUCCESS'];

const GROUP_PILL: Record<TcVerdict, { tone: 'ok' | 'err' | 'warn' | 'off'; label: string }> = {
  FAIL: { tone: 'err', label: '실패' },
  RUNNING: { tone: 'warn', label: '진행 중' },
  UNKNOWN: { tone: 'off', label: '미확인' },
  SUCCESS: { tone: 'ok', label: '성공' },
};

export function TcAgentResultList({
  rows,
  running,
  expectedTotal,
  separated,
}: {
  rows: readonly TcAgentRow[];
  /** 실행 중에는 진행 바 + "n/m 완료", 끝났으면 총 건수. */
  running: boolean;
  /** 확정 리소스 수 — 진행률의 분모. 0 이면 아직 모른다는 뜻이라 바를 감춘다. */
  expectedTotal: number;
  /** 위에 집계 계층이 실제로 있는가 — 없으면 구분선이 나눌 것도 없다. */
  separated: boolean;
}): ReactElement | null {
  if (rows.length === 0) return null;

  const { done, total } = runProgress(rows, expectedTotal);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // 분모를 모르면 비율을 그릴 수 없다 — 받은 행 수로 100% 를 그리면 아직 보고하지
  // 않은 agent 가 없는 것처럼 보인다.
  const showBar = running && expectedTotal > 0;

  const groups = GROUP_ORDER.map((verdict) => ({
    verdict,
    items: rows.filter((row) => row.verdict === verdict),
  })).filter((group) => group.items.length > 0);

  return (
    // 구분선 + 넉넉한 여백이 "집계 → 목록" 의 단 경계다.
    <div className={separated ? 'mt-5 border-t border-[var(--pl-border)] pt-4' : 'mt-5'}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold text-[var(--pl-text-strong)]">Agent별 결과</p>
        <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          {running ? `${done}/${total} 완료` : `총 ${rows.length}건`}
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

      {/* 30건이 와도 카드가 늘어나지 않도록 높이를 고정하고 안에서 스크롤한다.
          8행까지는 통째로 들어가서, 흔한 규모에서 행이 반쯤 잘리지 않는다. */}
      <div className="mt-1 max-h-[300px] overflow-y-auto">
        {groups.map((group) => (
          <section key={group.verdict} aria-label={`${GROUP_PILL[group.verdict].label} ${group.items.length}건`}>
            {/* sticky — 스크롤이 그룹 중간에 있어도 어느 판정인지 사라지지 않는다.
                배경을 깔지 않으면 아래 행이 헤더를 통과해 보인다. */}
            <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[var(--pl-bg-card)] py-1.5 pr-3">
              <TcPill tone={GROUP_PILL[group.verdict].tone} label={GROUP_PILL[group.verdict].label} />
              <span className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                {group.items.length}건
              </span>
            </div>
            {group.items.map((row, index) => (
              <div
                key={`${row.resourceId}-${row.agentId ?? index}`}
                // pr-3 — 스크롤바가 Agent ID 를 물지 않게 띄운다.
                className="flex items-center gap-3 border-b border-[var(--pl-gray-100)] py-1.5 pr-3 last:border-b-0"
              >
                <ResourceIdCell
                  value={row.resourceId}
                  label="Resource ID"
                  maxWidthClass="min-w-0 flex-1"
                />
                {/* 같은 리소스가 여러 줄일 때 둘을 가르는 유일한 값 — 폭을 고정해
                    Resource ID 쪽 절단 위치가 행마다 흔들리지 않게 한다. */}
                <span className="w-[86px] flex-none truncate text-right font-mono text-[11px] text-[var(--pl-text-faint)]">
                  {row.agentId ?? <Dash />}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
