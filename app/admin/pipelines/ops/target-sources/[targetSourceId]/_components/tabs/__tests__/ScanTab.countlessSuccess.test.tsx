// @vitest-environment jsdom
import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { UseScanPollingOptions, UseScanPollingReturn } from '@/app/hooks/useScanPolling';

/**
 * SUCCESS 는 counts 와 무관하게 완료다(오너 확정). 그 결정의 대가는 "0개 발견"까지이지,
 * 없는 건수 맵을 직전 스캔에서 빼서 만들어낸 소멸이 아니다 — 그 잡은 이미 COMPLETED 라
 * 폴링이 멈춘 뒤여서, 한 번 그려지면 탭을 다시 열기 전까지 굳는다.
 */
const countlessSuccess = {
  id: 42,
  scan_status: 'SUCCESS' as const,
  scan_version: 4,
  scan_progress: null,
  scan_error: null,
  created_at: '2026-08-19T10:00:00Z',
  updated_at: '2026-08-19T10:00:08Z',
  duration_seconds: 8,
  resource_count_by_resource_type: null,
};

/** 직전 성공 — 건수를 갖고 있어 diff 의 기준이 될 자격이 있다. */
const previousSuccess = {
  id: 41,
  scan_status: 'SUCCESS' as const,
  scan_version: 3,
  scan_progress: null,
  scan_error: null,
  created_at: '2026-08-19T09:00:00Z',
  updated_at: '2026-08-19T09:00:08Z',
  duration_seconds: 8,
  resource_count_by_resource_type: { AZURE_SQL_SERVER: 96_000 },
};

vi.mock('@/app/hooks/useScanPolling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/hooks/useScanPolling')>();
  return {
    ...actual,
    useScanPolling: (_id: number, _options?: UseScanPollingOptions): UseScanPollingReturn => ({
      latestJob: countlessSuccess,
      uiState: 'COMPLETED',
      isPolling: false,
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      expectCompletion: vi.fn(),
    }),
  };
});

const getScanHistory = vi.fn();
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

describe('ScanTab — 건수 맵 없는 SUCCESS', () => {
  beforeEach(() => {
    getScanHistory.mockResolvedValue({
      content: [countlessSuccess, previousSuccess],
      totalPages: 1,
    });
  });

  it('직전 스캔과의 증감을 지어내지 않는다', async () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);
    await act(async () => {});

    // 건수 맵이 없다는 건 "0건을 쟀다"가 아니라 "재지 않았다"이다.
    expect(screen.queryByText(/줄어든/)).toBeNull();
    expect(screen.queryByText(/늘어든|늘어난/)).toBeNull();
    expect(screen.queryByText(/직전 스캔/)).toBeNull();
  });

  it('직전 성공에만 있던 리소스 타입을 0개짜리 타일로 부활시키지 않는다', async () => {
    render(<ScanTab targetSourceId={1005} detail={detail} />);
    await act(async () => {});

    // union(현재 ∪ 직전) 로 타일을 만들면 12개의 0짜리 타일이 생기고, 그것들이
    // "발견된 리소스가 없습니다" 안내를 가려버린다.
    expect(screen.queryByText('SQL_SERVER')).toBeNull();
    expect(screen.getByText('발견된 리소스가 없습니다.')).toBeTruthy();
  });
});
