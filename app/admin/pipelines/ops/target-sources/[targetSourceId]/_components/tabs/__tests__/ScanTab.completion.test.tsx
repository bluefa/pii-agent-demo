// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

/**
 * 스캔 완료 확인 전환이 admin 스캔 탭까지 실제로 배선돼 있는지 — useScanPolling 이
 * onScanComplete 를 부르면 카드가 진행 처리를 400ms 더 붙들었다가(settling) 결과로
 * 넘어가야 한다. 폴링 훅은 이 파일에서 대역으로 세우고, 완료 신호만 손으로 쏜다.
 */
const scanJob = {
  id: 42,
  scan_status: 'SUCCESS' as const,
  scan_version: 3,
  scan_progress: 100,
  scan_error: null,
  created_at: '2026-08-07T10:00:00Z',
  updated_at: '2026-08-07T10:00:08Z',
  duration_seconds: 8,
  resource_count_by_resource_type: { AZURE_SQL_SERVER: 12 },
};

let capturedOnScanComplete: (() => void) | undefined;

vi.mock('@/app/hooks/useScanPolling', () => ({
  isScanFinalizing: () => false,
  useScanPolling: (_id: number, options?: { onScanComplete?: () => void }) => {
    capturedOnScanComplete = options?.onScanComplete;
    return {
      latestJob: scanJob,
      uiState: 'COMPLETED',
      isPolling: false,
      loading: false,
      error: null,
      refresh: vi.fn(),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      expectCompletion: vi.fn(),
    };
  },
}));

const getScanHistory = vi.fn().mockResolvedValue({ content: [], totalPages: 1 });
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: (...args: unknown[]) => getScanHistory(...args),
  startScan: vi.fn().mockResolvedValue({ id: 43 }),
}));

vi.mock(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanCredentialCard',
  () => ({ ScanCredentialCard: () => null }),
);

import { ScanTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanTab';

const detail = { cloud_provider: 'AZURE' } as unknown as RawTargetSourceDetail;

const progressBar = (): HTMLElement | null => document.querySelector('[role="progressbar"]');

describe('ScanTab — 완료 확인 전환', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOnScanComplete = undefined;
  });
  afterEach(() => vi.useRealTimers());

  it('완료 신호를 받으면 진행 처리를 붙들었다가 결과로 넘어간다', async () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);

    // 완료된 잡 위에 그냥 마운트한 상태 — 전환은 재생되지 않고 결과가 서 있다.
    expect(progressBar()).toBeNull();
    expect(screen.getByText(/개를 발견했어요/)).toBeTruthy();
    expect(capturedOnScanComplete).toBeTypeOf('function');

    // useScanPolling 이 새 완료를 알린다.
    act(() => { capturedOnScanComplete?.(); });

    // settling: 바가 100%에 닿는 걸 보여주는 400ms — 결과는 아직 자리를 비운다.
    const bar = progressBar();
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByText('스캔 완료 후 집계돼요.')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(400); });

    // confirming: 진행 처리가 물러나고 결과가 들어온다.
    expect(progressBar()).toBeNull();
    expect(screen.getByText(/개를 발견했어요/)).toBeTruthy();
  });

  it('이력 리로드를 전환이 끝난 뒤로 미룬다', () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);
    getScanHistory.mockClear();

    act(() => { capturedOnScanComplete?.(); });
    // 전환 중에는 아래 표가 함께 출렁이지 않는다.
    act(() => { vi.advanceTimersByTime(400 + 1200 - 50); });
    expect(getScanHistory).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(50); });
    expect(getScanHistory).toHaveBeenCalledTimes(1);
  });
});
