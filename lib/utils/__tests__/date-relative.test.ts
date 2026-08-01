import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '@/lib/utils/date';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks the units from 방금 전 up to 년 전', () => {
    expect(formatRelativeTime('2026-07-31T11:59:30Z')).toBe('방금 전');
    expect(formatRelativeTime('2026-07-31T11:57:00Z')).toBe('3분 전');
    expect(formatRelativeTime('2026-07-31T07:00:00Z')).toBe('5시간 전');
    expect(formatRelativeTime('2026-07-28T12:00:00Z')).toBe('3일 전');
    expect(formatRelativeTime('2026-04-28T12:00:00Z')).toBe('3개월 전');
    expect(formatRelativeTime('2024-07-31T12:00:00Z')).toBe('2년 전');
  });

  it('returns an empty string for an unparsable date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
