/**
 * P6 연동 시점 — the screen's pure display + calendar helpers.
 *
 * No React, no I/O, so every rule below is testable on its own. Two rules matter:
 *  - a lead time is rendered from the SECONDS the server computed, never from the two
 *    dates beside it (the contract computes it so the list can be sorted on it);
 *  - a server date is read, not re-zoned. The BFF sends the offset it means, so the
 *    calendar day is the one written in the string — parsing it to an instant and
 *    re-formatting would move a 2026-07-02T00:30:00+09:00 row into the previous day.
 */

/** What an absent value looks like in a cell (mockup `.dim`). */
export const EMPTY_CELL = '–';

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/**
 * `lead_time_seconds` → the Korean grammar the api-spec fixes: `N일 N시간`, under a day
 * `N시간`, under an hour `1시간 미만`. `null` (never installed) has no duration to say.
 */
export function formatLeadTime(seconds: number | null): string {
  if (seconds === null) return EMPTY_CELL;
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간`;
  return '1시간 미만';
}

/** A wire date-time → the calendar day it was written on, verbatim. */
export function formatWireDay(value: string | null): string {
  if (!value) return EMPTY_CELL;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : EMPTY_CELL;
}

// ── Calendar days (the picker's own axis) ───────────────────────────────────
// These are DATES the operator picks, not instants a server sent, so local-time
// `Date` is the right vehicle: `from`/`to` go on the wire as `YYYY-MM-DD` and the
// server decides what midnight means.

/** Local `Date` → `YYYY-MM-DD`. */
export function toDayString(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → local midnight. */
export function parseDayString(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * The applied range as the trigger says it — `9월 9일 – 15일`, across months
 * `8월 28일 – 9월 3일`, across years `2025년 12월 30일 – 2026년 1월 5일`. Only the trigger
 * speaks this way; table cells stay `YYYY-MM-DD` because they are a sortable column.
 */
export function formatDayRange(from: string, to: string): string {
  const a = parseDayString(from);
  const b = parseDayString(to);
  const md = (d: Date): string => `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const ymd = (d: Date): string => `${d.getFullYear()}년 ${md(d)}`;
  if (a.getFullYear() !== b.getFullYear()) return `${ymd(a)} – ${ymd(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${md(a)} – ${md(b)}`;
  if (a.getDate() === b.getDate()) return md(a);
  return `${md(a)} – ${b.getDate()}일`;
}

/** Inclusive day count of `from`–`to` (the picker's footer hint). */
export function dayCount(from: string, to: string): number {
  const ms = parseDayString(to).getTime() - parseDayString(from).getTime();
  return Math.round(ms / (SECONDS_PER_DAY * 1000)) + 1;
}
