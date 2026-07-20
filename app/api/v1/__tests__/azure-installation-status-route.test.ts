import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    azure: {
      getInstallationStatus: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/azure/target-sources/[targetSourceId]/installation-status/route';
import { bff } from '@/lib/bff/client';

const mockedGetInstallationStatus = vi.mocked(bff.azure.getInstallationStatus);

describe('GET /integration/api/v1/azure/target-sources/[targetSourceId]/installation-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates the snake wire response with schemas.AzureInstallationStatusResponse', async () => {
    // ADR-019 zod-codegen: bff returns raw snake wire; route parses with
    // schemas.AzureInstallationStatusResponse (per-resource step DTOs).
    mockedGetInstallationStatus.mockResolvedValue({
      last_check: { status: 'IN_PROGRESS', checked_at: '2026-03-30T00:00:00Z' },
      resources: [
        {
          resource_id: 'vm-001',
          resource_name: 'vm-001',
          resource_type: 'AZURE_VM',
          installation_status: 'COMPLETED',
          bdc_side_terraform_apply: { status: 'COMPLETED' },
          service_side_private_endpoint_approval: { id: 'pe-vm-001', name: 'pe-vm-001', status: 'COMPLETED' },
          azure_virtual_machine_subnet_creation: { status: 'COMPLETED' },
          azure_virtual_machine_terraform_apply: { status: 'COMPLETED' },
        },
        {
          resource_id: 'mysql-001',
          resource_name: 'mysql-001',
          resource_type: 'AZURE_MYSQL',
          installation_status: 'IN_PROGRESS',
          bdc_side_terraform_apply: { status: 'COMPLETED' },
          service_side_private_endpoint_approval: { id: 'pe-mysql-001', name: 'pe-mysql-001', status: 'SKIP' },
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
