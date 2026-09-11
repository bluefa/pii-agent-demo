/**
 * 확정 기록의 상태를 **낱말로** 말하는 한 곳 — 판정 줄의 태그와 확정 카드의 「상태」 kv 가
 * 같은 규칙을 쓴다.
 *
 * The headline used to carry a coloured dot. A colour is not a word: the reader had to know the
 * palette to learn whether the record exists. The tag says it (오너 2026-09-11), and because the
 * same fact already stood in the 확정 카드 the two must never be able to disagree — so the
 * mapping lives here and both call it.
 *
 * 톤은 낱말을 **거들 뿐**이다: 색만으로 전달되는 신호는 이 줄에 없다.
 */
/** `null` = no record: nothing is said (owner 2026-09-11 — 「미등록」 named nothing the reader knew). */
export type ConfirmedStateTag = '등록됨' | '다시 입력 필요' | null;

export type ConfirmedStateTone = 'ok' | 'warn';

export function deriveConfirmedStateTag(input: {
  confirmedCount: number;
  /** 3단계인데 확정이 이미 있다 — 그 확정으로는 다음 단계로 넘어가지 않는다. */
  reconfirmNeeded: boolean;
}): ConfirmedStateTag {
  if (input.confirmedCount === 0) return null;
  return input.reconfirmNeeded ? '다시 입력 필요' : '등록됨';
}

export const CONFIRMED_STATE_TONE: Readonly<Record<NonNullable<ConfirmedStateTag>, ConfirmedStateTone>> = {
  등록됨: 'ok',
  '다시 입력 필요': 'warn',
};

export const confirmTagStyles = {
  tag: 'inline-flex flex-none items-center rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold leading-[1.34]',
  ok: 'text-[var(--pl-ok-text)]',
  warn: 'text-[var(--pl-warn-text)]',
  off: 'text-[var(--pl-text-weak)]',
} as const;
