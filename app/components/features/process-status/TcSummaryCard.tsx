'use client';

import type { ReactNode } from 'react';
import { cn, idcStyles, statusColors } from '@/lib/theme';
import {
  ActivityIcon,
  CheckIcon,
  CircleXIcon,
  ClockIcon,
  HourglassIcon,
  StatusWarningIcon,
} from '@/app/components/ui/icons';
import { fmtDateTime, fmtRelativeTime } from '@/lib/pipeline/format';
import { useNowTick } from '@/app/hooks/useNowTick';
import {
  tcElapsedLabel,
  tcSummarySentence,
  type TcBuckets,
  type TcCardState,
} from '@/lib/test-connection-summary';

export interface TcSummaryRun {
  requestedAt: string | null;
  completedAt: string | null;
}

/**
 * 첫 latest_version 응답 전의 자리 — 문장도 숫자도 아직 없다.
 *
 * 이 자리에 idle 스트립을 그리면 "아직 실행한 연결 테스트가 없습니다 / 대상 리소스 6개" 가
 * 떴다가 응답이 오면 "리소스 6개 모두 연결에 성공했어요 / 성공 6" 으로 뒤집힌다.
 * 표의 연결 상태 칸이 같은 이유로 스켈레톤을 그리는데, 그보다 먼저 읽히는 이 표면만 판단을
 * 말하고 있으면 고친 의미가 없다. 상자 크기는 idle 스트립과 같아 응답이 와도 레이아웃이
 * 뛰지 않는다.
 */
export const TcSummaryCardSkeleton = () => {
  const s = idcStyles.connProgress;
  return (
    <div className={cn(s.base, s.state.idle)} aria-busy="true" aria-live="polite">
      <div className={cn(s.head, 'flex-wrap')}>
        <span className={cn(s.skeletonBar, 'block h-[17px] w-[210px] rounded')} />
        <span className={cn(s.skeletonBar, 'block h-[13px] w-[130px] rounded')} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={cn(s.skeletonBar, 'block h-[13px] w-[150px] rounded')} />
        {/* 슬롯 CTA 자리 — idle 로 풀리면 이 자리에 Run Test 가 선다. */}
        <span className={cn(s.skeletonBar, 'block h-8 w-[104px] rounded-[10px]')} />
      </div>
    </div>
  );
};

/**
 * 카드 상태 → connProgress 표면. pending 표면은 정책 변경 상태가 처음 쓴다.
 * queued 는 running 과 같은 in-flight 표면을 공유한다 — 경고(amber)가 아니라 정상
 * 단계라, 표면 대신 글리프(시계 vs 파형)·진행 트랙·문장이 두 단계를 가른다.
 */
const SURFACE: Record<TcCardState, 'idle' | 'running' | 'pending' | 'success' | 'fail'> = {
  idle: 'idle',
  queued: 'running',
  running: 'running',
  success: 'success',
  fail: 'fail',
  'policy-changed': 'pending',
  confirmed: 'success',
};

/**
 * 카운트 줄 범례 점의 계열. `missing`(미보고·미확인)만 채운 점이 아니라 파선 링이다 —
 * 값이 없다는 사실은 색이 아니라 형태가 말한다.
 */
type CountTone = 'ok' | 'fail' | 'rest' | 'missing';

const DOT_CLASS: Record<CountTone, string> = {
  ok: cn(idcStyles.connProgress.countDot, idcStyles.connProgress.countDotColor.ok),
  fail: cn(idcStyles.connProgress.countDot, idcStyles.connProgress.countDotColor.fail),
  rest: cn(idcStyles.connProgress.countDot, idcStyles.connProgress.countDotColor.rest),
  missing: idcStyles.connProgress.countDotMissing,
};

const RunGlyph = () => (
  <svg
    className="h-[13px] w-[13px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

interface TcSummaryCardProps {
  state: TcCardState;
  buckets: TcBuckets;
  /** Latest run meta from latest_version — null until a run exists. */
  run: TcSummaryRun | null;
  /** completion-status logical_database_updated_at — the policy-changed meta line. */
  policyChangedAt?: string | null;
  /** 실행 이력 link — rendered beside the meta line whenever a run exists. */
  historyAction?: ReactNode;
  /**
   * 이 화면에서 정착을 라이브로 지켜봤을 때만 true (useTcSettleHold). 성공 체크
   * 드로우의 유일한 트리거 — 마운트 시 발견한 예전 SUCCESS 에는 연출이 없다.
   */
  drawCheck?: boolean;
  /** 슬롯의 실행 CTA (Run Test / 다시 실행) — disabled 는 카드의 runDisabled 게이트 그대로. */
  onRunTest: () => void;
  runDisabled: boolean;
  /** 슬롯의 전이 CTA (완료 승인 요청) — success 상태에서만 선다. */
  onRequestApproval: () => void;
  approvalDisabled: boolean;
}

/**
 * Step 5 run summary — the strip carries the state AND that state's one right
 * action (시안 A, tc-card round 3): a phase sentence derived from the counts with
 * its timestamps as a subline right under it, phase-aware buckets that never fold
 * 미보고 into 대기, and a single CTA slot at the counts row's right edge that
 * swaps with the folded card state (foldTcCardState). At any moment the card
 * shows one primary.
 */
export const TcSummaryCard = ({
  state,
  buckets,
  run,
  policyChangedAt,
  historyAction,
  drawCheck,
  onRunTest,
  runDisabled,
  onRequestApproval,
  approvalDisabled,
}: TcSummaryCardProps) => {
  const s = idcStyles.connProgress;
  const surface = SURFACE[state];
  const sentence = tcSummarySentence(state, buckets);
  const elapsed = tcElapsedLabel(run?.requestedAt, run?.completedAt);
  const settled = state === 'success' || state === 'fail';

  // 시안 B — 아직 끝나지 않은 실행의 경과는 브라우저의 지금으로 잰다. 계약에 진행률도
  // 예상 소요도 없으므로(install-v1 TestConnectionVersionResult 는 requested_at /
  // completed_at 뿐) 이 카드가 정직하게 셀 수 있는 유일한 수다. 정착한 실행은 계약이
  // 준 completed_at 을 그대로 쓰고 시계는 멈춘다.
  const inFlight = state === 'running' || state === 'queued';
  const now = useNowTick(inFlight && !!run?.requestedAt);
  const runningElapsed = tcElapsedLabel(run?.requestedAt, now);

  const metaParts: string[] = [];
  if (state === 'confirmed') {
    if (run) metaParts.push('최근 수행 결과 기준');
  } else if (state === 'policy-changed') {
    // 계약이 짝지은 두 시각으로 "실행이 뒤처짐"을 구체화한다 — 변경이 실행보다 최신이다.
    if (policyChangedAt) metaParts.push(`정책 변경 ${fmtDateTime(policyChangedAt)}`);
    const lastRun = run?.completedAt ?? run?.requestedAt;
    if (lastRun) metaParts.push(`마지막 실행 ${fmtDateTime(lastRun)}`);
  } else {
    // 실행 #N 은 카드에선 소음 — 회차는 실행 이력 모달이 가진다 (TcHeaderTag 와 같은 결정).
    if (settled && run?.completedAt) {
      metaParts.push(`${fmtDateTime(run.completedAt)} 완료 (${fmtRelativeTime(run.completedAt)})`);
      if (elapsed) metaParts.push(`소요 ${elapsed}`);
    } else if (inFlight && run?.requestedAt) {
      metaParts.push(`${fmtDateTime(run.requestedAt)} 요청`);
      // 폴 사이 4초 동안 카드에서 유일하게 스스로 변하는 값. 애니메이션이 "돌고 있다"를
      // 연출하는 것과 달리 이 수는 사실을 하나 더 말한다 — 얼마나 기다렸는지는 계속
      // 기다릴지 판단하는 유일한 근거고, 끝을 모르는 대기에서 사용자가 물어보는 것이
      // 그것뿐이다(NN/g, Designing for Long Waits).
      if (runningElapsed) metaParts.push(`${runningElapsed} 경과`);
    }
  }

  // 시각 메타는 헤드 우측이 아니라 문장 바로 아래 줄 — 언제의 실행·요청·변경인지는 문장의
  // 근거라, 문장과 짝으로 붙어 있어야 읽힌다. 헤드 우측엔 실행 이력 링크만 남는다.
  const metaBelowTitle = metaParts.length > 0;

  // Non-zero buckets only — but on a settled run 미보고/미확인 are anomalies and must
  // surface even though a healthy settle never produces them.
  const countParts: { label: string; value: number; tone: CountTone; className?: string }[] = [
    { label: '성공', value: buckets.ok, tone: 'ok', className: statusColors.success.textDark },
    { label: '실패', value: buckets.fail, tone: 'fail', className: statusColors.error.textDark },
  ];
  if (state === 'running') {
    // 진행 중·대기·미보고는 이 국면의 독자에게 같은 한 사실이다 — 아직 답이 없다.
    // 접고 나면 줄의 합이 총계와 같아져(성공+실패+남음, 미확인이 있으면 그것까지) 한 축이
    // 되고, 그래서 집계(보고됨 N/M)가 불필요해져 사라진다. 셋의 구분은 표의 행 상태 칸에
    // 그대로 남는다 — 카드가 순위를 매기지 않을 뿐이다. 정착한 실행에서는 접지 않는다:
    // 그때 미보고는 실제 이상신호다.
    const rest = buckets.running + buckets.waiting + buckets.unreported;
    if (rest > 0) countParts.push({ label: '남음', value: rest, tone: 'rest' });
  } else {
    if (buckets.running > 0)
      countParts.push({ label: '진행 중', value: buckets.running, tone: 'rest' });
    if (buckets.waiting > 0) countParts.push({ label: '대기', value: buckets.waiting, tone: 'rest' });
    if (buckets.unreported > 0)
      countParts.push({ label: '미보고', value: buckets.unreported, tone: 'missing' });
  }
  // 계약 밖 값은 어느 국면에서도 접지 않는다 — 보고는 됐는데 읽을 수 없다는 뜻이다.
  if (buckets.unknown > 0) countParts.push({ label: '미확인', value: buckets.unknown, tone: 'missing' });

  const okPct = buckets.total > 0 ? (buckets.ok / buckets.total) * 100 : 0;
  const failPct = buckets.total > 0 ? (buckets.fail / buckets.total) * 100 : 0;
  // 바는 진행이지 결과가 아니다 — 진행 중에만 긋는다. 정착하면 그릴 진행이 남지 않고,
  // 100% 로 꽉 찬 두 색 띠는 9px 아래 카운트 줄이 이미 수로 말한 두 값을 형태로 한 번 더
  // 그리는 것뿐이다. Figma(H2kRxFxOqqeTrPceFU4zMM)도 정착 프레임 넷(card/success-all·
  // success-partial·fail·fail-unknown) 모두 track 을 hidden 으로 두고 bottom 을 49→32 로
  // 접었다. 판정 없이 끝난 상태(미실행·시작 대기·정책 변경·확인 완료)엔 애초에 채울 것이
  // 없다: 빈 0% 바는 "0%"라는 결과 서술이거나 "멈춤"으로 읽힌다.
  //
  // 바가 최종 분할까지 굴러가는 건 settle 홀드(400ms, useTcSettleHold)가 running 프레임을
  // 붙잡아 주는 동안이다 — 다 차는 걸 보여 준 뒤에 물러난다.
  const showTrack = state === 'running';

  const slot = (() => {
    switch (state) {
      case 'idle':
        return (
          <button
            type="button"
            onClick={onRunTest}
            disabled={runDisabled}
            className={cn(idcStyles.triggerBtn.primarySm, 'shrink-0 whitespace-nowrap')}
          >
            <RunGlyph />
            Run Test
          </button>
        );
      case 'queued':
        return (
          <button
            type="button"
            disabled
            className={cn(idcStyles.triggerBtn.softSm, 'shrink-0 whitespace-nowrap')}
          >
            시작 대기…
          </button>
        );
      case 'running':
        return (
          <button
            type="button"
            disabled
            className={cn(idcStyles.triggerBtn.softSm, 'shrink-0 whitespace-nowrap')}
          >
            진행 중…
          </button>
        );
      case 'fail':
      case 'policy-changed':
        return (
          <button
            type="button"
            onClick={onRunTest}
            disabled={runDisabled}
            className={cn(idcStyles.triggerBtn.primarySm, 'shrink-0 whitespace-nowrap')}
          >
            <RunGlyph />
            다시 실행
          </button>
        );
      case 'success':
        return (
          <span className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onRunTest}
              disabled={runDisabled}
              className={cn(
                idcStyles.triggerBtn.linkNeutral,
                'whitespace-nowrap text-[12px] disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              다시 실행
            </button>
            <button
              type="button"
              onClick={onRequestApproval}
              disabled={approvalDisabled}
              className={cn(idcStyles.triggerBtn.primarySm, 'whitespace-nowrap')}
            >
              완료 승인 요청
            </button>
          </span>
        );
      default:
        // confirmed — 봉인. 이력만 남고 CTA 는 없다.
        return null;
    }
  })();

  return (
    <div className={cn(s.base, s.state[surface])}>
      {/* flex-wrap + break-keep: 좁은 카드에서 문장이 한 글자씩 세로로 부서지는 대신
          우측 이력 링크가 제 줄로 내려간다. */}
      <div className={cn(s.head, 'flex-wrap')}>
        {/* contents: 서브라인이 없으면 래퍼가 레이아웃에서 사라져 기존 한 줄 구조 그대로. */}
        <div className={metaBelowTitle ? 'flex min-w-0 flex-col gap-1' : 'contents'}>
          <div className={cn(s.title, s.titleColor[surface], 'break-keep')}>
            <span className={cn(s.icon, s.accent[surface])}>
              {state === 'success' || state === 'confirmed' ? (
                <CheckIcon className="h-[18px] w-[18px]" draw={state === 'success' && drawCheck} />
              ) : state === 'policy-changed' ? (
                <StatusWarningIcon className="h-[18px] w-[18px]" />
              ) : state === 'fail' ? (
                // 실패는 판정이지 시각이 아니다. 이 자리가 비어 있어 시계로 떨어지던 탓에
                // 실패 카드가 미실행·시작 대기와 같은 글리프를 달고 있었다 — 표면과 문장만
                // 붉을 뿐, 글리프는 아무 판정도 하지 않았다.
                //
                // Heroicons 인 `StatusErrorIcon`(r=9) 대신 Lucide `circle-x`(r=10) — 이 슬롯의
                // 나머지 Lucide 글리프와 18px 에서 1.5px 어긋나던 것을 없앤다. Toast·ErrorState
                // 의 에러 글리프는 그대로 `StatusErrorIcon` 이다.
                <CircleXIcon className="h-[18px] w-[18px]" />
              ) : state === 'queued' ? (
                // 시작 대기는 모래시계. 시계는 `idle`(실행 자체가 없음)의 글리프라, 대기가
                // 같은 시계를 쓰면 "실행이 없다"와 "실행을 기다린다"가 한 그림이 된다.
                <HourglassIcon className="h-[18px] w-[18px]" />
              ) : state === 'running' ? (
                // 파형 — 도는 시계를 대신한다. 시계는 회전 대칭이라 돌아도 화면이 변하지
                // 않았다. 파형은 형태부터 다르고, 모션이 꺼져도 트랙이 남는다.
                <ActivityIcon className="h-[18px] w-[18px]" />
              ) : (
                // 남는 것은 `idle` 하나뿐이다 — 실행이 없다는 사실만 말하므로 시계가 맞다.
                // ⚠️ 이 자리는 폴백이지 기본값이 아니다. 상태를 추가하면 위에 분기를 세울 것:
                //    `fail` 이 여기로 떨어져 실패 카드가 미실행과 같은 글리프를 달고 있었다.
                <ClockIcon className="h-[18px] w-[18px]" />
              )}
            </span>
            {sentence}
          </div>
          {/* The subline reuses the title's 18px icon slot so its clock and text align with
              the title's icon and text columns (text starts at 18px + gap-2 = 26px). */}
          {metaBelowTitle && (
            <span
              className={cn(
                // pending 표면에서 #6B7684 는 4.37:1 로 AA 미달 — 정책 변경의 메타는 경고 판이다.
                state === 'policy-changed' ? s.countsWarn : s.counts,
                'flex items-center gap-2',
              )}
            >
              <span className={s.icon}>
                <ClockIcon className="h-3 w-3" />
              </span>
              {metaParts.join(' · ')}
            </span>
          )}
        </div>
        {run ? historyAction : null}
      </div>
      {showTrack && (
        <div className={s.track}>
          {/* 시안 A — 채움 아래 깔리는 행진 무늬. 위의 불투명한 판정 채움이 덮고 남은
              구간, 즉 아직 답이 오지 않은 만큼만 드러나 왼쪽으로 흐른다. 시작 직후엔
              트랙 전체가 흐르고(폭 0 의 빈 회색 바가 사라진다), 모두 보고되면 남는
              구간이 없어 저절로 멈춘다 — 그 프레임은 문장이 받는다(시안 E). */}
          <div className={s.trackMarch} aria-hidden="true" />
          {/* Segmented, not single-color: the bar carries the verdict split itself. */}
          {/* 250ms — settle 홀드(400ms, useTcSettleHold)보다 짧아야 한다. 폴 사이의 값
              점프를 굴리는 것도 이 transition 이다 (ScanRunningState 의 진행바와 동일). */}
          <div className="absolute inset-y-0 left-0 flex w-full">
            <div
              className={cn('h-full transition-[width] duration-[250ms] ease-out', s.fillColor.success)}
              style={{ width: `${okPct}%` }}
            />
            <div
              className={cn('h-full transition-[width] duration-[250ms] ease-out', s.fillColor.fail)}
              style={{ width: `${failPct}%` }}
            />
          </div>
        </div>
      )}
      <div className={cn('flex items-center justify-between gap-3', showTrack && 'mt-[9px]')}>
        <span className={state === 'policy-changed' ? s.countsWarn : s.counts}>
          {/* 시작 대기도, 보고 0건으로 정착한 실행도 idle 과 같은 대상 서술 — 카운트를
              그리면 "성공 0 · 실패 0 · 미보고 N"처럼 판정이 없다는 사실만 세 번 반복한다.
              confirmed 도 같은 규칙: 마지막 실행 뒤 확정된 유닛만 남으면 보고가 0건이다. */}
          {state === 'idle' ||
          state === 'queued' ||
          ((settled || state === 'confirmed') && buckets.reported === 0) ? (
            <>대상 리소스 {buckets.total}개</>
          ) : state === 'policy-changed' ? (
            <>연결 테스트를 다시 수행해야 합니다</>
          ) : (
            /* 시안 C: 가운뎃점 대신 범례 점. 판정 둘은 트랙의 채움 색을 그대로 쓴다 — 바가
               서 있는 진행 중엔 이 줄이 그 범례를 겸하고, 바가 물러난 정착 뒤에도 같은 두
               색이 같은 두 판정을 계속 가리킨다. 색만으로 말하지 않도록 단어는 남긴다. */
            <span className={s.countList}>
              {countParts.map((part) => (
                <span key={part.label} className={s.countSeg}>
                  <span className={DOT_CLASS[part.tone]} />
                  {part.label}
                  <b className={cn(s.countValue, part.className)}>{part.value}</b>
                </span>
              ))}
            </span>
          )}
        </span>
        {slot}
      </div>
    </div>
  );
};
