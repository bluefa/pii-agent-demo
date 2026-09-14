// @vitest-environment jsdom
/**
 * 설치 상태 스냅샷도 대상을 따라간다 — id 가 바뀌면 앞 대상의 판정이 남지 않는다.
 *
 * 초기화가 `load()` 가 아니라 **이펙트**에 있는 것이 요점이다: `reload()` 는 같은
 * `load()` 를 부르는데, 다시 읽는 동안 스냅샷을 버리면 「실패는 빈 결과가 아니다」가
 * 무너진다. 그래서 이 파일은 두 가지를 같이 붙든다 — 대상이 바뀌면 비운다, 다시
 * 읽는 동안에는 비우지 않는다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

import { useInstallCheck } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/useInstallCheck';

const CHECKED_AT = '2026-08-31T01:00:00Z';

const getAwsInstallationStatus = vi.fn((id: number) =>
  id === 1
    ? Promise.resolve({
        lastCheck: { status: 'SUCCESS', checkedAt: CHECKED_AT },
        roleVerify: { status: 'SKIP', roleArn: null },
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
// 응답은 오지 않는다 — 요청이 나갔는지만 센다.
const getAzureInstallationStatus = vi.fn(() => new Promise(() => {}));
const getGcpInstallationStatus = vi.fn(() => new Promise(() => {}));
const getIdcInstallationStatus = vi.fn(() => new Promise(() => {}));
vi.mock('@/app/lib/api/azure', () => ({
  getAzureInstallationStatus: () => getAzureInstallationStatus(),
}));
vi.mock('@/app/lib/api/gcp', () => ({ getGcpInstallationStatus: () => getGcpInstallationStatus() }));
vi.mock('@/app/lib/api/idc', () => ({ getIdcInstallationStatus: () => getIdcInstallationStatus() }));

/** 프로바이더별 — 요청이 나가는가, 스냅샷이 나오는가. */
function ProviderProbe({
  provider,
  manualInstall,
}: {
  provider: string;
  manualInstall: boolean;
}): ReactElement {
  const { detail, loading } = useInstallCheck(1, provider, manualInstall);
  return (
    <output data-testid="probe">
      {loading ? 'loading' : 'settled'}|{detail?.roleVerify ?? 'none'}
    </output>
  );
}

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

describe('useInstallCheck — 대상 전환', () => {
  it('id 가 바뀌면 앞 대상의 스냅샷을 버리고 다시 모른다고 말한다', async () => {
    const { rerender } = render(<Probe targetSourceId={1} />);
    await waitFor(() => expect(read()).toBe(`settled|${CHECKED_AT}`));

    rerender(<Probe targetSourceId={2} />);

    await waitFor(() => expect(read()).toBe('loading|none'));
  });
});

describe('useInstallCheck — 네 프로바이더 전부 조회한다', () => {
  // 예전에는 서비스 측 단계가 있는 대상(AWS 수동·GCP)만 읽었다. 설치 상태 카드가 모든
  // 대상에서 누구 차례인지를 말하므로 AWS 자동·Azure·IDC 도 요청이 나가야 한다.
  it('AWS 자동 설치도 읽고, roleVerify 를 내놓는다', async () => {
    render(<ProviderProbe provider="aws" manualInstall={false} />);
    await waitFor(() => expect(read()).toBe('settled|SKIP'));
    expect(getAwsInstallationStatus).toHaveBeenCalledWith(1);
  });

  it.each([
    ['azure', getAzureInstallationStatus],
    ['gcp', getGcpInstallationStatus],
    ['idc', getIdcInstallationStatus],
  ])('%s 도 요청을 보낸다', async (provider, fetcher) => {
    render(<ProviderProbe provider={provider} manualInstall />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(read()).toBe('loading|none');
  });

  it('SDU 는 읽을 설치 상태가 없다 — 요청도 없고 로딩도 아니다', () => {
    render(<ProviderProbe provider="sdu" manualInstall />);
    expect(read()).toBe('settled|none');
    expect(getAwsInstallationStatus).not.toHaveBeenCalled();
    expect(getAzureInstallationStatus).not.toHaveBeenCalled();
    expect(getGcpInstallationStatus).not.toHaveBeenCalled();
    expect(getIdcInstallationStatus).not.toHaveBeenCalled();
  });
});
