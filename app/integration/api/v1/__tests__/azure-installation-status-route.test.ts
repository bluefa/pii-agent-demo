import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    azure: {
      getInstallationStatus: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route';
import { bff } from '@/lib/bff/client';

const mockedGetInstallationStatus = vi.mocked(bff.azure.getInstallationStatus);

describe('GET /integration/api/v1/azure/target-sources/[targetSourceId]/installation-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the swagger AzureInstallationStatusResponse (vm_installation embedded) to the UI domain', async () => {
    // ADR-019: bff returns the swagger camel domain (vm_installation embedded per
    // resource); the route maps last_check 5→3 values, private_endpoint.status
    // (free string) → the UI enum, and reads load_balancer opaquely.
    mockedGetInstallationStatus.mockResolvedValue({
      lastCheck: { status: 'IN_PROGRESS', checkedAt: '2026-03-30T00:00:00Z' },
      resources: [
        {
          resourceId: 'vm-001',
          resourceName: 'vm-001',
          resourceType: 'AZURE_VM',
          privateEndpoint: { id: 'pe-vm-001', name: 'pe-vm-001', status: 'APPROVED' },
          vmInstallation: {
            subnetExists: true,
            loadBalancer: { installed: true, name: 'lb-001' },
          },
        },
        {
          resourceId: 'mysql-001',
          resourceName: 'mysql-001',
          resourceType: 'AZURE_MYSQL',
          privateEndpoint: { id: 'pe-mysql-001', name: 'pe-mysql-001', status: 'NOT_REQUESTED' },
        },
      ],
    });

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/installation-status'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      lastCheck: {
        status: 'IN_PROGRESS',
        checkedAt: '2026-03-30T00:00:00Z',
      },
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
          vmInstallation: {
            subnetExists: true,
            loadBalancer: { installed: true, name: 'lb-001' },
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
    });
  });
});
