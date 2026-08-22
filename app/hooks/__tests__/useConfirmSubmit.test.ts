// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProcessStatus, type ProcessStatusResponse } from '@/app/lib/api';
import { useConfirmSubmit } from '@/app/hooks/useConfirmSubmit';
import { AppError } from '@/lib/errors';
import { ProcessStatus } from '@/lib/types';

// getProcessStatus 만 갈아끼운다 — 재시도 판정은 normalizeTargetSourceProcessStatus 의
// 진짜 규칙을 통과해야 의미가 있다(그 규칙이 판정의 절반이다).
vi.mock('@/app/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api')>()),
  getProcessStatus: vi.fn(),
}));

const HOLD_MS = 1000;
const TARGET_SOURCE_ID = 7;

const statusOf = (process_status: string): ProcessStatusResponse => ({
  target_source_id: TARGET_SOURCE_ID,
  process_status: process_status as ProcessStatusResponse['process_status'],
  healthy: 'UNKNOWN',
  evaluated_at: '2026-08-10T00:00:00Z',
});

const setup = (request: () => Promise<void>) => {
  const settle = vi.fn();
  const hook = renderHook(() =>
    useConfirmSubmit({
      targetSourceId: TARGET_SOURCE_ID,
      pendingStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
      request,
      settle,
    }),
  );
  return { ...hook, settle };
};

describe('useConfirmSubmit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getProcessStatus).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('holds the confirm frame before refreshing the screen', async () => {
    const { result, settle } = setup(() => Promise.resolve());
    expect(result.current.phase).toBe('form');
    expect(result.current.pending).toBe(false);

    await act(async () => { result.current.submit(); });
    expect(result.current.phase).toBe('success');
    // 갱신이 여기서 돌면 상태가 바뀌며 이 단계가 언마운트되고, 확인 프레임은
    // 그려지지도 못한 채 사라진다.
    expect(settle).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
    expect(settle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('success');
  });

  it('stays on the confirm frame while the first request is in flight', async () => {
    let release = () => {};
    const { result } = setup(() => new Promise<void>((resolve) => { release = resolve; }));

    act(() => { result.current.submit(); });
    expect(result.current.pending).toBe(true);
    expect(result.current.phase).toBe('form');

    await act(async () => { release(); });
    expect(result.current.pending).toBe(false);
    expect(result.current.phase).toBe('success');
  });

  // 재요청 중에 프레임이 'form' 으로 돌아가면 실패 프레임 → 확인 화면 → 실패 프레임으로
  // 왕복하며 화면이 깜빡인다. 요청 중임은 pending 만 말한다.
  it('keeps the failure frame while a retry is in flight', async () => {
    let release: (value: void) => void = () => {};
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result } = setup(request);

    await act(async () => { result.current.submit(); });
    expect(result.current.phase).toBe('error');

    vi.mocked(getProcessStatus).mockResolvedValue(statusOf('REQUEST_REQUIRED'));
    await act(async () => { result.current.retry(); });
    expect(result.current.pending).toBe(true);
    expect(result.current.phase).toBe('error');

    await act(async () => { release(); });
    expect(result.current.phase).toBe('success');
    expect(result.current.pending).toBe(false);
  });

  // 코드만 올린다. 서버 detail 은 진단용이고, 사용자가 읽을 문장은 모달이 코드로 고른다
  // (ADR-008 개정 / ADR-013 §D2) — 여기서 detail 이 새면 BFF 문구가 UI 카피가 된다.
  it('reports the failure as a code, never the server detail', async () => {
    const conflict = new AppError({
      message: 'approval request already pending for target_source 7',
      status: 409,
      code: 'CONFLICT',
      retriable: false,
    });
    const { result: appError } = setup(() => Promise.reject(conflict));
    await act(async () => { appError.current.submit(); });
    expect(appError.current.phase).toBe('error');
    expect(appError.current.errorCode).toBe('CONFLICT');

    // AppError 가 아닌 것이 올라오면 분류할 근거가 없다 — UNKNOWN 으로 접는다.
    const { result: bare } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await act(async () => { bare.current.submit(); });
    expect(bare.current.phase).toBe('error');
    expect(bare.current.errorCode).toBe('UNKNOWN');
  });

  // 응답만 실패하고 요청은 접수됐던 경우 — 그대로 다시 보내면 승인 요청이 두 건 생긴다.
  it('skips the re-request when the process status already moved past step 1', async () => {
    const request = vi.fn(() => Promise.reject(new Error('timeout')));
    const { result, settle } = setup(request);
    await act(async () => { result.current.submit(); });
    expect(request).toHaveBeenCalledTimes(1);

    vi.mocked(getProcessStatus).mockResolvedValue(statusOf('WAITING_APPROVAL'));
    await act(async () => { result.current.retry(); });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('success');
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('re-requests when the status says the request never landed', async () => {
    const request = vi.fn(() => Promise.reject(new Error('timeout')));
    const { result } = setup(request);
    await act(async () => { result.current.submit(); });

    vi.mocked(getProcessStatus).mockResolvedValue(statusOf('REQUEST_REQUIRED'));
    await act(async () => { result.current.retry(); });

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('error');
  });

  // 조회가 실패하면 중복을 피할 근거가 없다 — 사용자가 누른 것은 재요청이므로 재요청한다.
  it('re-requests when the status read itself fails', async () => {
    const request = vi.fn(() => Promise.reject(new Error('timeout')));
    const { result } = setup(request);
    await act(async () => { result.current.submit(); });

    vi.mocked(getProcessStatus).mockRejectedValue(new Error('status unavailable'));
    await act(async () => { result.current.retry(); });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reset returns to the confirm frame and drops the pending hold', async () => {
    const { result, settle } = setup(() => Promise.resolve());
    await act(async () => { result.current.submit(); });

    act(() => { result.current.reset(); });
    expect(result.current.phase).toBe('form');

    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    expect(settle).not.toHaveBeenCalled();
  });

  it('drops its hold timer on unmount', async () => {
    const { result, unmount } = setup(() => Promise.resolve());
    await act(async () => { result.current.submit(); });

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
