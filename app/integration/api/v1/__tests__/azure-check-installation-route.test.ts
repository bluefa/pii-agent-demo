import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    azure: {
      checkInstallation: vi.fn(),
      vmCheckInstallation: vi.fn(),
    },
  },
}));

import { POST } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/check-installation/route';
import { bff } from '@/lib/bff/client';

const mockedDb = vi.mocked(bff.azure.checkInstallation);
const mockedVm = vi.mocked(bff.azure.vmCheckInstallation);

const dbFixture = {
  provider: 'Azure',
  installed: false,
  lastCheckedAt: '2026-04-10T00:00:00Z',
  resources: [
    {
      resourceId: 'vm-001',
      resourceName: 'vm-001',
      resourceType: 'AZURE_VM',
      privateEndpoint: { id: 'pe-vm-001', name: 'pe-vm-001', status: 'APPROVED' },
    },
  ],
};

const vmFixture = {
  vms: [
    {
      vmId: 'vm-001',
      vmName: 'vm-001',
      subnetExists: true,
      loadBalancer: { installed: true, name: 'lb-001' },
    },
  ],
  lastCheckedAt: '2026-04-10T00:00:00Z',
};

describe('POST /integration/api/v1/azure/target-sources/[targetSourceId]/check-installation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DB + VM 응답을 v1 통합 스키마로 병합한다', async () => {
    mockedDb.mockResolvedValue(dbFixture);
    mockedVm.mockResolvedValue(vmFixture);

    const response = await POST(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/check-installation', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resources[0].vmInstallation).toEqual({
      subnetExists: true,
      loadBalancer: { installed: true, name: 'lb-001' },
    });
  });

  it('VM check 실패(BffError) 시에도 DB 결과만으로 응답한다', async () => {
    mockedDb.mockResolvedValue(dbFixture);
    mockedVm.mockRejectedValue(new BffError(500, 'VM_UNAVAILABLE', 'VM service unavailable'));

    const response = await POST(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/check-installation', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resources[0].vmInstallation).toBeNull();
  });

  it('DB check 실패 시 BffError가 ProblemDetails로 변환된다', async () => {
    mockedDb.mockRejectedValue(new BffError(404, 'NOT_FOUND', '프로젝트를 찾을 수 없습니다.'));

    const response = await POST(
      new Request('http://localhost/integration/api/v1/azure/target-sources/9999/check-installation', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '9999' }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const body = await response.json();
    expect(body.code).toBe('TARGET_SOURCE_NOT_FOUND');
  });

  it('VM check가 BffError 외 예외를 던지면 propagate한다', async () => {
    mockedDb.mockResolvedValue(dbFixture);
    mockedVm.mockRejectedValue(new TypeError('boom'));

    const response = await POST(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/check-installation', { method: 'POST' }),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    // Non-BffError → withV1's handleUnexpectedError → INTERNAL_ERROR 500
    expect(response.status).toBe(500);
  });
});
