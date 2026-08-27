/**
 * StepPill — "n단계 · label" pill for process statuses (Figma 4:91 grammar).
 * Tone maps the Figma per-step hues onto semantic tokens: waiting states read
 * warn, in-flight states read primary, terminal reads ok, initial reads off.
 *
 * 틴트 면과 글자색이 이미 계열을 말하므로 그 안에 색 점을 또 두지 않는다 (오너 08-20).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { STEP, type ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

type Tone = 'off' | 'warn' | 'primary' | 'ok';

const STATUS_TONE: Record<ProcessStatus, Tone> = {
  IDLE: 'off',
  PENDING: 'warn',
  CONFIRMING: 'primary',
  CONFIRMED: 'primary',
  INSTALLED: 'primary',
  CONNECTED: 'warn',
  COMPLETED: 'ok',
};

const TONE_CLASS: Record<Tone, string> = {
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  primary: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
};

export interface StepPillProps {
  status: ProcessStatus;
  /**
   * 마스트헤드용 액자 (오너 08-26 "흰색 태그로 감싸볼래? Stroke 2단계 + 검은색 stroke …
   * 1단계는 강조해도 될 듯. 파란색으로 보여줘. 1은 14픽셀").
   *
   * 틴트 알약은 **목록의 문법**이다 — 이력 표에서는 한 열에 여럿이 쌓이므로 계열 색이
   * 서로를 구별한다. 마스트헤드에는 하나뿐이라 구별할 상대가 없고, 대신 그 하나가 이
   * 화면의 주어다: 흰 면 + 획이 도장과 같은 "찍힌 것"의 문법이고(CompletedStamp),
   * 그 획은 1px 이다 — 2px 은 도장(2px + 안쪽 링 한 겹)과 같은 무게라 둘이 나란히 서면
   * 어느 쪽이 이 화면의 주어인지 다투었다 (오너 08-26 "stroke 낮추자").
   * 단계 번호만 파랑으로 올라선다. 14px 숫자는 이 줄에서 「연동 대상」(14px)과 같은 급이다.
   *
   * 색이 계열을 말하지 않게 되므로 **어느 단계인지는 숫자와 낱말이 진다** — 액자는 모든
   * 상태에서 같은 모양이고, 상태별 색은 틴트 알약(`framed` 없이)이 그대로 갖고 있다.
   */
  framed?: boolean;
  className?: string;
}

export function StepPill({ status, framed = false, className }: StepPillProps): ReactElement {
  const step = STEP[status];
  const { pill } = pipelineStyles;
  if (framed) {
    return (
      <span
        className={cn(
          'inline-flex flex-none items-baseline gap-1 rounded-full border px-2.5 py-0.5',
          'border-[var(--pl-text-strong)] bg-[var(--pl-bg-card)]',
          className,
        )}
      >
        <span className="text-[14px] font-bold leading-none text-[var(--pl-primary)]">
          {step.n}
        </span>
        <span className="text-[12px] font-semibold leading-none text-[var(--pl-primary)]">
          단계
        </span>
        <span className="text-[12px] leading-none text-[var(--pl-text-weak)]" aria-hidden>
          ·
        </span>
        <span className="text-[12px] font-semibold leading-none text-[var(--pl-text-strong)]">
          {step.label}
        </span>
      </span>
    );
  }
  return (
    <span className={cn(pill.base, pill.md, TONE_CLASS[STATUS_TONE[status]], className)}>
      {step.n}단계 · {step.label}
    </span>
  );
}
