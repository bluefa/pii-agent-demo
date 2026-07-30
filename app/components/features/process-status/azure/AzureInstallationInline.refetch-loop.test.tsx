// @vitest-environment jsdom
//
// Regression: AzureInstallationInline must fetch installation-status exactly
// once on mount. A previous version passed an *unmemoized* getFn to
// useInstallationStatus, whose fetch effect re-runs whenever getFn's identity
// changes — so every render re-fired the fetch, an unbounded refetch loop. It
// was most visible as a tight loop of retries when the endpoint kept returning
// 500 (no state change unmounts the component to break the cycle).
//
// These tests use the REAL useInstallationStatus hook (not mocked) and assert
// the API is called once whether it resolves or rejects.
import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';

const view: AzureInstallDetail = {
  lastCheck: { status: 'SUCCESS' },
  resources: [
    {
      resourceId: 'vm-1',
      resourceName: 'vm-1',
      rollup: { status: 'IN_PROGRESS', guide: null },
      cells: {
        pe: { status: 'IN_PROGRESS', guide: null },
        vmSubnet: { status: 'COMPLETED', guide: null },
        vmApply: { status: 'COMPLETED', guide: null },
        bdc: { status: 'COMPLETED', guide: null },
      },
    },
  ],
};

vi.mock('@/app/lib/api/azure', () => ({
  getAzureInstallationStatus: vi.fn(),
}));

// Adapter is pure; stub it so the test does not depend on raw-wire shaping.
vi.mock(
  '@/app/components/features/process-status/azure/install-detail-adapter',
  () => ({ buildAzureInstallDetail: () => view }),
);

import { getAzureInstallationStatus } from '@/app/lib/api/azure';
import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';

const confirmed: readonly ConfirmedResource[] = [
  {
    resourceId: 'vm-1',
    type: 'AZURE_VM',
    databaseType: 'AZURE_MYSQL',
    region: 'ap-northeast-1',
    resourceName: 'vm-1',
    host: null,
    port: null,
    oracleServiceId: null,
    networkInterfaceId: null,
    ipConfigurationName: null,
    credentialId: 'Key1',
    connectionStatus: 'CONNECTED',
  },
];

// Let any pending re-render → effect → refetch cycles flush. With the bug the
// call count keeps climbing across these ticks; with the fix it stays at 1.
const flushRenderCycles = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

describe('AzureInstallationInline — installation-status is fetched once (no refetch loop)', () => {
  beforeEach(() => {
    vi.mocked(getAzureInstallationStatus).mockReset();
  });

  it('fetches once on a 500 error and does not loop', async () => {
    vi.mocked(getAzureInstallationStatus).mockRejectedValue(
      new Error('Request failed with status 500'),
    );

    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);

    await waitFor(() => expect(getAzureInstallationStatus).toHaveBeenCalled());
    await flushRenderCycles();

    expect(getAzureInstallationStatus).toHaveBeenCalledTimes(1);
  });

  it('fetches once on success and does not loop', async () => {
    vi.mocked(getAzureInstallationStatus).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getAzureInstallationStatus>>,
    );

    render(<AzureInstallationInline targetSourceId={1003} confirmed={confirmed} />);

    await waitFor(() => expect(getAzureInstallationStatus).toHaveBeenCalled());
    await flushRenderCycles();

    expect(getAzureInstallationStatus).toHaveBeenCalledTimes(1);
  });
});
