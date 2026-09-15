'use client';

/**
 * 기간 버튼 + 팝오버 — preset rail on the left, two months on the right, 적용 at the
 * bottom (`design/admin/target-source-timeline.html`).
 *
 * Nothing here applies on its own. A preset click and a day click both move a DRAFT
 * range; the table only changes when 적용 is pressed. That is the point of the control:
 * picking a start date would otherwise fire a query for a period the operator has not
 * finished describing, and every preset click would fire another.
 *
 * Single-use by design — it knows this screen's two dates and nothing else, so it stays
 * beside the page instead of becoming a `lib/` control with options nobody asked for.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';

import { cn } from '@/lib/theme';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  addDays,
  dayCount,
  parseDayString,
  toDayString,
} from '@/app/admin/pipelines/queue/integration-timeline/_format';

export interface DateRangePickerProps {
  /** Applied range — `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
}

type PresetSpan = number | 'month' | 'prev-month' | 'year';

interface Preset {
  label: string;
  span: PresetSpan;
}

const PRESETS: readonly Preset[] = [
  { label: '최근 7일', span: 6 },
  { label: '최근 14일', span: 13 },
  { label: '최근 21일', span: 20 },
  { label: '최근 30일', span: 29 },
  { label: '최근 90일', span: 89 },
  { label: '이번 달', span: 'month' },
  { label: '지난 달', span: 'prev-month' },
  { label: '올해', span: 'year' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** A preset resolved against today. Exported so the page can seed its default range. */
export function presetRange(span: PresetSpan, today: Date): { from: string; to: string } {
  if (typeof span === 'number') {
    return { from: toDayString(addDays(today, -span)), to: toDayString(today) };
  }
  if (span === 'month') {
    return {
      from: toDayString(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toDayString(today),
    };
  }
  if (span === 'prev-month') {
    return {
      from: toDayString(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: toDayString(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  return { from: toDayString(new Date(today.getFullYear(), 0, 1)), to: toDayString(today) };
}

/**
 * Quick spans offered as one-click buttons in the filter row (owner, 2026-09-15: 7 · 14 ·
 * 21 days, plus 30). `span` is days minus one — today counts, so 최근 7일 is today−6 … today.
 */
export const QUICK_SPANS: ReadonlyArray<{ label: string; span: number }> = [
  { label: '7일', span: 6 },
  { label: '14일', span: 13 },
  { label: '21일', span: 20 },
  { label: '30일', span: 29 },
];

/** Which quick span the applied range IS, if any — the custom calendar leaves none pressed. */
export function quickSpanOf(range: { from: string; to: string }, today: Date): number | null {
  const hit = QUICK_SPANS.find((quick) => {
    const preset = presetRange(quick.span, today);
    return preset.from === range.from && preset.to === range.to;
  });
  return hit ? hit.span : null;
}

/** The screen's default window — 최근 7일, the first quick button. */
export const defaultRange = (today: Date): { from: string; to: string } =>
  presetRange(6, today);

const styles = {
  wrap: 'relative',
  trigger:
    'inline-flex h-8 min-w-[250px] items-center justify-between gap-2 rounded-[var(--pl-r-ctl)] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-2.5 text-[14px] tabular-nums text-[var(--pl-text-strong)] hover:border-[var(--pl-border-strong)]',
  pop: 'absolute left-0 top-[38px] z-20 grid grid-cols-[128px_1fr] gap-3.5 rounded-[var(--pl-r-card)] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-3.5 shadow-[var(--pl-shadow-lg)]',
  presets: 'grid content-start gap-0.5 border-r border-[var(--pl-border)] pr-2.5',
  preset:
    'rounded-md px-2 py-1.5 text-left text-[14px] text-[var(--pl-text-medium)] hover:bg-[var(--pl-bg-inner)]',
  presetCurrent: 'bg-[var(--pl-primary-bg)] font-semibold text-[var(--pl-primary)]',
  months: 'grid grid-cols-[repeat(2,224px)] gap-[18px]',
  month: 'grid gap-1.5',
  monthHead:
    'flex items-center justify-between text-[14px] font-semibold text-[var(--pl-text-strong)]',
  monthNav:
    'h-6 w-6 rounded-md text-[var(--pl-text-weak)] hover:bg-[var(--pl-bg-inner)] hover:text-[var(--pl-text-strong)]',
  monthNavHidden: 'invisible',
  grid: 'grid grid-cols-7',
  weekday: 'h-5 text-center text-[12px] text-[var(--pl-text-faint)]',
  day: 'relative h-8 p-0 text-[14px] text-[var(--pl-text-medium)]',
  dayInRange: 'bg-[var(--pl-primary-bg)]',
  dayFirst: 'rounded-l-lg',
  dayLast: 'rounded-r-lg',
  // 미래 날짜는 고를 수 있다 — 막는 것은 기간이 아니라 사실이고, 오늘 이후에 만들어진
  // 대상은 그냥 없다. faint 는 "여기엔 아무것도 없을 것"이라는 말이다.
  dayFuture: 'text-[var(--pl-text-faint)]',
  dayFace: 'absolute inset-0.5 grid place-items-center rounded-md',
  dayFaceHover: 'hover:bg-[var(--pl-bg-inner)]',
  dayFaceInRange: 'text-[var(--pl-primary)]',
  dayFaceEdge: 'bg-[var(--pl-primary)] font-semibold text-[var(--pl-white)]',
  todayDot:
    'absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current',
  foot: 'col-span-full flex items-center gap-2.5 border-t border-[var(--pl-border)] pt-2.5 text-[14px] text-[var(--pl-text-weak)]',
  hint: 'tabular-nums',
  spacer: 'flex-1',
} as const;

interface Draft {
  from: string;
  to: string;
  /** First click of a new range — set until the second click closes it. */
  anchor: string | null;
  hover: string | null;
  /** First of the two months on screen. */
  view: Date;
}

const openingDraft = (from: string, to: string): Draft => {
  const end = parseDayString(to);
  return {
    from,
    to,
    anchor: null,
    hover: null,
    view: new Date(end.getFullYear(), end.getMonth() - 1, 1),
  };
};

/** The span being drawn — the anchor's provisional range while picking, else the draft. */
const drawnSpan = (draft: Draft): { lo: string; hi: string } => {
  const [a, b] = draft.anchor ? [draft.anchor, draft.hover ?? draft.anchor] : [draft.from, draft.to];
  return a <= b ? { lo: a, hi: b } : { lo: b, hi: a };
};

export function DateRangePicker({ from, to, onApply }: DateRangePickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => openingDraft(from, to));
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const today = toDayString(new Date());

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape and an outside click both mean "leave it as it was" — the draft is discarded
  // by the next open, which re-seeds from the applied range.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: MouseEvent): void => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, close]);

  const openPop = (): void => {
    setDraft(openingDraft(from, to));
    setOpen(true);
  };

  const pickDay = (day: string): void => {
    setDraft((current) => {
      if (!current.anchor) return { ...current, anchor: day, hover: day };
      const [lo, hi] = current.anchor <= day ? [current.anchor, day] : [day, current.anchor];
      return { ...current, from: lo, to: hi, anchor: null, hover: null };
    });
  };

  const span = drawnSpan(draft);
  const hint = draft.anchor
    ? `${span.lo} 부터 · 끝 날짜를 고르세요`
    : `${span.lo} – ${span.hi} · ${dayCount(span.lo, span.hi)}일`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={triggerRef}
          className={styles.trigger}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openPop())}
        >
          <span>
            {from} – {to}
          </span>
          <CalendarGlyph />
        </button>
      </div>

      {open && (
        <div className={styles.pop} role="dialog" aria-label="기간 선택">
          <div className={styles.presets}>
            {PRESETS.map((preset) => {
              const range = presetRange(preset.span, new Date());
              const current = range.from === draft.from && range.to === draft.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-current={current}
                  className={cn(styles.preset, current && styles.presetCurrent)}
                  onClick={() =>
                    setDraft((draftState) => ({
                      ...openingDraft(range.from, range.to),
                      view: draftState.view,
                    }))
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className={styles.months}>
            {[0, 1].map((offset) => (
              <MonthGrid
                key={offset}
                first={new Date(draft.view.getFullYear(), draft.view.getMonth() + offset, 1)}
                span={span}
                today={today}
                picking={draft.anchor !== null}
                showPrev={offset === 0}
                showNext={offset === 1}
                onShift={(months) =>
                  setDraft((current) => ({
                    ...current,
                    view: new Date(current.view.getFullYear(), current.view.getMonth() + months, 1),
                  }))
                }
                onHover={(day) => setDraft((current) => ({ ...current, hover: day }))}
                onPick={pickDay}
              />
            ))}
          </div>

          <div className={styles.foot}>
            <span className={styles.hint}>{hint}</span>
            <span className={styles.spacer} />
            <PlButton onClick={close}>닫기</PlButton>
            <PlButton
              variant="primary"
              onClick={() => {
                onApply({ from: draft.from, to: draft.to });
                close();
              }}
            >
              적용
            </PlButton>
          </div>
        </div>
      )}
    </div>
  );
}

interface MonthGridProps {
  first: Date;
  span: { lo: string; hi: string };
  today: string;
  picking: boolean;
  showPrev: boolean;
  showNext: boolean;
  onShift: (months: number) => void;
  onHover: (day: string) => void;
  onPick: (day: string) => void;
}

function MonthGrid({
  first,
  span,
  today,
  picking,
  showPrev,
  showNext,
  onShift,
  onHover,
  onPick,
}: MonthGridProps): ReactElement {
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  return (
    <div className={styles.month}>
      <div className={styles.monthHead}>
        <button
          type="button"
          aria-label="이전 달"
          className={cn(styles.monthNav, !showPrev && styles.monthNavHidden)}
          onClick={() => onShift(-1)}
        >
          ‹
        </button>
        <span>
          {first.getFullYear()}년 {first.getMonth() + 1}월
        </span>
        <button
          type="button"
          aria-label="다음 달"
          className={cn(styles.monthNav, !showNext && styles.monthNavHidden)}
          onClick={() => onShift(1)}
        >
          ›
        </button>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className={styles.weekday}>
            {weekday}
          </div>
        ))}
      </div>
      <div className={styles.grid}>
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(first.getFullYear(), first.getMonth(), index + 1);
          const day = toDayString(date);
          const inRange = day >= span.lo && day <= span.hi;
          const edge = day === span.lo || day === span.hi;
          return (
            <button
              key={day}
              type="button"
              aria-label={day}
              className={cn(
                styles.day,
                inRange && styles.dayInRange,
                day === span.lo && styles.dayFirst,
                day === span.hi && styles.dayLast,
                day > today && styles.dayFuture,
              )}
              onMouseEnter={() => picking && onHover(day)}
              onClick={() => onPick(day)}
            >
              <span
                className={cn(
                  styles.dayFace,
                  edge ? styles.dayFaceEdge : styles.dayFaceHover,
                  inRange && !edge && styles.dayFaceInRange,
                )}
              >
                {index + 1}
                {day === today && <span className={styles.todayDot} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarGlyph(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="text-[var(--pl-text-weak)]"
    >
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 7h12M5 1.5v3M11 1.5v3" />
    </svg>
  );
}
