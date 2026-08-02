/**
 * Test Connection 탭 공용 bits — tone palette + the atoms every TC card needs.
 * Tones are the design HTML's `.pill.ok/.warn/.err/.off` pairs resolved through
 * --pl-* tokens; `TcPill` is the dotted pill, the same pairs serve the flat tag
 * (`opsStyles.statusTag`) used by the 이력 table.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export type TcTone = 'ok' | 'warn' | 'err' | 'off';

/** bg + text pair — shared by the dotted pill and the flat status tag. */
export const TC_TONE_FILL: Record<TcTone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-weak)]',
};

const TC_TONE_DOT: Record<TcTone, string> = {
  ok: 'bg-[var(--pl-ok)]',
  warn: 'bg-[var(--pl-warn)]',
  err: 'bg-[var(--pl-err)]',
  off: 'bg-[var(--pl-off)]',
};

export function TcPill({ tone, label }: { tone: TcTone; label: string }): ReactElement {
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, TC_TONE_FILL[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TC_TONE_DOT[tone])} />
      {label}
    </span>
  );
}

/** Absent value — never rendered as 0 or an assumed success. */
export const Dash = (): ReactElement => <span className="text-[var(--pl-text-faint)]">—</span>;

const ID_MAX = 32;

/**
 * Cloud resource ids are paths (Azure ARM / GCP `projects/…/instances/…`) that
 * wrap over two table rows at full length. Show the tail — the part that
 * identifies the resource — and keep the full value one hover away.
 */
export function shortResourceId(value: string): string {
  if (value.length <= ID_MAX) return value;
  const segments = value.split('/').filter(Boolean);
  if (segments.length > 2) return `…/${segments.slice(-2).join('/')}`;
  return `${value.slice(0, 12)}…${value.slice(-16)}`;
}

/**
 * 경로형 id 의 마지막 세그먼트. 한 대상의 리소스 30개는 앞부분이 글자 단위로 같아서
 * (…/rg-lgs-order/providers/Microsoft.DBforMySQL/servers/) 줄과 줄을 실제로 구별하는
 * 것은 이 조각뿐이다. 경로가 아닌 id(AWS·IDC)는 그 자체가 이미 마지막 세그먼트다.
 */
export function resourceIdTail(value: string): string {
  const segments = value.split('/').filter(Boolean);
  return segments.length > 1 ? segments[segments.length - 1] : value;
}

/** Mono resource id cell — abbreviated, full value in the native tooltip. */
export function ResourceId({ value }: { value: string }): ReactElement {
  if (!value) return <Dash />;
  const short = shortResourceId(value);
  return (
    <span
      className={cn(pipelineStyles.text.mono, 'whitespace-nowrap')}
      title={short === value ? undefined : value}
    >
      {short}
    </span>
  );
}
