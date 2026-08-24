// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';

const NOW = new Date('2026-08-24T05:00:00Z'); // 14:00 KST

describe('LastCheckStamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return render(<LastCheckStamp lastCheck={{ status: 'SUCCESS', checkedAt: iso }} />);
  };

  it('하루 안쪽이면 상대시각으로 적고, 정확한 시각은 hover 에 남긴다', () => {
    at('2026-08-24T04:48:00Z'); // 12분 전
    const el = screen.getByText(/마지막 확인/);
    expect(el.textContent).toBe('마지막 확인 12분 전');
    // 상대만 남긴 제품들이 "그래서 언제냐"는 요청을 받았다 — 절대 시각은 지우지 않는다.
    expect(el.getAttribute('title')).toContain('(KST)');
  });

  it('스스로 흐른다 — 폴 사이에도 값이 늙는다', async () => {
    at('2026-08-24T04:48:00Z');
    expect(screen.getByText(/마지막 확인/).textContent).toBe('마지막 확인 12분 전');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByText(/마지막 확인/).textContent).toBe('마지막 확인 13분 전');
  });

  it('하루를 넘기면 절대 시각으로 바꾼다 — "2일 전"은 24시간짜리 창이다', () => {
    at('2026-08-22T23:00:00Z'); // 30시간 전
    const el = screen.getByText(/마지막 확인/);
    expect(el.textContent).toContain('(KST)');
    expect(el.textContent).not.toContain('전');
    // 이미 정확한 값이 본문이므로 툴팁이 더할 것이 없다.
    expect(el.getAttribute('title')).toBeNull();
  });

  it('시각이 없어도 확인이 실패했다면 그 사실은 남는다', () => {
    render(<LastCheckStamp lastCheck={{ status: 'FAILED' }} />);
    expect(screen.getByText('상태 확인 실패')).toBeTruthy();
  });

  it('시각도 실패도 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<LastCheckStamp lastCheck={{ status: 'SUCCESS' }} />);
    expect(container.textContent).toBe('');
  });
});
