// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';

const NOW = new Date('2026-08-24T05:00:00Z'); // 14:00 KST

const TIP =
  '설치 상태를 마지막으로 확인한 시각이에요. 화면에 보이는 값은 이때 확인한 결과라, 지금 상태와는 다를 수 있어요.';

describe('LastCheckStamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return render(<LastCheckStamp lastCheck={{ status: 'SUCCESS', checkedAt: iso }} />);
  };

  it('정확한 시각이 먼저, 경과가 가운뎃점 뒤 — 한 줄로 잇는다', () => {
    const { container } = at('2026-08-24T04:47:40Z'); // 12분 20초 전
    // 두 층으로 쌓지 않는다. 시계는 절대 시각의 글리프라 그 값 바로 왼쪽에 서고,
    // 경과는 같은 줄의 주석으로 뒤따른다.
    expect(container.textContent).toBe('26. 08. 24. 13:47 · 12분 20초 전 확인');
  });

  it('0인 단위는 적지 않는다', () => {
    const { container } = at('2026-08-24T03:00:00Z'); // 정확히 2시간 전
    expect(container.textContent).toContain('2시간 전 확인');
    expect(container.textContent).not.toContain('0분');
  });

  it('스스로 흐른다 — 폴 사이에도 값이 늙는다', async () => {
    const { container } = at('2026-08-24T04:47:40Z');
    expect(container.textContent).toContain('12분 20초 전 확인');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(container.textContent).toContain('12분 25초 전 확인');
  });

  it('하루가 넘어도 경과로 말한다 — 큰 단위 두 개까지', () => {
    const { container } = at('2026-08-22T02:00:00Z'); // 2일 3시간 전
    expect(container.textContent).toContain('2일 3시간 전 확인');
  });

  it('언제 읽은 값인지는 줄이 말하고, 지금과 다를 수 있다는 사실은 툴팁이 말한다', async () => {
    const { container } = at('2026-08-24T04:47:40Z');
    const trigger = container.firstElementChild;
    if (!trigger) throw new Error('expected Tooltip container');

    expect(screen.queryByText(TIP)).toBeNull();
    // 툴팁 본문은 hover 중에만 마운트된다. 위치 계산이 microtask 로 미뤄지므로
    // act 안에서 흘려보낸 뒤 읽는다.
    await act(async () => {
      fireEvent.mouseEnter(trigger);
    });
    expect(screen.getByText(TIP)).toBeTruthy();
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
