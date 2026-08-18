// @vitest-environment jsdom
/**
 * 도장은 완료를 **선언**한다 — 그래서 판정이 틀리면 화면이 거짓말을 한다.
 * 여기서 지키는 것은 판정 두 가지다:
 *
 *   1. 허용 목록. 계약의 7개 enum 중 `COMPLETED` 하나만 완료다. `!== 'IDLE'` 같은
 *      부정형으로 갈랐다면 나머지 여섯이 전부 완료로 찍힌다.
 *   2. 도장이 없는 것은 주장이 아니다. 조회가 실패해도 "미완료"라고 쓰지 않고
 *      아무것도 그리지 않는다 — 실패를 빈 결과로 위장하지 않기 위한 유일한 방법이
 *      이 표식에서는 침묵이다.
 *
 * 시각 표기도 함께 잡는다: 도장에 들어가는 것은 날짜지 인스턴트가 아니다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getProcessStatuses = vi.fn();
vi.mock('@/app/lib/api/task-queue', () => ({
  getProcessStatuses: (...args: unknown[]) => getProcessStatuses(...args),
}));

import { getIntegrationCompletion } from '@/app/lib/api/ops';
import {
  CompletedStamp,
  CompletedStampSlot,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp';

/** `/process-statuses` 한 페이지 — 이 helper 가 읽는 것은 content[0] 뿐이다. */
const page = (row: { processStatus: string; statusChangedAt: string | null } | null) => ({
  content: row ? [{ targetSourceId: 1012, delaySeconds: null, ...row }] : [],
});

beforeEach(() => {
  getProcessStatuses.mockReset();
});

describe('getIntegrationCompletion', () => {
  it('COMPLETED 하나만 완료로 읽는다', async () => {
    getProcessStatuses.mockResolvedValue(
      page({ processStatus: 'COMPLETED', statusChangedAt: '2026-07-13T19:40:00Z' }),
    );
    await expect(getIntegrationCompletion(1012)).resolves.toEqual({
      completed: true,
      completedAt: '2026-07-13T19:40:00Z',
    });
  });

  it('나머지 여섯 단계는 전부 완료가 아니다', async () => {
    for (const status of ['IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED']) {
      getProcessStatuses.mockResolvedValue(page({ processStatus: status, statusChangedAt: '2026-07-13T19:40:00Z' }));
      await expect(getIntegrationCompletion(1012)).resolves.toEqual({
        completed: false,
        completedAt: null,
      });
    }
  });

  it('행이 없으면 완료가 아니다', async () => {
    getProcessStatuses.mockResolvedValue(page(null));
    await expect(getIntegrationCompletion(1012)).resolves.toEqual({
      completed: false,
      completedAt: null,
    });
  });

  it('대상 하나만 묻는다 — 목록 전체를 페이징하지 않는다', async () => {
    getProcessStatuses.mockResolvedValue(page(null));
    await getIntegrationCompletion(4242);
    expect(getProcessStatuses).toHaveBeenCalledWith({ targetSourceId: 4242, size: 1 }, undefined);
  });
});

describe('CompletedStamp', () => {
  it('시각이 아니라 날짜를 찍는다 (Asia/Seoul)', () => {
    render(<CompletedStamp completedAt="2026-07-13T19:40:00Z" />);
    expect(screen.getByText('2026-07-14')).toBeTruthy();
    expect(screen.getByText('연동 완료')).toBeTruthy();
  });

  it('시각을 모르면 날짜 줄이 아예 없다 — 모르는 값을 20px 로 키우지 않는다', () => {
    const { container } = render(<CompletedStamp completedAt={null} />);
    expect(screen.getByText('연동 완료')).toBeTruthy();
    expect(container.textContent).toBe('연동 완료');
  });
});

describe('CompletedStampSlot', () => {
  it('완료인 대상에만 도장을 찍는다', async () => {
    getProcessStatuses.mockResolvedValue(
      page({ processStatus: 'COMPLETED', statusChangedAt: '2026-06-15T16:47:00Z' }),
    );
    render(<CompletedStampSlot targetSourceId={1012} />);
    await waitFor(() => expect(screen.getByText('연동 완료')).toBeTruthy());
    expect(screen.getByText('2026-06-16')).toBeTruthy();
  });

  it('조회가 실패해도 미완료라고 쓰지 않는다 — 아무것도 그리지 않는다', async () => {
    getProcessStatuses.mockRejectedValue(new Error('502'));
    const { container } = render(<CompletedStampSlot targetSourceId={1012} />);
    await waitFor(() => expect(getProcessStatuses).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('reserve 면 도장이 오기 전에도 자리를 잡는다', async () => {
    getProcessStatuses.mockResolvedValue(page(null));
    const { container } = render(<CompletedStampSlot targetSourceId={1012} reserve />);
    const slot = container.querySelector('.w-\\[160px\\]');
    expect(slot).toBeTruthy();
    // 답이 "완료 아님"으로 돌아와도 자리는 그대로다 — 카드 안 다른 값의 폭이
    // 조회 결과에 따라 달라지면 안 된다.
    await waitFor(() => expect(getProcessStatuses).toHaveBeenCalled());
    expect(container.querySelector('.w-\\[160px\\]')).toBeTruthy();
  });
});
