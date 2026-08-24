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

  it('경과가 먼저, 정확한 시각이 그 뒤 — 두 값을 다른 무게로 나눠 적는다', () => {
    at('2026-08-24T04:47:40Z'); // 12분 20초 전
    expect(screen.getByText('12분 20초 전 확인')).toBeTruthy();
    // 상대만 남긴 제품들이 "그래서 언제냐"는 요청을 받았다 — 절대 시각은 지우지 않는다.
    expect(screen.getByText(/\(KST\)$/)).toBeTruthy();
  });

  it('0인 단위는 적지 않는다', () => {
    at('2026-08-24T03:00:00Z'); // 정확히 2시간 전
    expect(screen.getByText('2시간 전 확인')).toBeTruthy();
    expect(screen.queryByText(/0분/)).toBeNull();
  });

  it('스스로 흐른다 — 폴 사이에도 값이 늙는다', async () => {
    at('2026-08-24T04:47:40Z');
    expect(screen.getByText('12분 20초 전 확인')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText('12분 25초 전 확인')).toBeTruthy();
  });

  it('하루가 넘어도 경과로 말한다 — 큰 단위 두 개까지', () => {
    at('2026-08-22T02:00:00Z'); // 2일 3시간 전
    expect(screen.getByText('2일 3시간 전 확인')).toBeTruthy();
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
