/**
 * 연동 시점 — the two rules a redesign can silently break.
 *
 *  1. 리드타임 is read off `lead_time_seconds`, and its three grammars have hard edges:
 *     one second under an hour is not "0시간", and a whole number of days still prints
 *     its hours. Getting the boundary wrong is invisible on most rows.
 *  2. A server date keeps the calendar day the SERVER wrote. This is the regression the
 *     repo has already paid for once (09-11): re-zoning a `+09:00` value moves rows near
 *     midnight into the day before, and every such row lands in the wrong period.
 */
import { describe, expect, it } from 'vitest';

import {
  dayCount,
  EMPTY_CELL,
  formatLeadTime,
  formatWireDay,
  toDayString,
  parseDayString,
  addDays,
  formatDayRange,
} from '@/app/admin/pipelines/queue/integration-timeline/_format';

describe('formatLeadTime', () => {
  it('reads 일 + 시간 from a multi-day span', () => {
    // 800,880s = 9d 6h — the api-spec's own example row.
    expect(formatLeadTime(800_880)).toBe('9일 6시간');
  });

  it('keeps the 시간 half of a whole number of days', () => {
    expect(formatLeadTime(9 * 86_400)).toBe('9일 0시간');
  });

  it('drops the 일 half under one day', () => {
    expect(formatLeadTime(6 * 3_600 + 59 * 60)).toBe('6시간');
  });

  it('says 1시간 미만 rather than 0시간', () => {
    expect(formatLeadTime(3_599)).toBe('1시간 미만');
    expect(formatLeadTime(0)).toBe('1시간 미만');
  });

  it('has nothing to say for a target that never finished', () => {
    expect(formatLeadTime(null)).toBe(EMPTY_CELL);
  });
});

describe('formatWireDay', () => {
  it('keeps the day the server wrote, offset and all', () => {
    expect(formatWireDay('2026-07-02T10:12:00+09:00')).toBe('2026-07-02');
  });

  it('does not re-zone a value sitting next to midnight', () => {
    // Under a UTC "correction" this reads 2026-07-01 — a row in the wrong period.
    expect(formatWireDay('2026-07-02T00:30:00+09:00')).toBe('2026-07-02');
    expect(formatWireDay('2026-07-02T23:30:00+09:00')).toBe('2026-07-02');
  });

  it('marks an absent or unreadable value', () => {
    expect(formatWireDay(null)).toBe(EMPTY_CELL);
    expect(formatWireDay('나중에')).toBe(EMPTY_CELL);
  });
});

describe('calendar days', () => {
  it('counts an inclusive window', () => {
    expect(dayCount('2026-09-14', '2026-09-14')).toBe(1);
    expect(dayCount('2026-06-17', '2026-09-14')).toBe(90);
  });

  it('round-trips a day string through the local calendar', () => {
    expect(toDayString(parseDayString('2026-03-01'))).toBe('2026-03-01');
    expect(toDayString(addDays(parseDayString('2026-02-28'), 1))).toBe('2026-03-01');
  });
});

describe('formatDayRange', () => {
  it('drops what both ends share', () => {
    expect(formatDayRange('2026-09-09', '2026-09-15')).toBe('9월 9일 – 15일');
    expect(formatDayRange('2026-08-28', '2026-09-03')).toBe('8월 28일 – 9월 3일');
    expect(formatDayRange('2025-12-30', '2026-01-05')).toBe('2025년 12월 30일 – 2026년 1월 5일');
    expect(formatDayRange('2026-09-15', '2026-09-15')).toBe('9월 15일');
  });
});
