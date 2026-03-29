import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    azure: {
      getInstallationStatus: vi.fn(),
      vmGetInstallationStatus: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route';
import { client } from '@/lib/api-client';

const mockedGetInstallationStatus = vi.mocked(client.azure.getInstallationStatus);
const mockedVmGetInstallationStatus = vi.mocked(client.azure.vmGetInstallationStatus);

describe('GET /integration/api/v1/azure/target-sources/[targetSourceId]/installation-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Issue #222 계약에 맞게 snake_case Azure 설치 상태를 반환한다', async () => {
    mockedGetInstallationStatus.mockResolvedValue(NextResponse.json({
      provider: 'Azure',
      installed: false,
      lastCheckedAt: '2026-03-30T00:00:00Z',
      resources: [
        {
          resourceId: 'vm-001',
          resourceName: 'vm-001',
          resourceType: 'AZURE_VM',
          privateEndpoint: {
            id: 'pe-vm-001',
            name: 'pe-vm-001',
            status: 'APPROVED',
          },
        },
        {
          resourceId: 'mysql-001',
          resourceName: 'mysql-001',
          resourceType: 'AZURE_MYSQL',
          privateEndpoint: {
            id: 'pe-mysql-001',
            name: 'pe-mysql-001',
            status: 'NOT_REQUESTED',
          },
        },
      ],
    }));

    mockedVmGetInstallationStatus.mockResolvedValue(NextResponse.json({
      vms: [
        {
          vmId: 'vm-001',
          vmName: 'vm-001',
          subnetExists: true,
          loadBalancer: {
            installed: true,
            name: 'lb-vm-001',
          },
          privateEndpoint: {
            id: 'pe-vm-001',
            name: 'pe-vm-001',
            status: 'APPROVED',
          },
        },
      ],
    }));

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/installation-status'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      has_vm: true,
      last_check: {
        status: 'SUCCESS',
        checked_at: '2026-03-30T00:00:00Z',
      },
      resources: [
        {
          resource_id: 'vm-001',
          resource_name: 'vm-001',
          resource_type: 'AZURE_VM',
          is_vm: true,
          private_endpoint: {
            id: 'pe-vm-001',
            name: 'pe-vm-001',
            status: 'APPROVED',
          },
          vm_installation: {
            subnet_exists: true,
            load_balancer: {
              installed: true,
              name: 'lb-vm-001',
            },
          },
        },
        {
          resource_id: 'mysql-001',
          resource_name: 'mysql-001',
          resource_type: 'AZURE_MYSQL',
          is_vm: false,
          private_endpoint: {
            id: 'pe-mysql-001',
            name: 'pe-mysql-001',
            status: 'NOT_REQUESTED',
          },
        },
      ],
    });
  });
});
