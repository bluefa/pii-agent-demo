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
 *  - 성공 그룹은 접어 둔다. 헤더가 이미 "성공 30건"이라고 다 말했는데 그 아래 30줄을
 *    더 스크롤하는 것은 정보가 아니라 노동이다. 예외(실패·진행·미확인)만 펼쳐 둔다
 *  - 판정은 그룹 헤더가 한 번만 말한다. 행마다 pill 을 달면 30개의 같은 pill 이
 *    목록을 덮는다. 그래서 행은 한 줄 — 리소스 이름 + Agent ID
 *  - 리소스 이름은 경로의 마지막 세그먼트만 쓴다. 30줄의 앞부분이 전부 같아 절단이
 *    공통 접두사만 남기던 자리였다. 전체 id 는 hover 로, 복사는 확정 정보 표에 있다
 *
 * 높이 정책이 실행 중과 끝난 뒤로 갈린다:
 *  - 실행 중에는 agent 가 하나씩 정착해 행이 계속 늘어난다. 높이를 고정하지 않으면
 *    2분 넘게 아래 표를 밀어내며 화면이 움직인다. 그래서 스크롤 박스로 묶고, 아직
 *    보고하지 않은 몫은 마지막 줄에 수로 적는다
 *  - 끝난 뒤에는 접힘 덕에 대개 몇 줄이라, 박스를 풀어 페이지 스크롤에 맡긴다.
 *    카드 위에서 굴린 휠이 페이지 대신 목록을 굴리던 중첩 스크롤도 같이 사라진다
 */
import { useState, type ReactElement } from 'react';
import {
  Dash,
  TcPill,
  resourceIdTail,
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

const GROUP_HEADER = 'sticky top-0 z-[1] flex w-full items-center gap-2 bg-[var(--pl-bg-card)] py-1.5 pr-3';
const GROUP_COUNT = 'text-[12px] tabular-nums text-[var(--pl-text-weak)]';

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
  // 성공만 토글 대상이다. 나머지 판정은 이 목록이 존재하는 이유라 늘 펼쳐 둔다.
  const [showSuccess, setShowSuccess] = useState(false);

  if (rows.length === 0) return null;

  const { done, total } = runProgress(rows, expectedTotal);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // 분모를 모르면 비율을 그릴 수 없다 — 받은 행 수로 100% 를 그리면 아직 보고하지
  // 않은 agent 가 없는 것처럼 보인다.
  const showBar = running && expectedTotal > 0;
  const waiting = Math.max(0, expectedTotal - rows.length);

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

      {/* 실행 중에는 높이를 잠근다(max- 가 아니라 고정) — 3줄에서 30줄로 자라는 동안
          아래 확정 정보 표가 2분 내내 밀려 내려가던 자리다. 남는 아래쪽은 "응답 대기"
          줄이 설명한다. */}
      {/* overflow-anchor:none — 새 결과는 위쪽 그룹(실패)에 꽂히는데, 브라우저의 스크롤
          앵커링이 그만큼 스크롤을 내려 실패 그룹을 시야 밖으로 밀어냈다. */}
      <div className={running ? 'mt-1 h-[300px] overflow-y-auto [overflow-anchor:none]' : 'mt-1'}>
        {groups.map((group) => {
          const { tone, label } = GROUP_PILL[group.verdict];
          // 실행 중에는 성공도 접지 않는다 — 그때의 성공 목록은 결과가 아니라 진행이라,
          // 접어 두면 "3/30" 숫자만 움직이고 무엇이 끝났는지 사라진다.
          const collapsible = group.verdict === 'SUCCESS' && !running;
          return (
            <section key={group.verdict} aria-label={`${label} ${group.items.length}건`}>
              {/* sticky — 스크롤이 그룹 중간에 있어도 어느 판정인지 사라지지 않는다.
                  배경을 깔지 않으면 아래 행이 헤더를 통과해 보인다. */}
              {collapsible ? (
                <button
                  type="button"
                  className={GROUP_HEADER}
                  aria-expanded={showSuccess}
                  onClick={() => setShowSuccess((open) => !open)}
                >
                  <TcPill tone={tone} label={label} />
                  <span className={GROUP_COUNT}>{group.items.length}건</span>
                  <span className="text-[12px] text-[var(--pl-primary)]">
                    {showSuccess ? '접기' : '보기'}
                  </span>
                </button>
              ) : (
                <div className={GROUP_HEADER}>
                  <TcPill tone={tone} label={label} />
                  <span className={GROUP_COUNT}>{group.items.length}건</span>
                </div>
              )}
              {(!collapsible || showSuccess) &&
                group.items.map((row, index) => (
                  <div
                    key={`${row.resourceId}-${row.agentId ?? index}`}
                    // pr-3 — 스크롤바가 Agent ID 를 물지 않게 띄운다.
                    className="flex items-center gap-3 border-b border-[var(--pl-gray-100)] py-1.5 pr-3 last:border-b-0"
                  >
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--pl-text-medium)]"
                      title={row.resourceId}
                    >
                      {resourceIdTail(row.resourceId)}
                    </span>
                    {/* 같은 리소스가 여러 줄일 때 둘을 가르는 유일한 값 — 폭을 고정해
                        이름 쪽 절단 위치가 행마다 흔들리지 않게 한다. */}
                    <span className="w-[86px] flex-none truncate text-right font-mono text-[11px] text-[var(--pl-text-faint)]">
                      {row.agentId ?? <Dash />}
                    </span>
                  </div>
                ))}
            </section>
          );
        })}

        {/* 아직 한 줄도 올라오지 않은 몫 — 목록의 빈자리가 "없음"이 아니라 "대기"임을
            말하는 유일한 자리다. */}
        {running && waiting > 0 && (
          <p className="py-2 text-[12px] tabular-nums text-[var(--pl-text-faint)]">
            응답 대기 {waiting}건
          </p>
        )}
      </div>
    </div>
  );
}
