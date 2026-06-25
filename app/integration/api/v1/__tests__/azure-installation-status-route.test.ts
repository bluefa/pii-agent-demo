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

  it('validates the snake wire response with schemas.AzureInstallationStatusResponse', async () => {
    // ADR-019 zod-codegen: bff returns raw snake wire; route parses with
    // schemas.AzureInstallationStatusResponse (vm_installation embedded per resource).
    mockedGetInstallationStatus.mockResolvedValue({
      last_check: { status: 'IN_PROGRESS', checked_at: '2026-03-30T00:00:00Z' },
      resources: [
        {
          resource_id: 'vm-001',
          resource_name: 'vm-001',
          resource_type: 'AZURE_VM',
          private_endpoint: { id: 'pe-vm-001', name: 'pe-vm-001', status: 'APPROVED' },
          vm_installation: {
            subnet_exists: true,
            load_balancer: { installed: true, name: 'lb-001' },
          },
        },
        {
          resource_id: 'mysql-001',
          resource_name: 'mysql-001',
          resource_type: 'AZURE_MYSQL',
          private_endpoint: { id: 'pe-mysql-001', name: 'pe-mysql-001', status: 'NOT_REQUESTED' },
        },
      ],
    });

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/installation-status'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      last_check: {
        status: 'IN_PROGRESS',
        checked_at: '2026-03-30T00:00:00Z',
      },
      resources: expect.arrayContaining([
        expect.objectContaining({ resource_id: 'vm-001', resource_type: 'AZURE_VM' }),
        expect.objectContaining({ resource_id: 'mysql-001', resource_type: 'AZURE_MYSQL' }),
      ]),
    });
  });
});
