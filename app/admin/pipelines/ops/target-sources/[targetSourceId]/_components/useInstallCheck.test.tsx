// @vitest-environment jsdom
/**
 * 설치 상태 스냅샷도 대상을 따라간다 — id 가 바뀌면 앞 대상의 판정이 남지 않는다.
 *
 * 초기화가 `load()` 가 아니라 **이펙트**에 있는 것이 요점이다: `reload()` 는 같은
 * `load()` 를 부르는데, 다시 읽는 동안 스냅샷을 버리면 「실패는 빈 결과가 아니다」가
 * 무너진다. 그래서 이 파일은 두 가지를 같이 붙든다 — 대상이 바뀌면 비운다, 다시
 * 읽는 동안에는 비우지 않는다.
 */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

import { useInstallCheck, useInstallPending } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/useInstallCheck';

const CHECKED_AT = '2026-08-31T01:00:00Z';

const getAwsInstallationStatus = vi.fn((id: number) =>
  id === 1
    ? Promise.resolve({
        lastCheck: { status: 'SUCCESS', checkedAt: CHECKED_AT },
        resources: [
          {
            resourceId: 'db-1',
            resourceName: 'db-1',
            installationStatus: 'IN_PROGRESS',
            serviceTerraform: { status: 'NOT_STARTED', guide: null },
            bdcServiceTerraform: { status: 'NOT_STARTED', guide: null },
            bdcCommonTerraform: { status: 'NOT_STARTED', guide: null },
          },
        ],
      })
    : // 새 대상의 응답은 오지 않는다 — 그 사이 훅이 무엇을 말하는지가 이 테스트다.
      new Promise(() => {}),
);

vi.mock('@/app/lib/api/aws', () => ({
  getAwsInstallationStatus: (targetSourceId: number) => getAwsInstallationStatus(targetSourceId),
}));
vi.mock('@/app/lib/api/azure', () => ({ getAzureInstallationStatus: vi.fn() }));
vi.mock('@/app/lib/api/gcp', () => ({ getGcpInstallationStatus: vi.fn() }));
vi.mock('@/app/lib/api/idc', () => ({ getIdcInstallationStatus: vi.fn() }));

/** 관측 가능한 렌더 — 커밋된 값만 읽는다. */
function Probe({ targetSourceId }: { targetSourceId: number }): ReactElement {
  const { lastCheck, loading } = useInstallCheck(targetSourceId, 'aws', true);
  return (
    <output data-testid="probe">
      {loading ? 'loading' : 'settled'}|{lastCheck?.checkedAt ?? 'none'}
    </output>
  );
}

const read = (): string => screen.getByTestId('probe').textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.useRealTimers());

describe('useInstallCheck — 대상 전환', () => {
  it('id 가 바뀌면 앞 대상의 스냅샷을 버리고 다시 모른다고 말한다', async () => {
    const { rerender } = render(<Probe targetSourceId={1} />);
    await waitFor(() => expect(read()).toBe(`settled|${CHECKED_AT}`));

    rerender(<Probe targetSourceId={2} />);

    await waitFor(() => expect(read()).toBe('loading|none'));
  });
});

describe('useInstallPending refresh behavior', () => {
  it('keeps the entry snapshot without adding installation polling', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useInstallPending(1, 'aws', true));
    await act(async () => {});
    expect(result.current.lastCheck?.checkedAt).toBe(CHECKED_AT);
    expect(getAwsInstallationStatus).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000); });
    expect(getAwsInstallationStatus).toHaveBeenCalledTimes(1);

    await act(async () => { result.current.reload(); });
    expect(getAwsInstallationStatus).toHaveBeenCalledTimes(2);
    unmount();
    renderHook(() => useInstallPending(1, 'aws', true));
    await act(async () => {});
    expect(getAwsInstallationStatus).toHaveBeenCalledTimes(3);
  });
});
