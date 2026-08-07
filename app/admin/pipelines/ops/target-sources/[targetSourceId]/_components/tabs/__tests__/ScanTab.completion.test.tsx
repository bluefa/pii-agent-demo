// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { UseScanPollingOptions, UseScanPollingReturn } from '@/app/hooks/useScanPolling';

/**
 * 스캔 완료 확인 전환이 admin 스캔 탭까지 실제로 배선돼 있는지 — useScanPolling 이
 * onScanComplete 를 부르면 카드가 진행 처리를 400ms 더 붙들었다가(settling) 결과로
 * 넘어가야 한다. 폴링 훅은 이 파일에서 대역으로 세우고, 완료 신호만 손으로 쏜다.
 */
const scanJob = {
  id: 42,
  scan_status: 'SUCCESS' as const,
  scan_version: 3,
  // 100 이 아니라 72 — 폴링이 마지막으로 본 값이 여기 남는다. 이 값이 100 이면
  // "settling 이 바를 100%로 고정한다"는 아래 단언이 픽스처를 되읽는 것에 그친다.
  scan_progress: 72,
  scan_error: null,
  created_at: '2026-08-07T10:00:00Z',
  updated_at: '2026-08-07T10:00:08Z',
  duration_seconds: 8,
  resource_count_by_resource_type: { AZURE_SQL_SERVER: 12 },
};

let capturedOnScanComplete: (() => void) | undefined;

// 폴링 훅만 대역으로 세우고 isScanFinalizing 은 실물을 그대로 쓴다 — 상수로 박으면
// 집계 구간이 통합 경로에서 사라져, settling 의 100% 고정이 그 상수에 가려진다.
vi.mock('@/app/hooks/useScanPolling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/hooks/useScanPolling')>();
  return {
    ...actual,
    useScanPolling: (_id: number, options?: UseScanPollingOptions): UseScanPollingReturn => {
      capturedOnScanComplete = options?.onScanComplete;
      return {
        latestJob: scanJob,
        uiState: 'COMPLETED',
        isPolling: false,
        loading: false,
        error: null,
        refresh: vi.fn().mockResolvedValue(undefined),
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        expectCompletion: vi.fn(),
      };
    },
  };
});

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

/**
 * 같은 문장이 화면용과 낭독용(sr-only) 두 벌로 존재한다 — 시각 단언은 보이는
 * 쪽만 세고, 낭독은 아래에서 라이브 리전을 직접 읽어 따로 확인한다.
 */
const visible = (pattern: RegExp): HTMLElement[] =>
  screen.queryAllByText(pattern).filter((el) => !el.className.includes('sr-only'));

describe('ScanTab — 완료 확인 전환', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOnScanComplete = undefined;
  });
  afterEach(() => vi.useRealTimers());

  it('완료 신호를 받으면 진행 → 확인 → 결과 순으로 넘어간다', async () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);
    // 마운트 이펙트의 이력 조회를 흘려보낸다 — 큐에 남은 상태 업데이트 위에서
    // 단언하지 않도록(같은 디렉터리 useScanPolling.test.ts 와 같은 문법).
    await act(async () => {});

    // 완료된 잡 위에 그냥 마운트한 상태 — 전환은 재생되지 않고 결과가 서 있다.
    expect(progressBar()).toBeNull();
    expect(visible(/개를 발견했어요/)).toHaveLength(1);
    expect(capturedOnScanComplete).toBeTypeOf('function');

    // useScanPolling 이 새 완료를 알린다.
    act(() => { capturedOnScanComplete?.(); });

    // settling: 바가 100%에 닿는 걸 보여주는 400ms — 결과 자리는 아직 휠이 쓴다.
    const bar = progressBar();
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByText('스캔 완료 후 집계돼요.')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(400); });

    // confirming: 바는 물러나고 같은 자리를 체크가 1.2초 쓴다 — 타일은 아직이다.
    expect(progressBar()).toBeNull();
    expect(visible(/^스캔이 끝났어요\.$/)).toHaveLength(1);
    expect(visible(/개를 발견했어요/)).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(1200); });

    // 확인 프레임이 물러난 자리로 결과가 들어온다.
    expect(visible(/^스캔이 끝났어요\.$/)).toHaveLength(0);
    expect(visible(/개를 발견했어요/)).toHaveLength(1);
    // 총계 도착이 낭독된다 — 확인 프레임이 물러나도 리전은 살아 있어야 가능하다.
    expect(document.querySelector('[aria-live="polite"]')?.textContent)
      .toMatch(/총 .*개를 발견했어요/);

    // 전환이 끝나며 걸린 이력 리로드를 흘려보낸다 — 남기면 act 경고가 뜬다.
    await act(async () => {});
  });

  it('이력 리로드를 전환이 끝난 뒤로 미룬다', async () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);
    await act(async () => {});
    getScanHistory.mockClear();

    act(() => { capturedOnScanComplete?.(); });
    // 전환 중에는 아래 표가 함께 출렁이지 않는다.
    act(() => { vi.advanceTimersByTime(400 + 1200 - 50); });
    expect(getScanHistory).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(50); });
    expect(getScanHistory).toHaveBeenCalledTimes(1);

    await act(async () => {});
  });
});
