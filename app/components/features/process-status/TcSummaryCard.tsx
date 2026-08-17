'use client';

import type { ReactNode } from 'react';
import { cn, idcStyles, statusColors } from '@/lib/theme';
import { CheckIcon, ClockIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { fmtDateTime, fmtRelativeTime } from '@/lib/pipeline/format';
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
        <span className={cn(s.skeletonBar, 'block h-[15px] w-[210px] rounded')} />
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
 * 단계라, 표면 대신 아이콘 스핀·진행 트랙·문장이 두 단계를 가른다.
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
    } else if ((state === 'running' || state === 'queued') && run?.requestedAt) {
      metaParts.push(`${fmtDateTime(run.requestedAt)} 요청`);
    }
  }

  // 시각 메타는 헤드 우측이 아니라 문장 바로 아래 줄 — 언제의 실행·요청·변경인지는 문장의
  // 근거라, 문장과 짝으로 붙어 있어야 읽힌다. 헤드 우측엔 실행 이력 링크만 남는다.
  const metaBelowTitle = metaParts.length > 0;

  // Non-zero buckets only — but on a settled run 미보고/미확인 are anomalies and must
  // surface even though a healthy settle never produces them.
  const countParts: { label: string; value: number; className?: string }[] = [
    { label: '성공', value: buckets.ok, className: statusColors.success.textDark },
    { label: '실패', value: buckets.fail, className: statusColors.error.textDark },
  ];
  if (buckets.running > 0) countParts.push({ label: '진행 중', value: buckets.running });
  if (buckets.waiting > 0) countParts.push({ label: '대기', value: buckets.waiting });
  if (buckets.unreported > 0) countParts.push({ label: '미보고', value: buckets.unreported });
  if (buckets.unknown > 0) countParts.push({ label: '미확인', value: buckets.unknown });

  const okPct = buckets.total > 0 ? (buckets.ok / buckets.total) * 100 : 0;
  const failPct = buckets.total > 0 ? (buckets.fail / buckets.total) * 100 : 0;
  // 판정 없이 끝난 상태(미실행·정책 변경·확인 완료)엔 바를 긋지 않는다 — 미실행의 빈 바는
  // 0% 라는 결과 서술이고, 정책 변경의 초록 바는 이미 뒤처진 실행의 결과다. 시작 대기도
  // 긋지 않는다: 빈 0% 바는 "멈춤"으로 읽히고, 트랙의 등장 자체가 PENDING→RUNNING 전이의
  // 표현이다(스핀 시작·문장 교체와 함께). 보고 0건으로 정착한 실행도 같은 이유 — 채울
  // 판정이 없다.
  const showTrack = state === 'running' || (settled && buckets.reported > 0);

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
                <CheckIcon className="h-[15px] w-[15px]" draw={state === 'success' && drawCheck} />
              ) : state === 'policy-changed' ? (
                <StatusWarningIcon className="h-[15px] w-[15px]" />
              ) : (
                <ClockIcon
                  className={cn(
                    'h-[15px] w-[15px]',
                    state === 'running' && 'animate-spin motion-reduce:animate-none',
                  )}
                />
              )}
            </span>
            {sentence}
          </div>
          {/* pl-[26px] = icon 18px + gap-2 — 서브라인 텍스트를 문장 텍스트와 정렬. */}
          {metaBelowTitle && (
            <span
              className={cn(
                // pending 표면에서 #6B7684 는 4.37:1 로 AA 미달 — 정책 변경의 메타는 경고 판이다.
                state === 'policy-changed' ? s.countsWarn : s.counts,
                'pl-[26px]',
              )}
            >
              {metaParts.join(' · ')}
            </span>
          )}
        </div>
        {run ? historyAction : null}
      </div>
      {showTrack && (
        <div className={s.track}>
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
            <>
              {countParts.map((part, index) => (
                <span key={part.label}>
                  {index > 0 && ' · '}
                  {part.label} <b className={cn('font-bold', part.className)}>{part.value}</b>
                </span>
              ))}
              {state === 'running' && <span> · {buckets.pct}%</span>}
            </>
          )}
        </span>
        {slot}
      </div>
    </div>
  );
};
