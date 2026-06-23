'use client';

import { cn, idcStyles } from '@/lib/theme';
import { CheckIcon, ClockIcon } from '@/app/components/ui/icons';

export type ConnProgressState = 'idle' | 'running' | 'pending' | 'success' | 'fail';

interface ConnProgressStripProps {
  state: ConnProgressState;
  label: string;
  ok: number;
  fail: number;
  pending: number;
  /** 0–100. */
  pct: number;
}

/**
 * v16 `.conn-progress` step-5 connection-test progress strip: a state-tinted card
 * with success/fail/pending counts, a percentage, and a fill bar.
 */
export const ConnProgressStrip = ({ state, label, ok, fail, pending, pct }: ConnProgressStripProps) => {
  const s = idcStyles.connProgress;
  return (
    <div className={cn(s.base, s.state[state])}>
      <div className={s.head}>
        <div className={cn(s.title, s.titleColor[state])}>
          <span className={cn(s.icon, s.accent[state])}>
            {state === 'success' ? (
              <CheckIcon className="h-[15px] w-[15px]" />
            ) : (
              <ClockIcon className={cn('h-[15px] w-[15px]', state === 'running' && 'animate-spin')} />
            )}
          </span>
          {label}
        </div>
        <div className={s.meta}>
          <span className={s.counts}>
            성공 <b className="font-bold text-[#197A3F]">{ok}</b> · 실패{' '}
            <b className="font-bold text-[#B42318]">{fail}</b> · 대기 <b className="font-bold">{pending}</b>
          </span>
          <span className={cn(s.pct, s.accent[state])}>{pct}%</span>
        </div>
      </div>
      <div className={s.track}>
        <div className={cn(s.fill, s.fillColor[state])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
